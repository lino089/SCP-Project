import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  BookOpen,
  Calendar,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import leaveApi from '../../services/leaveApi';
import journalApi from '../../services/journalApi';
import masterDataApi from '../../services/masterDataApi';
import {
  Badge,
  Button,
  Modal,
  Tabs,
  Table,
  Select,
  Input,
  StatCard,
} from '../../components/shared';
import ForbiddenState from '../../components/feedback/ForbiddenState';
import './MonitoringRecap.css';

export default function MonitoringRecapPage() {
  const navigate = useNavigate();
  const { hasRole, isKesiswaan, isWaliKelas } = useAuth();

  const [activeTab, setActiveTab] = useState('presensi'); // 'presensi' | 'jurnal'

  // Data State
  const [attendances, setAttendances] = useState([]);
  const [journals, setJournals] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter Presensi
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Filter Jurnal
  const [journalFilterDate, setJournalFilterDate] = useState('');
  const [expandedTopicIds, setExpandedTopicIds] = useState(new Set());
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Otorisasi: Waka, Kesiswaan, atau Wali Kelas
  const isAuthorized = useMemo(() => {
    return hasRole('waka') || isKesiswaan() || isWaliKelas();
  }, [hasRole, isKesiswaan, isWaliKelas]);

  // Load Data saat Mount
  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [attRes, jourRes, clsRes] = await Promise.all([
          leaveApi.getAttendances({ per_page: 100 }),
          journalApi.getJournals({ per_page: 100 }),
          masterDataApi.getClasses({ per_page: 50 }).catch(() => ({ data: [] })),
        ]);

        if (!isMounted) return;

        if (attRes.success && Array.isArray(attRes.data)) {
          setAttendances(attRes.data);
        }
        if (jourRes.success && Array.isArray(jourRes.data)) {
          setJournals(jourRes.data);
        }
        if (clsRes.data && Array.isArray(clsRes.data)) {
          setClassesList(clsRes.data);
        }
      } catch {
        // Fallback otomatis tertangani
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter Presensi Aktif
  const filteredAttendances = useMemo(() => {
    return attendances.filter((item) => {
      if (filterDate && item.date !== filterDate) return false;
      if (filterClass !== 'ALL' && String(item.student?.class_id) !== filterClass) return false;
      if (filterStatus !== 'ALL' && item.status?.toLowerCase() !== filterStatus.toLowerCase()) return false;
      return true;
    });
  }, [attendances, filterDate, filterClass, filterStatus]);

  // Kalkulasi Metrik Kehadiran
  const metrics = useMemo(() => {
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;

    filteredAttendances.forEach((item) => {
      const st = item.status?.toLowerCase();
      if (st === 'hadir') hadir += 1;
      else if (st === 'sakit') sakit += 1;
      else if (st === 'izin') izin += 1;
      else if (st === 'alpa') alpa += 1;
    });

    const total = filteredAttendances.length;
    const rate = total > 0 ? ((hadir / total) * 100).toFixed(1) : '100.0';

    return { total, hadir, sakit, izin, alpa, rate };
  }, [filteredAttendances]);

  // Filter Jurnal Mengajar
  const filteredJournals = useMemo(() => {
    return journals.filter((item) => {
      if (journalFilterDate && item.date !== journalFilterDate) return false;
      return true;
    });
  }, [journals, journalFilterDate]);

  // Toggle Accordion Topik Materi
  const toggleTopicExpand = (id) => {
    setExpandedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Ekspor Data Presensi ke Format CSV
  const handleExportCSV = () => {
    if (filteredAttendances.length === 0) {
      alert('Tidak ada data presensi untuk diekspor pada filter ini.');
      return;
    }

    const headers = ['No,Tanggal,NIS,Nama Siswa,Kelas,Status Kehadiran,Mata Pelajaran'];
    const rows = filteredAttendances.map((item, idx) => {
      return [
        idx + 1,
        item.date,
        item.student?.nis_nip || '',
        `"${item.student?.name || ''}"`,
        item.student?.schoolClass?.name || '',
        item.status || 'Hadir',
        `"${item.journal?.schedule?.subject?.name || 'KBM Reguler'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_presensi_${filterDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Opsi Dropdown Kelas
  const classOptions = [
    { value: 'ALL', label: 'Semua Rombel Kelas' },
    ...classesList.map((c) => ({ value: String(c.id), label: `${c.level} - ${c.name}` })),
  ];

  // Kolom Tabel Presensi Siswa
  const attendanceColumns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      width: '50px',
      renderCell: (_row, idx) => (
        <span className="font-mono text-xs text-gray-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Tanggal',
      renderCell: (row) => (
        <span className="font-mono text-xs font-medium text-gray-900">
          {row.date}
        </span>
      ),
    },
    {
      key: 'nis',
      label: 'NIS',
      renderCell: (row) => (
        <code className="font-mono text-[11px] bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded text-gray-700">
          {row.student?.nis_nip || '-'}
        </code>
      ),
    },
    {
      key: 'name',
      label: 'Nama Siswa & Kelas',
      renderCell: (row) => (
        <div>
          <div className="font-semibold text-gray-900 text-xs">
            {row.student?.name}
          </div>
          <div className="text-[11px] text-gray-500 font-mono">
            {row.student?.schoolClass?.name}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status Kehadiran',
      renderCell: (row) => {
        const s = (row.status || '').toLowerCase();
        if (s === 'hadir') return <Badge variant="success">Hadir</Badge>;
        if (s === 'sakit') return <Badge variant="info">Sakit</Badge>;
        if (s === 'izin') return <Badge variant="warning">Izin</Badge>;
        return <Badge variant="error">Alpa</Badge>;
      },
    },
    {
      key: 'subject',
      label: 'Keterangan Sesi KBM',
      renderCell: (row) => (
        <div className="text-xs text-gray-600">
          <div>{row.journal?.schedule?.subject?.name || 'KBM Kelas'}</div>
          <div className="text-[11px] text-gray-400">
            Guru: {row.journal?.schedule?.teacher?.name || '-'}
          </div>
        </div>
      ),
    },
  ];

  // Kolom Tabel Jurnal Mengajar
  const journalColumns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      width: '50px',
      renderCell: (_row, idx) => (
        <span className="font-mono text-xs text-gray-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Tanggal KBM',
      renderCell: (row) => (
        <span className="font-mono text-xs font-medium text-gray-900">
          {row.date}
        </span>
      ),
    },
    {
      key: 'classSubject',
      label: 'Kelas & Mata Pelajaran',
      renderCell: (row) => (
        <div>
          <span className="font-bold text-gray-900 text-xs">
            {row.schedule?.schoolClass?.name || 'Kelas'}
          </span>
          <div className="text-xs text-gray-600 mt-0.5">
            {row.schedule?.subject?.name || 'Mata Pelajaran'}
          </div>
        </div>
      ),
    },
    {
      key: 'teacher',
      label: 'Guru Pengampu / Pengganti',
      renderCell: (row) => (
        <div>
          <div className="text-xs font-medium text-gray-900">
            {row.schedule?.teacher?.name}
          </div>
          {row.substitute_teacher_id && (
            <span className="inline-block mt-0.5 text-[10.5px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              Digantikan Kesiswaan
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status Jurnal',
      renderCell: (row) => {
        if (row.status === 'completed') return <Badge variant="success">Selesai</Badge>;
        if (row.status === 'teacher_absent') return <Badge variant="danger">Jam Kosong</Badge>;
        return <Badge variant="neutral">Sedang Berlangsung</Badge>;
      },
    },
    {
      key: 'topic',
      label: 'Topik Pembelajaran',
      renderCell: (row) => {
        const isExpanded = expandedTopicIds.has(row.id);
        const text = row.topic_description || '-';
        return (
          <div className="text-xs text-gray-700 max-w-xs">
            <div className={isExpanded ? '' : 'truncate'}>{text}</div>
            {text.length > 40 && (
              <button
                type="button"
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-0.5 flex items-center gap-0.5 cursor-pointer"
                onClick={() => toggleTopicExpand(row.id)}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp size={11} /> Ciutkan
                  </>
                ) : (
                  <>
                    <ChevronDown size={11} /> Selengkapnya
                  </>
                )}
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'photo',
      label: 'Foto Bukti',
      align: 'right',
      renderCell: (row) =>
        row.photo_path ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-medium cursor-pointer transition-colors"
            onClick={() => setPreviewPhoto(row)}
          >
            <ImageIcon size={13} className="text-gray-500" />
            <span>Lihat Foto</span>
          </button>
        ) : (
          <span className="text-gray-400 text-xs italic">Tanpa foto</span>
        ),
    },
  ];

  // Blokir Akses jika Bukan Waka / Kesiswaan / Wali Kelas
  if (!isAuthorized) {
    return (
      <div className="monitoring-recap">
        <ForbiddenState
          title="Akses Monitoring Ditolak (403 Forbidden)"
          message="Layar monitoring institusi hanya dapat diakses oleh Waka Kurikulum, Guru Kesiswaan, atau Wali Kelas."
          actionText="Kembali ke Beranda"
          onAction={() => navigate('/teacher/schedule')}
        />
      </div>
    );
  }

  return (
    <div className="monitoring-recap">
      {/* Header Halaman */}
      <div className="monitoring-recap__header">
        <div className="monitoring-recap__title-group">
          <h1>Monitoring &amp; Rekapitulasi Presensi</h1>
          <p className="monitoring-recap__subtitle">
            Pantau kehadiran siswa institusi, rekapitulasi keterlaksanaan KBM, dan dokumentasi kegiatan belajar mengajar harian.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isWaliKelas() && !hasRole('waka') && !isKesiswaan() && (
            <Badge variant="warning">Terkunci pada Kelas Binaan</Badge>
          )}
          <Badge variant="default">Tahun Ajaran 2026/2027</Badge>
        </div>
      </div>

      {/* Tabs Menu Utama: Rekap Presensi vs Jurnal Mengajar */}
      <div className="mb-5">
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'presensi', label: 'Rekap Presensi Siswa', icon: Users },
            { id: 'jurnal', label: 'Rekap Jurnal Mengajar Sekolah', icon: BookOpen },
          ]}
        />
      </div>

      {/* TAB 1: REKAP PRESENSI SISWA */}
      {activeTab === 'presensi' && (
        <div>
          {/* Metrik Cards Kehadiran */}
          <div className="monitoring-recap__metrics">
            <StatCard
              title="Tingkat Kehadiran"
              value={`${metrics.rate}%`}
              icon={CheckCircle2}
              variant="success"
            />
            <StatCard
              title="Siswa Hadir"
              value={metrics.hadir}
              icon={Users}
              variant="default"
            />
            <StatCard
              title="Sakit"
              value={metrics.sakit}
              icon={Clock}
              variant="info"
            />
            <StatCard
              title="Izin"
              value={metrics.izin}
              icon={Calendar}
              variant="warning"
            />
            <StatCard
              title="Alpa / Tanpa Ket"
              value={metrics.alpa}
              icon={AlertCircle}
              variant="danger"
            />
          </div>

          {/* Filter Bar */}
          <div className="monitoring-recap__filter-box">
            <div className="monitoring-recap__filter-group">
              <Input
                label="Tanggal Presensi"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />

              <Select
                label="Filter Rombel Kelas"
                options={classOptions}
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              />

              <Select
                label="Status Kehadiran"
                options={[
                  { value: 'ALL', label: 'Semua Status' },
                  { value: 'Hadir', label: 'Hadir' },
                  { value: 'Sakit', label: 'Sakit' },
                  { value: 'Izin', label: 'Izin' },
                  { value: 'Alpa', label: 'Alpa' },
                ]}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              />
            </div>

            <div>
              <Button
                variant="outline"
                size="md"
                icon={FileSpreadsheet}
                onClick={handleExportCSV}
              >
                Unduh Rekap CSV
              </Button>
            </div>
          </div>

          {/* Tabel Presensi Siswa */}
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Daftar Presensi ({filteredAttendances.length} Baris Data)
              </h2>
              <span className="text-[11px] text-gray-500 font-mono">
                Tanggal: {filterDate || 'Semua'}
              </span>
            </div>

            <Table
              columns={attendanceColumns}
              data={filteredAttendances}
              loading={isLoading}
              emptyMessage="Tidak ada data presensi yang sesuai dengan kriteria filter."
            />
          </div>
        </div>
      )}

      {/* TAB 2: REKAP JURNAL MENGAJAR SEKOLAH */}
      {activeTab === 'jurnal' && (
        <div>
          {/* Filter Jurnal */}
          <div className="monitoring-recap__filter-box">
            <div className="monitoring-recap__filter-group">
              <Input
                label="Pilih Tanggal Jurnal KBM"
                type="date"
                value={journalFilterDate}
                onChange={(e) => setJournalFilterDate(e.target.value)}
              />
            </div>

            {journalFilterDate && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setJournalFilterDate('')}
              >
                Reset Filter Tanggal
              </Button>
            )}
          </div>

          {/* Tabel Jurnal Mengajar */}
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Riwayat Jurnal KBM Seluruh Kelas ({filteredJournals.length} Jurnal)
              </h2>
            </div>

            <Table
              columns={journalColumns}
              data={filteredJournals}
              loading={isLoading}
              emptyMessage="Belum ada riwayat jurnal mengajar pada tanggal ini."
            />
          </div>
        </div>
      )}

      {/* MODAL PRATINJAU FOTO DOKUMENTASI KBM */}
      <Modal
        isOpen={Boolean(previewPhoto)}
        onClose={() => setPreviewPhoto(null)}
        title="Dokumentasi Pelaksanaan KBM"
        size="lg"
      >
        <div className="monitoring-recap__photo-preview">
          <img
            src={`/${previewPhoto?.photo_path || 'assets/hero.png'}`}
            alt="Dokumentasi Kelas KBM"
            className="monitoring-recap__photo-img"
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop';
            }}
          />
          <div className="monitoring-recap__photo-meta">
            <div className="text-sm font-bold text-gray-900">
              {previewPhoto?.schedule?.subject?.name} &bull; {previewPhoto?.schedule?.schoolClass?.name}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Guru Pengampu: {previewPhoto?.schedule?.teacher?.name} &bull; Tanggal: {previewPhoto?.date}
            </div>
            <div className="text-xs text-gray-700 mt-2 p-2.5 bg-gray-50 rounded border border-gray-200">
              <strong>Topik:</strong> {previewPhoto?.topic_description || '-'}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
