import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
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
  Filter,
  Info,
  RotateCcw,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import leaveApi from '../../services/leaveApi';
import journalApi from '../../services/journalApi';
import { classApi } from '../../services/masterDataApi';
import {
  Badge,
  Button,
  Modal,
  Tabs,
  Table,
  Select,
  Input,
  StatCard,
  SearchInput,
} from '../../components/shared';
import { EmptyState } from '../../components/feedback';
import { getStorageUrl } from '../../utils/formatters';
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
  const [searchQuery, setSearchQuery] = useState('');

  // Filter Jurnal
  const [journalFilterDate, setJournalFilterDate] = useState('');
  const [journalSearchQuery, setJournalSearchQuery] = useState('');
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
          classApi.getClasses({ per_page: 50 }).catch(() => ({ data: [] })),
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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (item.student?.name || '').toLowerCase();
        const nis = (item.student?.nis_nip || '').toLowerCase();
        const subject = (item.journal?.schedule?.subject?.name || '').toLowerCase();
        const className = (item.student?.schoolClass?.name || '').toLowerCase();
        if (!name.includes(q) && !nis.includes(q) && !subject.includes(q) && !className.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [attendances, filterDate, filterClass, filterStatus, searchQuery]);

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
      if (journalSearchQuery.trim()) {
        const q = journalSearchQuery.toLowerCase().trim();
        const subject = (item.schedule?.subject?.name || '').toLowerCase();
        const teacher = (item.schedule?.teacher?.name || '').toLowerCase();
        const className = (item.schedule?.schoolClass?.name || '').toLowerCase();
        const topic = (item.topic_description || '').toLowerCase();
        if (!subject.includes(q) && !teacher.includes(q) && !className.includes(q) && !topic.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [journals, journalFilterDate, journalSearchQuery]);

  // Kalkulasi Metrik Jurnal Mengajar
  const journalMetrics = useMemo(() => {
    const total = filteredJournals.length;
    const completed = filteredJournals.filter((j) => j.status === 'completed').length;
    const absent = filteredJournals.filter((j) => j.status === 'teacher_absent').length;
    const substitute = filteredJournals.filter((j) => Boolean(j.substitute_teacher_id)).length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '100.0';

    return { total, completed, absent, substitute, completionRate };
  }, [filteredJournals]);

  // Toggle Accordion Topik Materi
  const toggleTopicExpand = (id) => {
    setExpandedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Ekspor Data Presensi ke Format Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredAttendances.length === 0) {
      alert('Tidak ada data presensi untuk diekspor pada filter ini.');
      return;
    }

    const excelData = filteredAttendances.map((item, idx) => ({
      'No': idx + 1,
      'Tanggal': item.date || '-',
      'NIS': item.student?.nis_nip || '-',
      'Nama Siswa': item.student?.name || '-',
      'Kelas': item.student?.schoolClass?.name || '-',
      'Status Kehadiran': (item.status || 'Hadir').toUpperCase(),
      'Mata Pelajaran': item.journal?.schedule?.subject?.name || 'KBM Reguler',
      'Guru Pengampu': item.journal?.schedule?.teacher?.name || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set Column Widths for Excel readability
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 28 },
      { wch: 16 },
      { wch: 18 },
      { wch: 28 },
      { wch: 28 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Presensi Siswa');

    const dateSuffix = filterDate || 'Semua_Tanggal';
    const classSuffix = filterClass !== 'ALL' ? `_Kelas_${filterClass}` : '';
    const fileName = `Rekap_Presensi_Siswa_${dateSuffix}${classSuffix}.xlsx`;

    try {
      XLSX.writeFile(workbook, fileName);
    } catch {
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Ekspor Data Jurnal Mengajar ke Format Excel (.xlsx)
  const handleExportJournalExcel = () => {
    if (filteredJournals.length === 0) {
      alert('Tidak ada data jurnal mengajar untuk diekspor pada filter ini.');
      return;
    }

    const excelData = filteredJournals.map((item, idx) => ({
      'No': idx + 1,
      'Tanggal KBM': item.date || '-',
      'Kelas': item.schedule?.schoolClass?.name || '-',
      'Mata Pelajaran': item.schedule?.subject?.name || '-',
      'Guru Pengampu': item.schedule?.teacher?.name || '-',
      'Guru Pengganti': item.substitute_teacher_id ? 'Ya (Kesiswaan)' : 'Tidak',
      'Status Jurnal':
        item.status === 'completed'
          ? 'Selesai'
          : item.status === 'teacher_absent'
          ? 'Jam Kosong'
          : 'Berlangsung',
      'Topik Pembelajaran': item.topic_description || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 28 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 45 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Jurnal KBM');

    const dateSuffix = journalFilterDate || 'Semua_Tanggal';
    const fileName = `Rekap_Jurnal_Mengajar_${dateSuffix}.xlsx`;

    try {
      XLSX.writeFile(workbook, fileName);
    } catch {
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
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
          <div className="font-medium text-gray-800">{row.journal?.schedule?.subject?.name || 'KBM Kelas'}</div>
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
      <div className="mb-6">
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
        <div className="space-y-6">
          {/* Metrik Cards Kehadiran */}
          <div className="monitoring-recap__metrics">
            <StatCard
              label="Tingkat Kehadiran"
              value={`${metrics.rate}%`}
              icon={CheckCircle2}
              variant="success"
              description="Rasio kehadiran akumulatif"
            />
            <StatCard
              label="Siswa Hadir"
              value={`${metrics.hadir} Siswa`}
              icon={Users}
              variant="default"
              description="Mengikuti KBM di kelas"
            />
            <StatCard
              label="Sakit"
              value={`${metrics.sakit} Siswa`}
              icon={Clock}
              variant="info"
              description="Keterangan sakit resmi"
            />
            <StatCard
              label="Izin"
              value={`${metrics.izin} Siswa`}
              icon={Calendar}
              variant="warning"
              description="Izin terverifikasi Kesiswaan"
            />
            <StatCard
              label="Alpa / Tanpa Ket"
              value={`${metrics.alpa} Siswa`}
              icon={AlertCircle}
              variant="danger"
              description="Tidak hadir tanpa konfirmasi"
            />
          </div>

          {/* Filter Card Presensi */}
          <div className="monitoring-filter-card">
            <div className="monitoring-filter-card__header">
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-gray-500" />
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Filter &amp; Parameter Rekapitulasi Presensi
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(filterDate !== new Date().toISOString().split('T')[0] || filterClass !== 'ALL' || filterStatus !== 'ALL' || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={RotateCcw}
                    onClick={() => {
                      setFilterDate(new Date().toISOString().split('T')[0]);
                      setFilterClass('ALL');
                      setFilterStatus('ALL');
                      setSearchQuery('');
                    }}
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    Reset Filter
                  </Button>
                )}
              </div>
            </div>

            <div className="monitoring-filter-grid">
              {/* Tanggal dengan Tombol Cepat */}
              <div className="monitoring-filter-field">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">Tanggal Presensi</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterDate(new Date().toISOString().split('T')[0])}
                      className="text-[11px] text-blue-600 hover:underline cursor-pointer font-medium"
                    >
                      Hari Ini
                    </button>
                    <span className="text-gray-300">&bull;</span>
                    <button
                      type="button"
                      onClick={() => setFilterDate('')}
                      className="text-[11px] text-gray-500 hover:text-gray-800 cursor-pointer"
                    >
                      Semua
                    </button>
                  </div>
                </div>
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Filter Rombel Kelas */}
              <div className="monitoring-filter-field">
                <Select
                  label="Filter Rombel Kelas"
                  options={classOptions}
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Status Kehadiran */}
              <div className="monitoring-filter-field">
                <Select
                  label="Status Kehadiran"
                  options={[
                    { value: 'ALL', label: 'Semua Status' },
                    { value: 'Hadir', label: 'Hadir' },
                    { value: 'Sakit', label: 'Sakit' },
                    { value: 'Izin', label: 'Izin' },
                    { value: 'Alpa', label: 'Alpa / Tanpa Ket' },
                  ]}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Pencarian Nama Siswa / NIS */}
              <div className="monitoring-filter-field">
                <label className="text-xs font-semibold text-gray-700 block mb-1">Cari Data Siswa</label>
                <SearchInput
                  placeholder="Cari NIS, nama siswa..."
                  value={searchQuery}
                  onChange={(val) => setSearchQuery(typeof val === 'string' ? val : val?.target?.value || '')}
                  onClear={() => setSearchQuery('')}
                />
              </div>
            </div>

            {/* Toolbar Action: Export to Excel (.xlsx) */}
            <div className="monitoring-filter-actions">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>
                  Menampilkan <strong className="text-gray-900">{filteredAttendances.length}</strong> catatan presensi
                </span>
                {filterDate && (
                  <Badge variant="neutral" className="font-mono text-[10px]">
                    {filterDate}
                  </Badge>
                )}
                {filterClass !== 'ALL' && (
                  <Badge variant="info" className="text-[10px]">
                    Kelas: {classesList.find((c) => String(c.id) === filterClass)?.name || filterClass}
                  </Badge>
                )}
              </div>

              <Button
                variant="outline"
                size="md"
                icon={FileSpreadsheet}
                className="export-excel-btn"
                onClick={handleExportExcel}
              >
                Unduh Rekap Excel (.xlsx)
              </Button>
            </div>
          </div>

          {/* Info Callout */}
          <div className="monitoring-info-banner">
            <div className="monitoring-info-banner__icon">
              <Info size={16} />
            </div>
            <div className="monitoring-info-banner__content">
              <span className="font-semibold text-gray-900">Mekanisme Presensi Siswa:</span> Catatan presensi siswa diisi secara *real-time* oleh guru pengampu saat membuka sesi pembelajaran di kelas, atau disinkronkan otomatis dari persetujuan surat izin siswa oleh tim Kesiswaan.
            </div>
          </div>

          {/* Tabel Presensi Siswa */}
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <GraduationCap size={16} className="text-gray-600" />
                <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Daftar Presensi Siswa ({filteredAttendances.length} Baris Data)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 font-mono">
                  Tanggal: {filterDate || 'Semua Tanggal'}
                </span>
              </div>
            </div>

            <Table
              columns={attendanceColumns}
              data={filteredAttendances}
              loading={isLoading}
              emptyComponent={
                <div className="py-12 px-4">
                  <EmptyState
                    type={searchQuery ? 'search' : 'default'}
                    icon={Users}
                    title={
                      searchQuery
                        ? 'Pencarian Presensi Tidak Ditemukan'
                        : filterDate
                        ? `Belum Ada Presensi pada Tanggal ${filterDate}`
                        : 'Belum Ada Data Presensi Siswa'
                    }
                    description={
                      searchQuery
                        ? `Tidak ada catatan presensi siswa yang cocok dengan kata kunci "${searchQuery}". Silakan periksa kembali ejaan atau ganti filter pencarian.`
                        : filterDate
                        ? `Belum ada catatan presensi yang diinput untuk tanggal ${filterDate}. Guru pengampu akan menginput presensi secara otomatis saat membuka sesi KBM di kelas.`
                        : 'Belum ada data presensi yang tercatat di sistem institusi saat ini.'
                    }
                    actionLabel={
                      searchQuery
                        ? 'Bersihkan Pencarian'
                        : filterDate
                        ? 'Tampilkan Semua Tanggal'
                        : 'Pilih Tanggal Hari Ini'
                    }
                    onAction={() => {
                      if (searchQuery) setSearchQuery('');
                      else if (filterDate) setFilterDate('');
                      else setFilterDate(new Date().toISOString().split('T')[0]);
                    }}
                    compact
                  />
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* TAB 2: REKAP JURNAL MENGAJAR SEKOLAH */}
      {activeTab === 'jurnal' && (
        <div className="space-y-6">
          {/* Metrik Cards Jurnal KBM */}
          <div className="monitoring-recap__metrics monitoring-recap__metrics--jurnal">
            <StatCard
              label="Keterlaksanaan KBM"
              value={`${journalMetrics.completionRate}%`}
              icon={CheckCircle2}
              variant="success"
              description="Sesi KBM terlaksana tuntas"
            />
            <StatCard
              label="Total Sesi Jurnal"
              value={`${journalMetrics.total} Sesi`}
              icon={BookOpen}
              variant="default"
              description="Dokumentasi mengajar tercatat"
            />
            <StatCard
              label="Jam Kosong / Guru Absen"
              value={`${journalMetrics.absent} Sesi`}
              icon={AlertCircle}
              variant="danger"
              description="Sesi tanpa kehadiran guru"
            />
            <StatCard
              label="Guru Pengganti"
              value={`${journalMetrics.substitute} Sesi`}
              icon={Users}
              variant="warning"
              description="Ditangani tim kesiswaan / piket"
            />
          </div>

          {/* Filter Card Jurnal */}
          <div className="monitoring-filter-card">
            <div className="monitoring-filter-card__header">
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-gray-500" />
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Filter &amp; Parameter Jurnal Mengajar KBM
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(journalFilterDate || journalSearchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={RotateCcw}
                    onClick={() => {
                      setJournalFilterDate('');
                      setJournalSearchQuery('');
                    }}
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    Reset Filter
                  </Button>
                )}
              </div>
            </div>

            <div className="monitoring-filter-grid">
              <div className="monitoring-filter-field">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">Tanggal Jurnal KBM</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setJournalFilterDate(new Date().toISOString().split('T')[0])}
                      className="text-[11px] text-blue-600 hover:underline cursor-pointer font-medium"
                    >
                      Hari Ini
                    </button>
                    <span className="text-gray-300">&bull;</span>
                    <button
                      type="button"
                      onClick={() => setJournalFilterDate('')}
                      className="text-[11px] text-gray-500 hover:text-gray-800 cursor-pointer"
                    >
                      Semua
                    </button>
                  </div>
                </div>
                <Input
                  type="date"
                  value={journalFilterDate}
                  onChange={(e) => setJournalFilterDate(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="monitoring-filter-field sm:col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">Cari Jurnal</label>
                <SearchInput
                  placeholder="Cari mata pelajaran, kelas, guru, topik materi..."
                  value={journalSearchQuery}
                  onChange={(val) => setJournalSearchQuery(typeof val === 'string' ? val : val?.target?.value || '')}
                  onClear={() => setJournalSearchQuery('')}
                />
              </div>
            </div>

            <div className="monitoring-filter-actions">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>
                  Menampilkan <strong className="text-gray-900">{filteredJournals.length}</strong> sesi jurnal KBM
                </span>
                {journalFilterDate && (
                  <Badge variant="neutral" className="font-mono text-[10px]">
                    {journalFilterDate}
                  </Badge>
                )}
              </div>

              <Button
                variant="outline"
                size="md"
                icon={FileSpreadsheet}
                className="export-excel-btn"
                onClick={handleExportJournalExcel}
              >
                Unduh Rekap Jurnal Excel (.xlsx)
              </Button>
            </div>
          </div>

          {/* Info Callout Jurnal */}
          <div className="monitoring-info-banner">
            <div className="monitoring-info-banner__icon">
              <Info size={16} />
            </div>
            <div className="monitoring-info-banner__content">
              <span className="font-semibold text-gray-900">Mekanisme Jurnal Mengajar:</span> Seluruh guru pengampu wajib mendokumentasikan pelaksanaan materi ajar, foto kegiatan belajar mengajar di kelas, dan ringkasan topik pembelajaran secara tertib setiap selesai sesi KBM.
            </div>
          </div>

          {/* Tabel Jurnal Mengajar */}
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-gray-600" />
                <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Riwayat Jurnal KBM Seluruh Kelas ({filteredJournals.length} Jurnal)
                </h2>
              </div>
              <span className="text-[11px] text-gray-500 font-mono">
                Tanggal: {journalFilterDate || 'Semua Tanggal'}
              </span>
            </div>

            <Table
              columns={journalColumns}
              data={filteredJournals}
              loading={isLoading}
              emptyComponent={
                <div className="py-12 px-4">
                  <EmptyState
                    type={journalSearchQuery ? 'search' : 'default'}
                    icon={BookOpen}
                    title={
                      journalSearchQuery
                        ? 'Pencarian Jurnal Tidak Ditemukan'
                        : journalFilterDate
                        ? `Belum Ada Jurnal KBM pada ${journalFilterDate}`
                        : 'Belum Ada Dokumentasi Jurnal Mengajar'
                    }
                    description={
                      journalSearchQuery
                        ? `Tidak ada jurnal KBM yang cocok dengan kata kunci "${journalSearchQuery}". Silakan periksa kembali kata kunci Anda.`
                        : journalFilterDate
                        ? `Tidak ditemukan agenda KBM yang tercatat pada tanggal ${journalFilterDate}. Guru pengampu mengisi jurnal harian setelah sesi pembelajaran selesai.`
                        : 'Belum ada dokumentasi kegiatan belajar mengajar yang tersimpan di sistem institusi.'
                    }
                    actionLabel={
                      journalSearchQuery
                        ? 'Bersihkan Pencarian'
                        : journalFilterDate
                        ? 'Tampilkan Semua Tanggal'
                        : undefined
                    }
                    onAction={() => {
                      if (journalSearchQuery) setJournalSearchQuery('');
                      else if (journalFilterDate) setJournalFilterDate('');
                    }}
                    compact
                  />
                </div>
              }
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
            src={getStorageUrl(previewPhoto?.photo_path) || '/assets/hero.png'}
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
