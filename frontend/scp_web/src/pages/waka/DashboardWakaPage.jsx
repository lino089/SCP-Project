import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  User,
  AlertCircle,
  Edit2,
  RotateCw,
  ChevronDown,
} from 'lucide-react';
import {
  Button,
  Table,
  Badge,
  PasswordModal,
  Modal,
  Input,
  Select,
  StatCard,
  ProgressBar,
} from '../../components/shared';
import { academicSettingApi, scheduleApi } from '../../services/scheduleApi';
import { masterDataSummaryApi } from '../../services/masterDataApi';
import academicEventApi from '../../services/academicEventApi';
import { unwrap, unwrapList } from '../../utils/responseHelper';
import { todayLocalISO } from '../../utils/dateUtils';
import './DashboardWaka.css';

export default function DashboardWakaPage() {
  const navigate = useNavigate();

  // Settings states
  const [activeCycle, setActiveCycle] = useState(1);
  const [mondayIsUpacara, setMondayIsUpacara] = useState(true);
  const [academicYear, setAcademicYear] = useState('2025/2026 Ganjil');
  const [semester, setSemester] = useState('Ganjil');

  // Master Data summary stats
  const [summaryData, setSummaryData] = useState({
    classes: 0,
    rooms: 0,
    subjects: 0,
    teachers: 0,
    students: 0,
    schedules: 0,
  });

  // Cycle History list
  const [historyList, setHistoryList] = useState([]);

  // Missing journals
  const [missingJournals, setMissingJournals] = useState([]);

  // Agenda Kalender Akademik Hari Ini
  const [todayEvents, setTodayEvents] = useState([]);

  // Riwayat putaran (audit log) — dilipat secara default
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Loading & Feedback states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [sectionErrors, setSectionErrors] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Edit Academic Year Modal state
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [inputAcademicYear, setInputAcademicYear] = useState('2025/2026');
  const [inputSemester, setInputSemester] = useState('Ganjil');

  // Password confirmation modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: '',
    description: '',
    pendingAction: null, // { type: 'cycle' | 'upacara' | 'year', target: any }
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const showFeedback = (msg) => {
    setFeedbackMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setFeedbackMessage(null);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // Load initial data dari database riil (P-11: todayLocalISO, P-12: allSettled + per-section error)
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const todayStr = todayLocalISO();
      const [settingsRes, sumRes, historyRes, missingRes, eventRes] = await Promise.allSettled([
        academicSettingApi.getSettings(),
        masterDataSummaryApi.getSummary(),
        academicSettingApi.getCycleHistory(),
        scheduleApi.getMissingJournals(),
        academicEventApi.checkExemption({ date: todayStr }),
      ]);

      const errors = {};

      // Agenda Kalender Akademik Hari Ini
      if (eventRes.status === 'fulfilled') {
        const exData = unwrap(eventRes.value);
        const activeEvts = exData?.active_events || [];
        setTodayEvents(activeEvts);
      } else {
        setTodayEvents([]);
      }

      // 1. Settings
      if (settingsRes.status === 'fulfilled') {
        const sData = unwrap(settingsRes.value);
        if (sData) {
          setActiveCycle(Number(sData.active_cycle || 1));
          setMondayIsUpacara(Boolean(sData.monday_is_upacara));
          if (sData.academic_year) setAcademicYear(sData.academic_year);
          if (sData.semester) setSemester(sData.semester);
        }
      } else {
        errors.settings = 'Gagal memuat pengaturan akademik.';
      }

      // 2. Master Data Summary
      if (sumRes.status === 'fulfilled') {
        const sumData = unwrap(sumRes.value);
        if (sumData) setSummaryData(sumData);
      } else {
        errors.summary = 'Gagal memuat statistik master data.';
      }

      // 3. Cycle History
      if (historyRes.status === 'fulfilled') {
        const histList = unwrapList(historyRes.value);
        setHistoryList(histList);
      } else {
        errors.history = 'Gagal memuat riwayat siklus.';
      }

      // 4. Missing Journals
      if (missingRes.status === 'fulfilled') {
        const raw = unwrapList(missingRes.value);
        const formatted = raw.map((item) => ({
          id: item.id,
          className: item.school_class?.name || item.className || 'Kelas',
          teacherName: item.teacher?.name || item.teacherName || 'Guru',
          subjectName: item.subject?.name || item.subjectName || 'Mata Pelajaran',
          period: `Jam Ke-${item.period_number || item.slot || 1}`,
        }));
        setMissingJournals(formatted);
      } else {
        setMissingJournals([]);
      }

      setSectionErrors(errors);

      // Hanya error global jika semua endpoint utama gagal
      if (settingsRes.status === 'rejected' && sumRes.status === 'rejected') {
        setLoadError('Gagal memuat seluruh data dashboard waka.');
      }
    } catch (err) {
      console.warn('Gagal memuat data dashboard waka:', err);
      setLoadError(err.message || 'Gagal memuat data pengaturan dan ringkasan akademik.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Trigger cycle change request
  const handleRequestCycleChange = (targetCycle) => {
    if (targetCycle === activeCycle) return;
    setModalError('');
    setModalConfig({
      title: 'Konfirmasi Penggantian Putaran Jadwal',
      description: `Anda akan mengubah jadwal aktif dari Putaran ${activeCycle} ke Putaran ${targetCycle}. Tindakan ini berdampak pada seluruh jadwal KBM aktif sekolah. Masukkan kata sandi akun untuk verifikasi.`,
      pendingAction: { type: 'cycle', target: targetCycle },
    });
    setModalOpen(true);
  };

  // Trigger monday ceremony toggle request
  const handleRequestUpacaraToggle = () => {
    const nextStatus = !mondayIsUpacara;
    setModalError('');
    setModalConfig({
      title: 'Konfirmasi Perubahan Status Upacara',
      description: `Anda akan mengubah status Upacara Hari Senin menjadi ${
        nextStatus ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'
      }. Perubahan ini memengaruhi alokasi jam pelajaran pertama pada hari Senin. Masukkan kata sandi akun untuk verifikasi.`,
      pendingAction: { type: 'upacara', target: nextStatus },
    });
    setModalOpen(true);
  };

  // Open Edit Academic Year Modal
  const handleOpenYearModal = () => {
    const parts = academicYear.split(' ');
    setInputAcademicYear(parts[0] || '2025/2026');
    setInputSemester(semester || parts[1] || 'Ganjil');
    setIsYearModalOpen(true);
  };

  // Submit Year Edit -> Request Password
  const handleSubmitYearEdit = (e) => {
    e.preventDefault();
    if (!inputAcademicYear.trim()) {
      showError('Format tahun ajaran tidak boleh kosong.');
      return;
    }
    const combinedYear = `${inputAcademicYear.trim()} ${inputSemester}`;
    setIsYearModalOpen(false);
    setModalError('');
    setModalConfig({
      title: 'Konfirmasi Penetapan Tahun Ajaran Baru',
      description: `Anda akan menetapkan Tahun Ajaran Aktif sekolah menjadi "${combinedYear}". Informasi ini akan ditampilkan di seluruh portal siswa, guru, dan orang tua. Masukkan kata sandi akun untuk verifikasi.`,
      pendingAction: {
        type: 'year',
        target: {
          academicYear: combinedYear,
          semester: inputSemester,
        },
      },
    });
    setModalOpen(true);
  };

  // Confirm password action (Step-Up Auth)
  const handleConfirmPassword = async (password) => {
    setModalLoading(true);
    setModalError('');

    try {
      if (modalConfig.pendingAction?.type === 'cycle') {
        const target = modalConfig.pendingAction.target;
        await academicSettingApi.updateCycle({ cycle_type: target, password });

        setActiveCycle(target);
        // Refresh cycle history from database
        try {
          const histRes = await academicSettingApi.getCycleHistory();
          const list = unwrapList(histRes);
          setHistoryList(list);
        } catch {
          // ignore
        }
        setModalOpen(false);
        showFeedback(`Berhasil mengubah jadwal aktif menjadi Putaran ${target}.`);
      } else if (modalConfig.pendingAction?.type === 'upacara') {
        const nextStatus = modalConfig.pendingAction.target;
        await academicSettingApi.updateMondayStatus({ is_upacara: nextStatus, password });

        setMondayIsUpacara(nextStatus);
        setModalOpen(false);
        showFeedback(
          `Status Upacara Hari Senin berhasil diubah ke ${nextStatus ? 'AKTIF' : 'NONAKTIF'}.`
        );
      } else if (modalConfig.pendingAction?.type === 'year') {
        const { academicYear: targetYear, semester: targetSem } = modalConfig.pendingAction.target;
        await academicSettingApi.updateAcademicYear({
          academic_year: targetYear,
          semester: targetSem,
          password,
        });

        setAcademicYear(targetYear);
        setSemester(targetSem);
        setModalOpen(false);
        showFeedback(`Tahun Ajaran aktif berhasil ditetapkan menjadi "${targetYear}".`);
      }
    } catch (apiErr) {
      const msg = apiErr.message || apiErr.response?.data?.message;
      setModalError(msg || 'Kata sandi verifikasi tidak valid atau permintaan gagal.');
    } finally {
      setModalLoading(false);
    }
  };

  // Columns for Cycle History Log Table
  const historyColumns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      renderCell: (_, index) => (
        <span className="font-mono text-[12px] text-gray-400">
          {String(index + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'from_cycle',
      label: 'Dari Putaran',
      align: 'center',
      renderCell: (row) => <Badge variant="neutral">Putaran {row.from_cycle || row.cycle_number || 1}</Badge>,
    },
    {
      key: 'to_cycle',
      label: 'Ke Putaran',
      align: 'center',
      renderCell: (row) => <Badge variant="default">Putaran {row.to_cycle || row.cycle_number || 1}</Badge>,
    },
    {
      key: 'changed_at',
      label: 'Waktu Perubahan',
      align: 'left',
      renderCell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-gray-700">
          <Clock size={13} className="text-gray-400" />
          <span className="font-mono text-[12px] text-gray-700">{row.changed_at || row.started_at || '-'}</span>
        </span>
      ),
    },
    {
      key: 'changed_by',
      label: 'Diubah Oleh',
      align: 'left',
      renderCell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-gray-900 font-medium">
          <User size={13} className="text-gray-400" />
          {row.changed_by?.name || row.changedBy?.name || 'Waka Kurikulum'}
        </span>
      ),
    },
  ];

  // Rasio kepatuhan pengisian jurnal hari ini (slot terjadwal vs sesi belum berjurnal)
  const totalSessions = Number(summaryData.schedules) || 0;
  const journalCompliance =
    totalSessions > 0
      ? ((totalSessions - Math.min(missingJournals.length, totalSessions)) / totalSessions) * 100
      : missingJournals.length === 0
      ? 100
      : 0;

  return (
    <div className="dashboard-container">
      {/* Feedback Toast */}
      {feedbackMessage && (
        <div className="dashboard-toast" role="status">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="dashboard-toast dashboard-toast--error" role="alert">
          <AlertCircle size={16} className="text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="dashboard-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="dashboard-title">Dashboard Akademik</h1>
          <p className="dashboard-subtitle">
            Kelola tahun ajaran aktif, siklus rotasi KBM, status upacara, dan ringkasan master data sekolah.
          </p>
        </div>
        <div className="dashboard-header-actions w-full sm:w-auto flex justify-start sm:justify-end gap-2">
          <Button
            variant="primary"
            onClick={() => navigate('/kurikulum/jadwal/import')}
          >
            Import Jadwal
          </Button>
        </div>
      </div>

      {/* Error Alert Banner with Retry */}
      {loadError && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#991b1b', fontSize: '0.875rem' }}>
            <AlertCircle style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
            <span>{loadError}</span>
          </div>
          <Button size="sm" variant="outline" onClick={loadDashboardData}>
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* ── Status Strip: keadaan akademik hari ini ────────────────────────── */}
      <div className="dw-status-strip">
        {/* Tahun Ajaran Aktif */}
        <div className="dw-cell">
          <div className="dw-cell-head">
            <span className="dw-label">
              <span className="dw-label-dot dw-label-dot--neutral" />
              <span className="dw-cell-label">Tahun Ajaran</span>
            </span>
            <Badge variant="default">{semester}</Badge>
          </div>
          <div className="dw-cell-value font-mono">{academicYear}</div>
          <div className="dw-cell-foot">
            <Button size="sm" variant="secondary" icon={Edit2} onClick={handleOpenYearModal}>
              Ubah
            </Button>
          </div>
        </div>

        {/* Putaran Jadwal Aktif */}
        <div className="dw-cell">
          <div className="dw-cell-head">
            <span className="dw-label">
              <span className="dw-label-dot dw-label-dot--neutral" />
              <span className="dw-cell-label">Putaran Jadwal</span>
            </span>
            <Badge variant="default" dot>
              Putaran {activeCycle}
            </Badge>
          </div>
          <div className="dw-cell-value">Siklus rotasi KBM mingguan</div>
          <div className="dw-cell-foot">
            <div className="inline-flex items-center bg-gray-100 p-1 rounded-md gap-1 w-fit">
              <button
                type="button"
                className={`px-3 py-1 rounded text-[12px] transition-all cursor-pointer ${
                  activeCycle === 1
                    ? 'bg-white text-gray-900 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 font-normal'
                }`}
                onClick={() => handleRequestCycleChange(1)}
              >
                Putaran 1
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded text-[12px] transition-all cursor-pointer ${
                  activeCycle === 2
                    ? 'bg-white text-gray-900 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 font-normal'
                }`}
                onClick={() => handleRequestCycleChange(2)}
              >
                Putaran 2
              </button>
            </div>
          </div>
        </div>

        {/* Status Upacara Hari Senin */}
        <div className="dw-cell">
          <div className="dw-cell-head">
            <span className="dw-label">
              <span className={`dw-label-dot ${mondayIsUpacara ? 'dw-label-dot--success' : 'dw-label-dot--neutral'}`} />
              <span className="dw-cell-label">Upacara Senin</span>
            </span>
            <Badge variant={mondayIsUpacara ? 'success' : 'neutral'} dot>
              {mondayIsUpacara ? 'Aktif' : 'Nonaktif'}
            </Badge>
          </div>
          <div className="dw-cell-value">
            {mondayIsUpacara ? 'Jam ke-1 · mulai 08:00' : 'KBM normal · mulai 07:15'}
          </div>
          <div className="dw-cell-foot">
            <Button size="sm" variant="secondary" onClick={handleRequestUpacaraToggle}>
              {mondayIsUpacara ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
          </div>
        </div>

        {/* Agenda Kalender Akademik Hari Ini */}
        <div className="dw-cell">
          <div className="dw-cell-head">
            <span className="dw-label">
              <span className={`dw-label-dot ${todayEvents.length > 0 ? 'dw-label-dot--warning' : 'dw-label-dot--neutral'}`} />
              <span className="dw-cell-label">Agenda Hari Ini</span>
            </span>
            <Badge variant={todayEvents.length > 0 ? 'warning' : 'neutral'} dot>
              {todayEvents.length > 0 ? `${todayEvents.length} Agenda` : 'Kosong'}
            </Badge>
          </div>
          <div className="dw-cell-value">
            {todayEvents.length > 0 ? todayEvents[0].title : 'Tidak ada agenda khusus'}
          </div>
          <div className="dw-cell-meta">
            {todayEvents.length > 0 && (
              <>
                <span className="dw-scope-tag">
                  {todayEvents[0].scope_type === 'all'
                    ? 'Seluruh Sekolah'
                    : todayEvents[0].scope_type === 'grade'
                    ? `Tingkat ${todayEvents[0].scope_targets?.join(', ')}`
                    : 'Rombel Tertentu'}
                </span>
                {todayEvents[0].disables_teaching ? (
                  <span className="dw-kbm-tag dw-kbm-tag--off">KBM Ditiadakan</span>
                ) : (
                  <span className="dw-kbm-tag dw-kbm-tag--on">KBM Berjalan</span>
                )}
                {todayEvents.length > 1 && (
                  <span className="dw-cell-note">+{todayEvents.length - 1} lainnya</span>
                )}
              </>
            )}
          </div>
          <div className="dw-cell-foot">
            <Button size="sm" variant="secondary" onClick={() => navigate('/web/academic-calendar')}>
              Kelola Kalender
            </Button>
          </div>
        </div>
      </div>

      {/* ── Split Prioritas: aksi hari ini (kiri) + rail metrik (kanan) ─────── */}
      <div className="dw-split">
        {/* HERO: Perlu Perhatian Hari Ini */}
        <section className="dw-hero">
          <div className="dw-hero-head">
            <div>
              <span className="dw-eyebrow">Prioritas Harian</span>
              <h2 className="dashboard-section-title">Perlu Perhatian Hari Ini</h2>
              <p className="dashboard-section-desc">
                Sesi KBM yang belum menyelesaikan jurnal mengajar hari ini (&gt; 30 menit).
              </p>
            </div>
            <Badge variant={missingJournals.length > 0 ? 'warning' : 'success'} dot>
              {missingJournals.length > 0 ? `${missingJournals.length} Sesi` : 'Semua Lengkap'}
            </Badge>
          </div>

          <div className="dashboard-row-cards-list">
            {missingJournals.length === 0 ? (
              <div className="dashboard-empty-row dw-empty-state">
                <span className="dw-empty-state-icon">
                  <CheckCircle2 size={18} />
                </span>
                <span className="dw-empty-state-title">Semua jurnal hari ini sudah terisi</span>
                <span className="dw-empty-state-desc">
                  Tidak ada sesi KBM yang melewati batas 30 menit tanpa jurnal mengajar.
                </span>
              </div>
            ) : (
              missingJournals.map((journal) => (
                <div
                  key={journal.id}
                  className="dashboard-row-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
                >
                  <div className="dashboard-row-card-left flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">Kelas {journal.className}</Badge>
                    <span className="text-[13px] font-semibold text-gray-900">
                      {journal.teacherName}
                    </span>
                    <span className="text-[13px] font-normal text-gray-500">
                      &bull; {journal.subjectName}
                    </span>
                    <span className="text-[11px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                      {journal.period}
                    </span>
                  </div>
                  <div className="dashboard-row-card-right flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                    <Badge variant="error">Belum Diisi</Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        showFeedback(`Pengingat KBM berhasil dikirimkan ke ${journal.teacherName}.`)
                      }
                    >
                      Kirim Pengingat
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* RAIL: kepatuhan jurnal + metrik referensi */}
        <aside className="dw-rail">
          <StatCard
            title={
              <span className="dw-label">
                <span
                  className={`dw-label-dot ${
                    missingJournals.length > 0 ? 'dw-label-dot--warning' : 'dw-label-dot--success'
                  }`}
                />
                <span>Jurnal Hari Ini</span>
              </span>
            }
            value={missingJournals.length}
            unit="sesi belum diisi"
            description="Monitoring keterlambatan pengisian jurnal KBM (> 30 menit)."
            badge={missingJournals.length > 0 ? `${missingJournals.length} Terlambat` : 'Lengkap'}
            badgeVariant={missingJournals.length > 0 ? 'warning' : 'success'}
            footer={
              <div className="dw-rail-stack">
                <ProgressBar
                  value={journalCompliance}
                  label={
                    totalSessions > 0
                      ? `Sesi berjurnal · ${totalSessions - missingJournals.length}/${totalSessions}`
                      : 'Sesi berjurnal'
                  }
                  showValue={false}
                  color={missingJournals.length > 0 ? 'error' : 'success'}
                />
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => navigate('/web/schedules')}
                >
                  Lihat Matriks Jadwal
                </Button>
              </div>
            }
          />

          <div className="dashboard-flat-card dw-master-card">
            <div className="dashboard-card-top">
              <span className="dw-label">
                <span className="dw-label-dot dw-label-dot--info" />
                <span className="dashboard-card-label">Master Data Sekolah</span>
              </span>
              <Badge variant="default">Referensi</Badge>
            </div>
            <div className="dw-metric-pairs">
              <div className="dw-metric-pair">
                <span className="dw-metric-pair-label">Guru</span>
                <span className="dw-metric-pair-value">{summaryData.teachers ?? 0}</span>
              </div>
              <div className="dw-metric-pair">
                <span className="dw-metric-pair-label">Siswa</span>
                <span className="dw-metric-pair-value">{summaryData.students ?? 0}</span>
              </div>
              <div className="dw-metric-pair">
                <span className="dw-metric-pair-label">Rombel</span>
                <span className="dw-metric-pair-value">{summaryData.classes ?? 0}</span>
              </div>
              <div className="dw-metric-pair">
                <span className="dw-metric-pair-label">Slot KBM</span>
                <span className="dw-metric-pair-value">{summaryData.schedules ?? 0}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Audit bar: riwayat perubahan putaran (dilipat) ──────────────────── */}
      <div className="dw-audit">
        <button
          type="button"
          className="dw-audit-bar"
          aria-expanded={isHistoryOpen}
          onClick={() => setIsHistoryOpen((prev) => !prev)}
        >
          <span className="dw-audit-left">
            <Clock size={14} className="dw-audit-icon" />
            <span className="dw-audit-titles">
              <span className="dw-audit-title">Riwayat Perubahan Putaran Jadwal</span>
              <span className="dw-audit-meta">
                {historyList.length} catatan &middot; log audit pergantian siklus putaran aktif
              </span>
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`dw-audit-chevron ${isHistoryOpen ? 'dw-audit-chevron--open' : ''}`}
          />
        </button>
        {isHistoryOpen && (
          <div className="dw-audit-body">
            <Table
              columns={historyColumns}
              data={historyList}
              isLoading={isLoading}
              emptyMessage="Belum ada riwayat perubahan putaran jadwal."
            />
          </div>
        )}
      </div>

      {/* Modal Form: Atur Tahun Ajaran Aktif */}
      <Modal
        isOpen={isYearModalOpen}
        onClose={() => setIsYearModalOpen(false)}
        title="Tetapkan Tahun Ajaran & Semester Aktif"
      >
        <form onSubmit={handleSubmitYearEdit} className="space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Pembaruan Tahun Ajaran dan Semester akan langsung berlaku pada seluruh portal siswa, wali murid, dan pencatatan akademik.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Tahun Ajaran <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={inputAcademicYear}
              onChange={(e) => setInputAcademicYear(e.target.value)}
              placeholder="Contoh: 2025/2026 atau 2026/2027"
              required
            />
            <span className="text-[11px] text-gray-400 mt-0.5 block">
              Format: YYYY/YYYY (contoh: 2025/2026)
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Semester <span className="text-red-500">*</span>
            </label>
            <Select
              value={inputSemester}
              onChange={(e) => setInputSemester(e.target.value)}
              options={[
                { value: 'Ganjil', label: 'Semester Ganjil' },
                { value: 'Genap', label: 'Semester Genap' },
              ]}
            />
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
              Pratinjau Tampilan Header:
            </span>
            <span className="text-sm font-bold font-mono text-gray-900">
              {inputAcademicYear.trim()} {inputSemester}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsYearModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Lanjutkan Verifikasi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Password Confirmation Modal (Step-Up Auth) */}
      <PasswordModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalError('');
        }}
        onConfirm={handleConfirmPassword}
        title={modalConfig.title}
        description={modalConfig.description}
        loading={modalLoading}
        error={modalError}
      />
    </div>
  );
}
