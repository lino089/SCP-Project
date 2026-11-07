import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  Layers,
  Calendar,
  Clock,
  AlertCircle,
  RotateCw,
  ArrowRight,
  ShieldCheck,
  Building2,
  BookOpen,
} from 'lucide-react';
import {
  Button,
  Badge,
  StatCard,
  PasswordSheet,
  SegmentedTabs,
} from '../../components/shared';
import { academicSettingApi, scheduleApi } from '../../services/scheduleApi';
import { masterDataSummaryApi } from '../../services/masterDataApi';
import academicEventApi from '../../services/academicEventApi';
import { SkeletonCard, ErrorState } from '../../components/feedback';

export default function WakaDashboardPage() {
  const navigate = useNavigate();

  // Settings states
  const [activeCycle, setActiveCycle] = useState(1);
  const [mondayIsUpacara, setMondayIsUpacara] = useState(true);
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [semester, setSemester] = useState('Ganjil');

  // Summary stats
  const [summaryData, setSummaryData] = useState({
    classes: 0,
    rooms: 0,
    subjects: 0,
    teachers: 0,
    students: 0,
    schedules: 0,
  });

  // Missing journals & Today events
  const [missingJournals, setMissingJournals] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);

  // Loading & Feedback
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Password confirmation sheet
  const [isPasswordSheetOpen, setIsPasswordSheetOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      const [settingsRes, summaryRes, missingRes, eventsRes] = await Promise.allSettled([
        academicSettingApi.getSettings(),
        masterDataSummaryApi.getSummary(),
        scheduleApi.getMissingJournals(),
        academicEventApi.getAll({ today: true }),
      ]);

      if (settingsRes.status === 'fulfilled' && settingsRes.value?.data) {
        const s = settingsRes.value.data;
        setActiveCycle(Number(s.cycle_type || s.active_cycle || 1));
        setMondayIsUpacara(Boolean(s.is_upacara ?? s.monday_is_upacara ?? true));
        setAcademicYear(s.academic_year || '2025/2026');
        setSemester(s.semester || 'Ganjil');
      }

      if (summaryRes.status === 'fulfilled' && summaryRes.value?.data) {
        setSummaryData(summaryRes.value.data);
      }

      if (missingRes.status === 'fulfilled') {
        const miss = missingRes.value;
        const list = Array.isArray(miss) ? miss : Array.isArray(miss?.data) ? miss.data : [];
        setMissingJournals(list);
      }

      if (eventsRes.status === 'fulfilled') {
        const ev = eventsRes.value;
        const list = Array.isArray(ev) ? ev : Array.isArray(ev?.data) ? ev.data : [];
        setTodayEvents(list);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message || 'Gagal memuat ringkasan dashboard Waka.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const [settingsRes, summaryRes, missingRes, eventsRes] = await Promise.allSettled([
          academicSettingApi.getSettings(),
          masterDataSummaryApi.getSummary(),
          scheduleApi.getMissingJournals(),
          academicEventApi.getAll({ today: true }),
        ]);

        if (!isMounted) return;

        if (settingsRes.status === 'fulfilled' && settingsRes.value?.data) {
          const s = settingsRes.value.data;
          setActiveCycle(Number(s.cycle_type || s.active_cycle || 1));
          setMondayIsUpacara(Boolean(s.is_upacara ?? s.monday_is_upacara ?? true));
          setAcademicYear(s.academic_year || '2025/2026');
          setSemester(s.semester || 'Ganjil');
        }

        if (summaryRes.status === 'fulfilled' && summaryRes.value?.data) {
          setSummaryData(summaryRes.value.data);
        }

        if (missingRes.status === 'fulfilled') {
          const miss = missingRes.value;
          const list = Array.isArray(miss) ? miss : Array.isArray(miss?.data) ? miss.data : [];
          setMissingJournals(list);
        }

        if (eventsRes.status === 'fulfilled') {
          const ev = eventsRes.value;
          const list = Array.isArray(ev) ? ev : Array.isArray(ev?.data) ? ev.data : [];
          setTodayEvents(list);
        }
        setLoadError(null);
      } catch (err) {
        if (isMounted) setLoadError(err.message || 'Gagal memuat ringkasan dashboard Waka.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchDashboardData();
  };

  const handleTriggerCycleSwitch = (targetCycle) => {
    if (targetCycle === activeCycle) return;
    setPendingAction({
      type: 'cycle',
      targetValue: targetCycle,
      title: 'Konfirmasi Pengalihan Siklus KBM',
      description: `Masukkan kata sandi Waka untuk mengubah jadwal ke Siklus ${targetCycle}.`,
    });
    setSheetError('');
    setIsPasswordSheetOpen(true);
  };

  const handlePasswordConfirm = async (password) => {
    setSheetLoading(true);
    setSheetError('');
    try {
      if (pendingAction?.type === 'cycle') {
        await academicSettingApi.updateCycle({
          cycle_type: pendingAction.targetValue,
          password,
        });
        setActiveCycle(pendingAction.targetValue);
        setFeedbackMessage(`Siklus berhasil diubah ke Siklus ${pendingAction.targetValue}.`);
      } else if (pendingAction?.type === 'upacara') {
        await academicSettingApi.updateMondayStatus({
          is_upacara: pendingAction.targetValue,
          password,
        });
        setMondayIsUpacara(pendingAction.targetValue);
        setFeedbackMessage(
          `Status jam upacara Senin berhasil di${pendingAction.targetValue ? 'aktifkan' : 'nonaktifkan'}.`
        );
      }
      setIsPasswordSheetOpen(false);
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err) {
      setSheetError(err.response?.data?.message || err.message || 'Kata sandi tidak valid.');
    } finally {
      setSheetLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard count={3} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Gagal Memuat Dashboard"
          message={loadError}
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="p-3 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success-fg)] text-xs rounded-[14px] flex items-center justify-between animate-fade-in">
          <span>{feedbackMessage}</span>
          <Button size="sm" variant="ghost" onClick={() => setFeedbackMessage(null)}>
            Tutup
          </Button>
        </div>
      )}

      {/* Header Summary Card */}
      <section className="surface-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="section-label">Waka Kurikulum</p>
            <h1 className="text-[17px] font-semibold text-[var(--color-text-primary)] mt-1 leading-snug">
              Tahun Ajaran {academicYear}
            </h1>
            <p className="text-meta mt-1">
              Semester {semester} · Upacara Senin{' '}
              <span
                className={
                  mondayIsUpacara
                    ? 'text-[var(--color-success-fg)] font-medium'
                    : 'text-[var(--color-text-muted)]'
                }
              >
                {mondayIsUpacara ? 'Aktif' : 'Nonaktif'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="success" size="sm" dot>
              Siklus {activeCycle}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              className="p-0 min-h-0 h-8 w-8"
              aria-label="Segarkan"
            >
              <RotateCw size={16} strokeWidth={1.75} />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--color-border-subtle)]">
          <span className="section-label">Siklus KBM</span>
          <SegmentedTabs
            fullWidth
            className="w-[172px] shrink-0"
            tabs={[
              { id: 1, label: 'Siklus 1' },
              { id: 2, label: 'Siklus 2' },
            ]}
            activeTab={activeCycle}
            onChange={(id) => handleTriggerCycleSwitch(Number(id))}
          />
        </div>
      </section>

      {/* Missing Journals Alert */}
      {missingJournals.length > 0 && (
        <div className="p-3.5 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[14px] flex items-start gap-3">
          <AlertCircle className="text-[var(--color-warning-fg)] shrink-0 mt-0.5" size={18} />
          <div className="flex-1 min-w-0">
            <h2 className="text-xs font-bold text-[var(--color-warning-fg)]">
              {missingJournals.length} Jurnal KBM Belum Selesai
            </h2>
            <p className="text-[11px] text-[var(--color-warning-fg)] mt-0.5 leading-relaxed">
              Terdapat sesi mengajar yang telah selesai lebih dari 30 menit lalu namun belum diisi jurnalnya oleh guru pengampu.
            </p>
            <button
              type="button"
              onClick={() => navigate('/web/monitoring')}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-warning-fg)] underline"
            >
              Periksa di Monitoring KBM <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Agenda Hari Ini */}
      {todayEvents.length > 0 && (
        <div className="p-3.5 bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded-[14px]">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-[var(--color-info-fg)]" />
            <h2 className="text-xs font-bold text-[var(--color-info-fg)]">Agenda Sekolah Hari Ini</h2>
          </div>
          <div className="space-y-1.5">
            {todayEvents.map((ev) => (
              <div
                key={ev.id}
                className="bg-[var(--color-surface)]/80 border border-blue-100 rounded-[10px] p-2 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">{ev.title}</p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] capitalize">{ev.type}</p>
                </div>
                {ev.disables_kbm && (
                  <Badge variant="danger" size="sm">
                    KBM Ditiadakan
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Access Menu Cards */}
      <div>
        <h2 className="section-label">
          Menu Manajemen Kurikulum
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/web/schedules')}
            className="p-3 surface-card text-left hover:border-[var(--color-border-strong)] transition-all active:scale-[0.99] flex flex-col justify-between h-24"
          >
            <div className="icon-tile icon-tile--sm">
              <Clock size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-text-primary)]">Jadwal Pelajaran</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Kelola &amp; deteksi bentrok</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/web/academic-calendar')}
            className="p-3 surface-card text-left hover:border-[var(--color-border-strong)] transition-all active:scale-[0.99] flex flex-col justify-between h-24"
          >
            <div className="icon-tile icon-tile--sm">
              <Calendar size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-text-primary)]">Kalender Akademik</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Agenda, ujian &amp; libur</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/web/master-data')}
            className="p-3 surface-card text-left hover:border-[var(--color-border-strong)] transition-all active:scale-[0.99] flex flex-col justify-between h-24"
          >
            <div className="icon-tile icon-tile--sm">
              <Layers size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-text-primary)]">Master Data</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Guru, rombel, mapel, ruang</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/web/grade-promotion')}
            className="p-3 surface-card text-left hover:border-[var(--color-border-strong)] transition-all active:scale-[0.99] flex flex-col justify-between h-24"
          >
            <div className="icon-tile icon-tile--sm">
              <GraduationCap size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-text-primary)]">Kenaikan Kelas</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Promosi tingkat &amp; kelulusan</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/web/monitoring')}
            className="col-span-2 p-3 surface-card text-left hover:border-[var(--color-border-strong)] transition-all active:scale-[0.99] flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="icon-tile">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--color-text-primary)]">Monitoring &amp; Rekapitulasi Presensi</p>
                <p className="text-[11px] text-[var(--color-text-secondary)]">Pantau KBM dan kepatuhan jurnal harian</p>
              </div>
            </div>
            <ArrowRight size={16} className="text-[var(--color-text-muted)]" />
          </button>
        </div>
      </div>

      {/* Ringkasan Data Institusi */}
      <div>
        <h2 className="section-label">
          Statistik Master Data
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            title="Total Rombel"
            value={summaryData.classes || 0}
            icon={Building2}
            color="primary"
          />
          <StatCard
            title="Tenaga Pendidik"
            value={summaryData.teachers || 0}
            icon={Users}
            color="success"
          />
          <StatCard
            title="Mata Pelajaran"
            value={summaryData.subjects || 0}
            icon={BookOpen}
            color="warning"
          />
          <StatCard
            title="Slot Jadwal"
            value={summaryData.schedules || 0}
            icon={Clock}
            color="primary"
          />
        </div>
      </div>

      {/* Password Confirmation Sheet */}
      <PasswordSheet
        isOpen={isPasswordSheetOpen}
        onClose={() => setIsPasswordSheetOpen(false)}
        onConfirm={handlePasswordConfirm}
        title={pendingAction?.title || 'Konfirmasi Tindakan'}
        description={pendingAction?.description}
        isLoading={sheetLoading}
        errorMessage={sheetError}
      />
    </div>
  );
}
