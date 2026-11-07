import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  User,
  AlertCircle,
  Users,
  GraduationCap,
  Layers,
  Calendar,
  CalendarRange,
  Edit2,
  RotateCw,
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
} from '../../components/shared';
import { academicSettingApi, scheduleApi } from '../../services/scheduleApi';
import { masterDataSummaryApi } from '../../services/masterDataApi';
import academicEventApi from '../../services/academicEventApi';
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

  // Loading & Feedback states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
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

  // Load initial data dari database riil
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [settingsRes, sumRes, historyRes, missingRes, eventRes] = await Promise.all([
        academicSettingApi.getSettings(),
        masterDataSummaryApi.getSummary(),
        academicSettingApi.getCycleHistory(),
        scheduleApi.getMissingJournals().catch(() => ({ data: [] })),
        academicEventApi.checkExemption({ date: todayStr }).catch(() => null),
      ]);

      // Agenda Kalender Akademik Hari Ini
      const exData = eventRes?.data ?? eventRes;
      const activeEvts = exData?.active_events || [];
      setTodayEvents(activeEvts);

      // 1. Settings
      if (settingsRes?.data) {
        setActiveCycle(Number(settingsRes.data.active_cycle || 1));
        setMondayIsUpacara(Boolean(settingsRes.data.monday_is_upacara));
        if (settingsRes.data.academic_year) {
          setAcademicYear(settingsRes.data.academic_year);
        }
        if (settingsRes.data.semester) {
          setSemester(settingsRes.data.semester);
        }
      }

      // 2. Master Data Summary
      if (sumRes?.data) {
        setSummaryData(sumRes.data);
      }

      // 3. Cycle History
      const histList = historyRes?.data
        ? Array.isArray(historyRes.data)
          ? historyRes.data
          : historyRes.data.data || []
        : [];
      setHistoryList(histList);

      // 4. Missing Journals
      const raw = missingRes?.data
        ? Array.isArray(missingRes.data)
          ? missingRes.data
          : missingRes.data.data || []
        : [];
      const formatted = raw.map((item) => ({
        id: item.id,
        className: item.school_class?.name || item.className || 'Kelas',
        teacherName: item.teacher?.name || item.teacherName || 'Guru',
        subjectName: item.subject?.name || item.subjectName || 'Mata Pelajaran',
        period: `Jam Ke-${item.period_number || item.slot || 1}`,
      }));
      setMissingJournals(formatted);
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
          const list = histRes?.data
            ? Array.isArray(histRes.data)
              ? histRes.data
              : histRes.data.data || []
            : [];
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
            variant="secondary"
            onClick={handleOpenYearModal}
          >
            <CalendarRange size={15} />
            <span>Atur Tahun Ajaran</span>
          </Button>
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

      {/* Banner Agenda Khusus / Kalender Akademik Hari Ini */}
      {todayEvents.length > 0 && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-amber-900">Agenda Kalender Akademik Hari Ini</h3>
                  <Badge variant="warning">{todayEvents.length} Agenda Aktif</Badge>
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {todayEvents.map((evt) => (
                    <div key={evt.id} className="text-xs text-amber-800 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-amber-950">&bull; {evt.title}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono">
                        {evt.scope_type === 'all' ? 'Seluruh Sekolah' : evt.scope_type === 'grade' ? `Tingkat ${evt.scope_targets?.join(', ')}` : 'Rombel Tertentu'}
                      </span>
                      {evt.disables_teaching ? (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
                          KBM Reguler Ditiadakan
                        </span>
                      ) : (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                          KBM Tetap Berjalan
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/web/academic-calendar')}
              className="shrink-0 text-amber-900 border-amber-300 hover:bg-amber-100"
            >
              Kelola Kalender
            </Button>
          </div>
        </div>
      )}

      {/* Ringkasan Master Data Riil (4 Kartu Metrik) */}
      <div className="dashboard-metrics-grid">
        <StatCard
          title="Total Guru"
          value={summaryData.teachers ?? 0}
          icon={Users}
          description="Guru aktif terdaftar di sistem"
          color="blue"
        />
        <StatCard
          title="Total Siswa"
          value={summaryData.students ?? 0}
          icon={GraduationCap}
          description="Peserta didik aktif seluruh rombel"
          color="emerald"
        />
        <StatCard
          title="Rombel Kelas"
          value={summaryData.classes ?? 0}
          icon={Layers}
          description="Kelas terdaftar (Tingkat X, XI, XII)"
          color="amber"
        />
        <StatCard
          title="Alokasi Jadwal KBM"
          value={summaryData.schedules ?? 0}
          icon={Calendar}
          description="Slot jadwal pelajaran aktif di database"
          color="purple"
        />
      </div>

      {/* Kontrol Konfigurasi Akademik (4 Kartu) */}
      <div className="dashboard-cards-grid--4">
        {/* Card 1: Putaran Jadwal Aktif */}
        <div className="dashboard-flat-card accent-border-top--neutral">
          <div className="dashboard-card-top">
            <span className="dashboard-card-label">Putaran Jadwal Aktif</span>
            <Badge variant="default" dot>Putaran {activeCycle}</Badge>
          </div>
          <div className="dashboard-card-main-val font-mono">Putaran {activeCycle}</div>
          <p className="dashboard-card-desc">Siklus jadwal rotasi mingguan yang sedang berjalan.</p>
          <div className="dashboard-card-footer-controls">
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

        {/* Card 2: Status Upacara Hari Senin */}
        <div className={`dashboard-flat-card ${mondayIsUpacara ? 'accent-border-top--success' : 'accent-border-top--neutral'}`}>
          <div className="dashboard-card-top">
            <span className="dashboard-card-label">Upacara Hari Senin</span>
            <Badge variant={mondayIsUpacara ? 'success' : 'neutral'} dot>
              {mondayIsUpacara ? 'Aktif' : 'Nonaktif'}
            </Badge>
          </div>
          <div className="dashboard-card-main-val">
            {mondayIsUpacara ? 'Upacara Aktif' : 'KBM Normal'}
          </div>
          <p className="dashboard-card-desc">
            {mondayIsUpacara
              ? 'Jam ke-1 dialokasikan untuk upacara bendera (mulai 08:00).'
              : 'Tidak ada upacara, KBM jam ke-1 dimulai normal (07:15).'}
          </p>
          <div className="dashboard-card-footer-controls">
            <Button variant="secondary" size="sm" onClick={handleRequestUpacaraToggle}>
              Ubah ke {mondayIsUpacara ? 'Nonaktif' : 'Aktif'}
            </Button>
          </div>
        </div>

        {/* Card 3: Tahun Ajaran & Semester Aktif */}
        <div className="dashboard-flat-card accent-border-top--neutral">
          <div className="dashboard-card-top">
            <span className="dashboard-card-label">Tahun Ajaran Aktif</span>
            <Badge variant="default">{semester}</Badge>
          </div>
          <div className="dashboard-card-main-val font-mono">{academicYear}</div>
          <p className="dashboard-card-desc">
            Periode kalender akademik aktif yang tampil di portal seluruh pengguna.
          </p>
          <div className="dashboard-card-footer-controls">
            <Button variant="secondary" size="sm" onClick={handleOpenYearModal}>
              <Edit2 size={13} />
              <span>Ubah Tahun Ajaran</span>
            </Button>
          </div>
        </div>

        {/* Card 4: Rekap Kepatuhan Jurnal */}
        <div className={`dashboard-flat-card ${missingJournals.length > 0 ? 'accent-border-top--warning' : 'accent-border-top--success'}`}>
          <div className="dashboard-card-top">
            <span className="dashboard-card-label">Jurnal Hari Ini</span>
            <Badge variant={missingJournals.length > 0 ? 'warning' : 'success'} dot>
              {missingJournals.length > 0 ? `${missingJournals.length} Terlambat` : 'Lengkap'}
            </Badge>
          </div>
          <div className="dashboard-card-main-val flex items-baseline">
            <span className="text-[24px] font-semibold text-gray-900 tracking-tight font-mono">
              {missingJournals.length}
            </span>
            <span className="text-[13px] font-normal text-gray-600 ml-1">sesi belum diisi</span>
          </div>
          <p className="dashboard-card-desc">
            Monitoring keterlambatan pengisian jurnal KBM (&gt; 30 menit).
          </p>
          <div className="dashboard-card-footer-controls">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/kurikulum/jadwal')}
            >
              Lihat Matriks Jadwal
            </Button>
          </div>
        </div>
      </div>

      {/* Section: Missing Journal Alert */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2 className="dashboard-section-title">Peringatan Keterlambatan Jurnal</h2>
            <p className="dashboard-section-desc">
              Daftar sesi KBM yang belum menyelesaikan jurnal mengajar hari ini (&gt; 30 menit).
            </p>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {missingJournals.length} sesi memerlukan perhatian
          </span>
        </div>

        <div className="dashboard-row-cards-list">
          {missingJournals.length === 0 ? (
            <div className="dashboard-empty-row flex items-center gap-2">
              <span className="status-dot status-dot--success" />
              <span>Seluruh guru pengampu telah mengisi jurnal KBM hari ini dengan lengkap.</span>
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
      </div>

      {/* Section: Cycle History Table */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2 className="dashboard-section-title">Riwayat Perubahan Putaran Jadwal</h2>
            <p className="dashboard-section-desc">
              Log audit pergantian siklus putaran jadwal aktif sekolah.
            </p>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Total {historyList.length} catatan
          </span>
        </div>

        <Table
          columns={historyColumns}
          data={historyList}
          isLoading={isLoading}
          emptyMessage="Belum ada riwayat perubahan putaran jadwal."
        />
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
