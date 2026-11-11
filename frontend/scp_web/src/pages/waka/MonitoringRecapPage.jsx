import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Info,
  RotateCw,
  AlertCircle,
  ExternalLink,
  AlertTriangle,
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
  useToast,
} from '../../components/shared';
import { EmptyState } from '../../components/feedback';
import { getStorageUrl, getFallbackStorageUrl } from '../../utils/formatters';
import { unwrap, unwrapList } from '../../utils/responseHelper';
import { todayLocalISO } from '../../utils/dateUtils';
import ForbiddenState from '../../components/feedback/ForbiddenState';
import './MonitoringRecap.css';

export default function MonitoringRecapPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, hasRole, isKesiswaan, isWaliKelas } = useAuth();

  const [activeTab, setActiveTab] = useState('presensi'); // 'presensi' | 'jurnal'

  // Data State
  const [attendances, setAttendances] = useState([]);
  const [journals, setJournals] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Filter Presensi
  const [filterDate, setFilterDate] = useState(() => todayLocalISO());
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter Jurnal
  const [journalFilterDate, setJournalFilterDate] = useState('');
  const [journalSearchQuery, setJournalSearchQuery] = useState('');
  const [dailyRecapData, setDailyRecapData] = useState(null);
  const [expandedTopicIds, setExpandedTopicIds] = useState(new Set());
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const [photoSourceUrl, setPhotoSourceUrl] = useState('');
  const [triedFallback, setTriedFallback] = useState(false);

  const handleOpenPhotoPreview = (row) => {
    setPreviewPhoto(row);
    setPhotoLoadError(false);
    setIsPhotoLoading(true);
    setTriedFallback(false);
    setPhotoSourceUrl(getStorageUrl(row.photo_url || row.photo_path));
  };

  // Otorisasi: Waka, Kesiswaan, atau Wali Kelas
  const isAuthorized = useMemo(() => {
    return hasRole('waka') || isKesiswaan() || isWaliKelas();
  }, [hasRole, isKesiswaan, isWaliKelas]);

  // Load Data saat Mount dari API riil (P-12: allSettled + P-14: signal guard)
  const loadInitialData = useCallback(async (abortSignal) => {
    const validSignal = abortSignal instanceof AbortSignal ? abortSignal : undefined;
    if (validSignal?.aborted) return;

    setIsLoading(true);
    setLoadError(null);
    try {
      const config = validSignal ? { signal: validSignal } : {};
      const [attRes, jourRes, clsRes] = await Promise.allSettled([
        leaveApi.getAttendances({ per_page: 100 }, config),
        journalApi.getJournals({ per_page: 100 }, config),
        classApi.getClasses({ per_page: 50 }, config),
      ]);

      if (validSignal?.aborted) return;

      const isCanceled = (res) =>
        res.status === 'rejected' &&
        (res.reason?.name === 'CanceledError' || res.reason?.code === 'ERR_CANCELED');

      // Jika dibatalkan oleh AbortSignal, abaikan dan jangan set error
      if (isCanceled(attRes) || isCanceled(jourRes)) {
        return;
      }

      let hasData = false;
      const failed = [];

      if (attRes.status === 'fulfilled') {
        const attList = unwrapList(attRes.value);
        setAttendances(attList);
        hasData = true;
      } else {
        console.warn('Gagal memuat presensi:', attRes.reason);
        failed.push('presensi');
      }

      if (jourRes.status === 'fulfilled') {
        const jourList = unwrapList(jourRes.value);
        setJournals(jourList);
        hasData = true;
      } else {
        console.warn('Gagal memuat jurnal:', jourRes.reason);
        failed.push('jurnal');
      }

      if (clsRes.status === 'fulfilled') {
        const clsList = unwrapList(clsRes.value);
        setClassesList(clsList);
      }

      if (!hasData && failed.length === 2) {
        setLoadError('Gagal memuat rekap presensi dan jurnal dari server.');
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      console.warn('Gagal memuat data monitoring rekap:', err);
      setLoadError(err.message || 'Gagal memuat rekap presensi dan jurnal dari server.');
    } finally {
      if (!validSignal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadInitialData(controller.signal);
    return () => controller.abort();
  }, [loadInitialData]);

  // Muat data rekap harian KBM jika tanggal jurnal dipilih (P-9: W-3 fix + P-14: signal guard)
  const fetchDailyRecap = useCallback(async (dateStr, abortSignal) => {
    const validSignal = abortSignal instanceof AbortSignal ? abortSignal : undefined;
    if (!dateStr || validSignal?.aborted) {
      setDailyRecapData(null);
      return;
    }
    try {
      const config = validSignal ? { signal: validSignal } : {};
      const res = await journalApi.getDailyRecap({ date: dateStr }, config);
      if (validSignal?.aborted) return;
      const recap = unwrap(res);
      if (recap) {
        setDailyRecapData(recap);
      } else {
        setDailyRecapData(null);
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setDailyRecapData(null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (journalFilterDate) {
      fetchDailyRecap(journalFilterDate, controller.signal);
    } else {
      setDailyRecapData(null);
    }
    return () => controller.abort();
  }, [journalFilterDate, fetchDailyRecap]);

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
        const note = (item.notes || '').toLowerCase();
        if (!name.includes(q) && !nis.includes(q) && !subject.includes(q) && !className.includes(q) && !note.includes(q)) {
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

  // Filter Jurnal Mengajar (Semua Tanggal)
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

  // Data Tampilan Jurnal (Adaptif: Rekap Harian Kalender vs Riwayat Historis)
  const displayJournals = useMemo(() => {
    if (journalFilterDate && dailyRecapData?.items) {
      return dailyRecapData.items.filter((item) => {
        if (journalSearchQuery.trim()) {
          const q = journalSearchQuery.toLowerCase().trim();
          const subject = (item.schedule?.subject?.name || '').toLowerCase();
          const teacher = (item.schedule?.teacher?.name || '').toLowerCase();
          const className = (item.schedule?.schoolClass?.name || '').toLowerCase();
          const topic = (item.topic_description || item.exemption_reason || '').toLowerCase();
          if (!subject.includes(q) && !teacher.includes(q) && !className.includes(q) && !topic.includes(q)) {
            return false;
          }
        }
        return true;
      });
    }
    return filteredJournals;
  }, [journalFilterDate, dailyRecapData, journalSearchQuery, filteredJournals]);

  // Kalkulasi Metrik Jurnal Mengajar
  const journalMetrics = useMemo(() => {
    if (journalFilterDate && dailyRecapData) {
      return {
        total: dailyRecapData.total_mandatory ?? dailyRecapData.items?.length ?? 0,
        completed: dailyRecapData.completed_count ?? 0,
        absent: dailyRecapData.absent_count ?? 0,
        exempted: dailyRecapData.exempted_count ?? 0,
        substitute: dailyRecapData.items?.filter((j) => Boolean(j.substitute_teacher_id)).length ?? 0,
        completionRate: dailyRecapData.compliance_rate ?? '0.0',
        effectiveMandatory: dailyRecapData.effective_mandatory ?? 0,
        isDailyRecap: true,
      };
    }

    const total = filteredJournals.length;
    const completed = filteredJournals.filter((j) => j.status === 'completed').length;
    const absent = filteredJournals.filter((j) => j.status === 'teacher_absent').length;
    const substitute = filteredJournals.filter((j) => Boolean(j.substitute_teacher_id)).length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '100.0';

    return {
      total,
      completed,
      absent,
      substitute,
      completionRate,
      exempted: 0,
      effectiveMandatory: total,
      isDailyRecap: false,
    };
  }, [journalFilterDate, dailyRecapData, filteredJournals]);

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
      toast.warning('Tidak ada data presensi untuk diekspor pada filter ini.');
      return;
    }

    const excelData = filteredAttendances.map((item, idx) => ({
      'No': idx + 1,
      'Tanggal': item.date || '-',
      'NIS': item.student?.nis_nip || '-',
      'Nama Siswa': item.student?.name || '-',
      'Kelas': item.student?.schoolClass?.name || '-',
      'Status Kehadiran': (item.status || 'Hadir').toUpperCase(),
      'Catatan Siswa': item.notes || '-',
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
    toast.success('Data presensi berhasil diekspor ke Excel.');
  };

  // Ekspor Data Jurnal Mengajar ke Format Excel (.xlsx)
  const handleExportJournalExcel = () => {
    const sourceData = displayJournals;
    if (sourceData.length === 0) {
      toast.warning('Tidak ada data jurnal mengajar untuk diekspor pada filter ini.');
      return;
    }

    const excelData = sourceData.map((item, idx) => ({
      'No': idx + 1,
      'Tanggal KBM': item.date || journalFilterDate || '-',
      'Kelas': item.schedule?.schoolClass?.name || '-',
      'Mata Pelajaran': item.schedule?.subject?.name || '-',
      'Guru Pengampu': item.schedule?.teacher?.name || '-',
      'Guru Pengganti': item.substitute_teacher_id ? 'Ya (Kesiswaan)' : 'Tidak',
      'Status Jurnal':
        item.status === 'completed'
          ? 'Selesai'
          : item.status === 'teacher_absent'
          ? 'Jam Kosong'
          : item.status === 'exempted'
          ? `Dikecualikan (${item.exemption_reason || 'Agenda Khusus'})`
          : item.status === 'unfilled'
          ? 'Belum Terisi'
          : 'Berlangsung',
      'Topik Pembelajaran': item.status === 'exempted'
        ? `[Dikecualikan] ${item.exemption_reason || 'Kegiatan Kalender'}`
        : item.topic_description || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 28 },
      { wch: 28 },
      { wch: 18 },
      { wch: 24 },
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
    toast.success('Data jurnal mengajar berhasil diekspor ke Excel.');
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
        if (s === 'hadir') return <Badge variant="success" dot>Hadir</Badge>;
        if (s === 'sakit') return <Badge variant="info" dot>Sakit</Badge>;
        if (s === 'izin') return <Badge variant="warning" dot>Izin</Badge>;
        return <Badge variant="error" dot>Alpa</Badge>;
      },
    },
    {
      key: 'notes',
      label: 'Catatan Siswa',
      renderCell: (row) =>
        row.notes ? (
          <span
            className="text-xs text-amber-900 bg-amber-50 border border-amber-200/80 rounded px-2 py-0.5 inline-block max-w-[200px] truncate font-medium"
            title={row.notes}
          >
            {row.notes}
          </span>
        ) : (
          <span className="text-gray-400 text-xs italic">-</span>
        ),
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
        if (row.status === 'completed') return <Badge variant="success" dot>Selesai</Badge>;
        if (row.status === 'teacher_absent') return <Badge variant="danger" dot>Jam Kosong</Badge>;
        if (row.status === 'exempted') {
          return (
            <Badge variant="warning" dot>
              Dikecualikan{row.exemption_reason ? `: ${row.exemption_reason}` : ''}
            </Badge>
          );
        }
        if (row.status === 'unfilled') return <Badge variant="danger" dot>Belum Terisi</Badge>;
        return <Badge variant="neutral" dot>Sedang Berlangsung</Badge>;
      },
    },
    {
      key: 'topic',
      label: 'Topik Pembelajaran',
      renderCell: (row) => {
        if (row.status === 'exempted') {
          return (
            <div className="text-xs text-amber-800 italic">
              KBM ditiadakan ({row.exemption_reason || 'Agenda Kalender Akademik'})
            </div>
          );
        }
        if (row.status === 'unfilled') {
          return (
            <div className="text-xs text-rose-600 italic">
              Guru pengampu belum mengisi jurnal KBM
            </div>
          );
        }
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
      renderCell: (row) => {
        if (row.status === 'exempted') {
          return <span className="text-gray-400 text-xs italic">Dikecualikan</span>;
        }
        if (row.status === 'unfilled') {
          return <span className="text-rose-400 text-xs italic">Belum ada</span>;
        }
        return (row.photo_url || row.photo_path) ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-medium cursor-pointer transition-colors"
            onClick={() => handleOpenPhotoPreview(row)}
          >
            <ImageIcon size={13} className="text-gray-500" />
            <span>Lihat Foto</span>
          </button>
        ) : (
          <span className="text-gray-400 text-xs italic">Tanpa foto</span>
        );
      },
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
          <Badge variant="default">Tahun Ajaran {user?.academic_year || '2025/2026 Ganjil'}</Badge>
        </div>
      </div>

      {/* Error Alert Banner with Retry */}
      {loadError && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#991b1b', fontSize: '0.875rem' }}>
            <AlertCircle style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
            <span>{loadError}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadInitialData()}>
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Tabs Menu Utama: Rekap Presensi vs Jurnal Mengajar */}
      <div className="mb-6">
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'presensi', label: 'Rekap Presensi Siswa' },
            { id: 'jurnal', label: 'Rekap Jurnal Mengajar Sekolah' },
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
              accentBorder
              variant="success"
              statusDot="success"
              description="Rasio kehadiran akumulatif"
            />
            <StatCard
              label="Siswa Hadir"
              value={`${metrics.hadir} Siswa`}
              accentBorder
              variant="default"
              statusDot="neutral"
              description="Mengikuti KBM di kelas"
            />
            <StatCard
              label="Sakit"
              value={`${metrics.sakit} Siswa`}
              accentBorder
              variant="info"
              statusDot="info"
              description="Keterangan sakit resmi"
            />
            <StatCard
              label="Izin"
              value={`${metrics.izin} Siswa`}
              accentBorder
              variant="warning"
              statusDot="warning"
              description="Izin terverifikasi Kesiswaan"
            />
            <StatCard
              label="Alpa / Tanpa Ket"
              value={`${metrics.alpa} Siswa`}
              accentBorder
              variant="danger"
              statusDot="danger"
              description="Tidak hadir tanpa konfirmasi"
            />
          </div>

          {/* Filter Card Presensi */}
          <div className="monitoring-filter-card">
            <div className="monitoring-filter-card__header">
              <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Filter &amp; Parameter Rekapitulasi Presensi
              </span>
              <div className="flex items-center gap-2">
                {(filterDate !== todayLocalISO() || filterClass !== 'ALL' || filterStatus !== 'ALL' || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterDate(todayLocalISO());
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
                      onClick={() => setFilterDate(todayLocalISO())}
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
              pageSize={25}
              isLoading={isLoading}
              emptyComponent={
                <div className="py-12 px-4">
                  <EmptyState
                    type={searchQuery ? 'search' : 'default'}
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
                      else setFilterDate(todayLocalISO());
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
              label={journalMetrics.isDailyRecap ? 'Kepatuhan Jurnal KBM' : 'Keterlaksanaan KBM'}
              value={`${journalMetrics.completionRate}%`}
              accentBorder
              variant="success"
              statusDot="success"
              description={
                journalMetrics.isDailyRecap
                  ? `${journalMetrics.completed} dari ${journalMetrics.effectiveMandatory} wajib terlaksana`
                  : 'Sesi KBM terlaksana tuntas'
              }
            />
            <StatCard
              label={journalMetrics.isDailyRecap ? 'Total Jadwal Wajib' : 'Total Sesi Jurnal'}
              value={`${journalMetrics.total} Sesi`}
              accentBorder
              variant="default"
              statusDot="neutral"
              description={
                journalMetrics.isDailyRecap
                  ? `${journalMetrics.effectiveMandatory} wajib diisi guru`
                  : 'Dokumentasi mengajar tercatat'
              }
            />
            {journalMetrics.isDailyRecap ? (
              <StatCard
                label="Dikecualikan Agenda"
                value={`${journalMetrics.exempted} Sesi`}
                accentBorder
                variant="warning"
                statusDot="warning"
                description="KBM ditiadakan kalender"
              />
            ) : (
              <StatCard
                label="Guru Pengganti"
                value={`${journalMetrics.substitute} Sesi`}
                accentBorder
                variant="warning"
                statusDot="warning"
                description="Ditangani tim kesiswaan / piket"
              />
            )}
            <StatCard
              label="Jam Kosong / Guru Absen"
              value={`${journalMetrics.absent} Sesi`}
              accentBorder
              variant="danger"
              statusDot="danger"
              description="Sesi tanpa kehadiran guru"
            />
          </div>

          {/* Filter Card Jurnal */}
          <div className="monitoring-filter-card">
            <div className="monitoring-filter-card__header">
              <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Filter &amp; Parameter Jurnal Mengajar KBM
              </span>
              <div className="flex items-center gap-2">
                {(journalFilterDate || journalSearchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
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
                      onClick={() => setJournalFilterDate(todayLocalISO())}
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
                  Menampilkan <strong className="text-gray-900">{displayJournals.length}</strong> sesi jurnal KBM
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
                <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Riwayat Jurnal KBM Seluruh Kelas ({displayJournals.length} Jurnal)
                </h2>
              </div>
              <span className="text-[11px] text-gray-500 font-mono">
                Tanggal: {journalFilterDate || 'Semua Tanggal'}
              </span>
            </div>

            <Table
              columns={journalColumns}
              data={displayJournals}
              pageSize={25}
              isLoading={isLoading}
              emptyComponent={
                <div className="py-12 px-4">
                  <EmptyState
                    type={journalSearchQuery ? 'search' : 'default'}
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
        onClose={() => {
          setPreviewPhoto(null);
          setPhotoLoadError(false);
          setIsPhotoLoading(false);
          setTriedFallback(false);
        }}
        title="Dokumentasi Pelaksanaan KBM"
        size="lg"
      >
        <div className="monitoring-recap__photo-preview">
          {/* Kondisi 1: Tidak Ada Foto Dokumentasi Terlampir */}
          {!previewPhoto?.photo_path && !previewPhoto?.photo_url ? (
            <div className="py-14 px-6 flex flex-col items-center justify-center text-center bg-gray-50/70">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3 border border-gray-200">
                <ImageIcon size={24} />
              </div>
              <h4 className="text-sm font-bold text-gray-800">Tidak Ada Foto Dokumentasi</h4>
              <p className="text-xs text-gray-500 max-w-sm mt-1">
                Sesi pembelajaran ini belum memiliki berkas foto dokumentasi KBM yang diunggah ke sistem.
              </p>
            </div>
          ) : (
            <div className="monitoring-recap__photo-container">
              {/* Overlay Indikator Loading */}
              {isPhotoLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 text-white gap-2.5">
                  <RotateCw size={26} className="animate-spin text-[#FFDE00]" />
                  <span className="text-xs text-slate-300 font-medium">
                    Mengambil foto dokumentasi dari Supabase Storage...
                  </span>
                </div>
              )}

              {/* Tampilan Kondisi Gagal Dimuat (Error State) */}
              {photoLoadError ? (
                <div className="py-12 px-6 flex flex-col items-center justify-center text-center text-slate-200">
                  <div className="w-12 h-12 rounded-full bg-red-950/70 border border-red-700/60 text-red-400 flex items-center justify-center mb-3">
                    <AlertTriangle size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-white">Foto Dokumentasi Gagal Dimuat</h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Berkas foto di Supabase Storage tidak dapat diakses atau terjadi kendala koneksi jaringan.
                  </p>
                  <div className="flex items-center gap-2.5 mt-4">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-white border border-slate-600 font-semibold transition cursor-pointer flex items-center gap-1.5"
                      onClick={() => {
                        setPhotoLoadError(false);
                        setIsPhotoLoading(true);
                        const separator = photoSourceUrl.includes('?') ? '&' : '?';
                        setPhotoSourceUrl(`${photoSourceUrl.split('?')[0]}${separator}_t=${Date.now()}`);
                      }}
                    >
                      <RotateCw size={12} /> Muat Ulang
                    </button>
                    {!triedFallback && (
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded bg-[#FFDE00] hover:bg-[#FFE63B] text-xs text-slate-900 font-bold transition cursor-pointer"
                        onClick={() => {
                          setTriedFallback(true);
                          setPhotoLoadError(false);
                          setIsPhotoLoading(true);
                          setPhotoSourceUrl(getFallbackStorageUrl(previewPhoto?.photo_path));
                        }}
                      >
                        Coba Cadangan Server Lokal
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <img
                  src={photoSourceUrl}
                  alt={`Dokumentasi KBM ${previewPhoto?.schedule?.subject?.name || ''}`}
                  className={`monitoring-recap__photo-img transition-opacity duration-300 ${
                    isPhotoLoading ? 'opacity-0' : 'opacity-100'
                  }`}
                  onLoad={() => setIsPhotoLoading(false)}
                  onError={() => {
                    setIsPhotoLoading(false);
                    if (!triedFallback) {
                      setTriedFallback(true);
                      const fallback = getFallbackStorageUrl(previewPhoto?.photo_path);
                      if (fallback && fallback !== photoSourceUrl) {
                        setIsPhotoLoading(true);
                        setPhotoSourceUrl(fallback);
                        return;
                      }
                    }
                    setPhotoLoadError(true);
                  }}
                />
              )}
            </div>
          )}

          {/* Meta Data Dokumentasi Terkait */}
          <div className="monitoring-recap__photo-meta">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {previewPhoto?.schedule?.subject?.name || 'Mata Pelajaran'} &bull; {previewPhoto?.schedule?.schoolClass?.name || 'Kelas'}
                </div>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>Guru Pengampu: <strong>{previewPhoto?.schedule?.teacher?.name || '-'}</strong></span>
                  {previewPhoto?.substitute_teacher_id && (
                    <span className="px-1.5 py-0.2 rounded text-[10.5px] bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                      Diisi Guru Pengganti (Kesiswaan)
                    </span>
                  )}
                  <span>&bull;</span>
                  <span>Tanggal KBM: <strong>{previewPhoto?.date}</strong></span>
                </div>
              </div>

              {photoSourceUrl && !photoLoadError && (
                <a
                  href={photoSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 flex items-center gap-1 shrink-0 transition"
                  title="Buka foto asli di tab baru"
                >
                  <ExternalLink size={12} /> Buka Foto Asli
                </a>
              )}
            </div>

            <div className="text-xs text-gray-700 mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 leading-relaxed">
              <span className="font-bold text-gray-900 block mb-0.5">Topik Pembelajaran:</span>
              <span>{previewPhoto?.topic_description || '-'}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
