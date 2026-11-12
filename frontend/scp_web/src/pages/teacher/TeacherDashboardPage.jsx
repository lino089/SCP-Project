import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  PlayCircle,
  Eye,
  RotateCw,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { journalApi } from '../../services/journalApi';
import { leaveApi } from '../../services/leaveApi';
import academicEventApi from '../../services/academicEventApi';
import { Badge, Button } from '../../components/shared';
import { resolveSlotTime } from '../../utils/timetableHelper';
import { unwrap, unwrapList } from '../../utils/responseHelper';
import { getJakartaDayInfo, getJakartaTimeString } from '../../utils/dateUtils';
import './TeacherDashboard.css';

const WEEK_DAY_LABELS = { 1: 'Sen', 2: 'Sel', 3: 'Rab', 4: 'Kam', 5: 'Jum', 6: 'Sab', 7: 'Min' };

export default function TeacherDashboardPage() {
  const { user, isWaliKelas, isKesiswaan, hasRole } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activeCycle, setActiveCycle] = useState(() => Number(user?.active_cycle || 1));
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [weeklySchedules, setWeeklySchedules] = useState([]);
  const [missingJournals, setMissingJournals] = useState([]);
  const [teacherLeaves, setTeacherLeaves] = useState([]);
  const [todayExemption, setTodayExemption] = useState(null);

  // Tanggal & Hari Berjalan (Indonesia) berbasis Asia/Jakarta (P-11)
  const dateInfo = useMemo(() => {
    const dayInfo = getJakartaDayInfo();
    return {
      dayOfWeek: dayInfo.dayOfWeek,
      dayName: dayInfo.dayName,
      todayIso: dayInfo.dateStr,
      formattedDate: dayInfo.formattedDate,
      currentTimeStr: getJakartaTimeString(),
    };
  }, []);

  // Profil Guru & Rombel Binaan (jika Wali Kelas)
  const teacherProfile = useMemo(() => {
    const homeroomAssignment = user?.assignments?.find((a) => a.type === 'wali_kelas');
    const homeroomClassName =
      homeroomAssignment?.school_class?.name ||
      homeroomAssignment?.class_name ||
      (homeroomAssignment?.class_id ? `Kelas #${homeroomAssignment.class_id}` : null);

    return {
      name: user?.name || 'Bapak/Ibu Guru',
      nip: user?.nis_nip || '-',
      isWali: Boolean(isWaliKelas && homeroomClassName),
      homeroomClassName,
      isKesiswaanRole: isKesiswaan(),
    };
  }, [user, isWaliKelas, isKesiswaan]);

  // Muat Seluruh Data Dashboard Guru (P-12: allSettled, P-13: no 403, no duplicate)
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      // 1. Dapatkan setting akademik aktif langsung dari profil user (P-13: hilangkan 403 /academic-settings)
      const cycle = Number(user?.academic_setting?.active_cycle || user?.active_cycle || 1);
      setActiveCycle(cycle);

      // 2. Fetch data paralel: Jadwal Mingguan Tunggal, Missing Journals, Izin Guru, & Status Peniadaan KBM
      const [weeklyRes, missingRes, leaveRes, exemptionRes] = await Promise.allSettled([
        journalApi.getTeacherSchedules({
          cycle,
          all: 1,
          per_page: 200,
        }),
        journalApi.getMissingJournals(),
        leaveApi.getTeacherLeaveRequests({ per_page: 20 }),
        academicEventApi.checkExemption({ date: dateInfo.todayIso }),
      ]);

      // Agenda / Peniadaan KBM
      if (exemptionRes.status === 'fulfilled') {
        const exData = unwrap(exemptionRes.value);
        if (exData && (exData.disabling_event !== undefined || exData.is_teaching_exempted !== undefined)) {
          setTodayExemption(exData);
        } else {
          setTodayExemption(null);
        }
      }

      // P-13: Turunkan jadwal hari ini dari jadwal mingguan (0 duplicate request)
      if (weeklyRes.status === 'fulfilled') {
        const weeklyList = unwrapList(weeklyRes.value);
        setWeeklySchedules(weeklyList);
        const todayList = weeklyList.filter((s) => Number(s.day_of_week) === Number(dateInfo.dayOfWeek));
        setTodaySchedules(todayList);
      } else {
        setWeeklySchedules([]);
        setTodaySchedules([]);
      }

      // Missing Journals
      if (missingRes.status === 'fulfilled') {
        const missingList = unwrapList(missingRes.value);
        setMissingJournals(missingList);
      } else {
        setMissingJournals([]);
      }

      // Izin Guru
      if (leaveRes.status === 'fulfilled') {
        const leaveList = unwrapList(leaveRes.value);
        setTeacherLeaves(leaveList);
      } else {
        setTeacherLeaves([]);
      }

      // Hanya tampilkan global error bila request jadwal mingguan gagal
      if (weeklyRes.status === 'rejected') {
        setLoadError('Gagal memuat jadwal pelajaran guru.');
      }
    } catch (err) {
      console.warn('Gagal memuat data Dashboard Guru:', err);
      setLoadError(err.message || 'Gagal memuat jadwal dan data KBM harian.');
    } finally {
      setLoading(false);
    }
  }, [user?.academic_setting?.active_cycle, user?.active_cycle, dateInfo.dayOfWeek, dateInfo.todayIso]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Metrik Harian Guru
  const stats = useMemo(() => {
    const todayJp = todaySchedules.reduce((acc, item) => acc + (item.duration_periods || 2), 0);
    const weeklyJp = weeklySchedules.reduce((acc, item) => acc + (item.duration_periods || 2), 0);
    
    // Izin aktif hari ini
    const activeTodayLeave = teacherLeaves.find((l) => l.date === dateInfo.todayIso);

    return {
      todayJp,
      todaySessions: todaySchedules.length,
      weeklyJp,
      missingCount: missingJournals.length,
      todayLeave: activeTodayLeave,
    };
  }, [todaySchedules, weeklySchedules, missingJournals, teacherLeaves, dateInfo.todayIso]);


  // Sebaran beban mengajar per hari (Senin–Sabtu) dari jadwal mingguan
  const weekLoad = useMemo(() => {
    const days = [1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      label: WEEK_DAY_LABELS[day],
      jp: 0,
      isToday: Number(dateInfo.dayOfWeek) === day,
    }));

    weeklySchedules.forEach((item) => {
      const row = days.find((d) => d.day === Number(item.day_of_week));
      if (!row) return;
      row.jp += Number(item.duration_periods || 2);
    });

    const maxJp = Math.max(...days.map((d) => d.jp), 1);
    const activeDays = days.filter((d) => d.jp > 0).length;
    const totalJp = days.reduce((acc, d) => acc + d.jp, 0);
    const busiest = days.reduce((a, b) => (b.jp > a.jp ? b : a), days[0]);

    return {
      days,
      maxJp,
      activeDays,
      busiest,
      avgJp: activeDays > 0 ? (totalJp / activeDays).toFixed(1).replace('.', ',') : '0',
      hasData: totalJp > 0,
    };
  }, [weeklySchedules, dateInfo.dayOfWeek]);

  // Helper format waktu KBM
  const formatScheduleTime = (item) => {
    if (item.resolved_times?.start_time && item.resolved_times?.end_time) {
      return `${item.resolved_times.start_time.slice(0, 5)} - ${item.resolved_times.end_time.slice(0, 5)} WIB`;
    }
    const resolved = resolveSlotTime(
      item.day_of_week || dateInfo.dayOfWeek,
      item.period_number || 1,
      item.duration_periods || 1
    );
    return `${resolved.timeText} WIB`;
  };

  return (
    <div className="teacher-dashboard">
      {/* =========================================================================
          1. HEADER UCAPAN SELAMAT DATANG (BORDERLESS / SEAMLESS)
         ========================================================================= */}
      <div className="teacher-dashboard__welcome-header">
        <div className="teacher-dashboard__welcome-left">
          <div className="teacher-dashboard__name-wrap">
            <h1 className="teacher-dashboard__teacher-name">
              Selamat Datang, {teacherProfile.name}
            </h1>
            {teacherProfile.isKesiswaanRole && (
              <span className="teacher-dashboard__role-badge teacher-dashboard__role-badge--kesiswaan">
                Tim Kesiswaan
              </span>
            )}
          </div>

          <div className="teacher-dashboard__welcome-meta">
            <span>NIP: <strong className="font-mono text-gray-900">{teacherProfile.nip}</strong></span>
            <span className="teacher-dashboard__meta-dot">&bull;</span>
            <span>Tahun Ajaran: <strong className="text-gray-900">{user?.academic_year || '2025/2026 Ganjil'}</strong></span>
            <span className="teacher-dashboard__meta-dot">&bull;</span>
            <span>Putaran Aktif: <strong className="text-gray-900">Putaran {activeCycle}</strong></span>
          </div>
        </div>

        <div className="teacher-dashboard__period-badge">
          <Calendar size={14} className="text-slate-500" />
          <span className="font-medium text-slate-800">
            {dateInfo.dayName}, {dateInfo.formattedDate}
          </span>
        </div>
      </div>

      {/* Alert Izin Guru Hari Ini */}
      {stats.todayLeave && (
        <div className="mb-5 p-4 rounded-xl border border-amber-300 bg-amber-50 flex items-center justify-between gap-3 text-xs text-amber-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-amber-700 shrink-0" />
            <div>
              <strong className="block text-amber-900 font-bold">
                Pengajuan Izin Mengajar Hari Ini ({stats.todayLeave.status === 'approved' ? 'Disetujui' : 'Menunggu Verifikasi'}):
              </strong>
              <span>{stats.todayLeave.reason || 'Izin tidak mengajar hari ini.'} Seluruh jam KBM Anda didelegasikan ke Tim Piket Kesiswaan.</span>
            </div>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold cursor-pointer shrink-0 transition"
            onClick={() => navigate('/teacher/leave')}
          >
            Buka Menu Izin
          </button>
        </div>
      )}

      {/* =========================================================================
          2. EMPAT KARTU METRIK MENGAJAR HARIAN
         ========================================================================= */}
      <div className="teacher-dashboard__stats-grid">
        {/* Card 1: Sesi Hari Ini */}
        <div className="teacher-dashboard__stat-card">
          <div className="teacher-dashboard__stat-top">
            <span className="teacher-dashboard__stat-title">Jadwal Hari Ini</span>
            <span className="teacher-dashboard__stat-indicator teacher-dashboard__stat-indicator--active" />
          </div>
          <div className="teacher-dashboard__stat-body">
            <span className="teacher-dashboard__stat-value font-mono">{stats.todayJp}</span>
            <span className="teacher-dashboard__stat-unit">JP ({stats.todaySessions} Sesi)</span>
          </div>
          <p className="teacher-dashboard__stat-desc">Alokasi jam KBM aktif hari ini</p>
        </div>

        {/* Card 2: Beban Mingguan */}
        <div className="teacher-dashboard__stat-card">
          <div className="teacher-dashboard__stat-top">
            <span className="teacher-dashboard__stat-title">Beban Mengajar</span>
            <span className="teacher-dashboard__stat-indicator teacher-dashboard__stat-indicator--info" />
          </div>
          <div className="teacher-dashboard__stat-body">
            <span className="teacher-dashboard__stat-value font-mono">{stats.weeklyJp}</span>
            <span className="teacher-dashboard__stat-unit">JP / minggu</span>
          </div>
          <p className="teacher-dashboard__stat-desc">Total jam pelajaran per minggu</p>
        </div>

        {/* Card 3: Jurnal Menunggu */}
        <div className="teacher-dashboard__stat-card">
          <div className="teacher-dashboard__stat-top">
            <span className="teacher-dashboard__stat-title">Jurnal Belum Diisi</span>
            <span className={`teacher-dashboard__stat-indicator ${stats.missingCount > 0 ? 'teacher-dashboard__stat-indicator--warning' : 'teacher-dashboard__stat-indicator--active'}`} />
          </div>
          <div className="teacher-dashboard__stat-body">
            <span className={`teacher-dashboard__stat-value font-mono ${stats.missingCount > 0 ? 'text-amber-600' : ''}`}>
              {stats.missingCount}
            </span>
            <span className="teacher-dashboard__stat-unit">Sesi</span>
          </div>
          <p className="teacher-dashboard__stat-desc">
            {stats.missingCount > 0 ? 'Perlu pengisian jurnal KBM' : 'Seluruh jurnal terisi rapi'}
          </p>
        </div>

        {/* Card 4: Informasi Putaran Jadwal */}
        <div className="teacher-dashboard__stat-card">
          <div className="teacher-dashboard__stat-top">
            <span className="teacher-dashboard__stat-title">Putaran Aktif</span>
            <span className="teacher-dashboard__stat-indicator teacher-dashboard__stat-indicator--info" />
          </div>
          <div className="teacher-dashboard__stat-body">
            <span className="teacher-dashboard__stat-value font-mono">{activeCycle}</span>
            <span className="teacher-dashboard__stat-unit">Putaran (Berjalan)</span>
          </div>
          <p className="teacher-dashboard__stat-desc">Sistem rotasi KBM minggu berjalan</p>
        </div>
      </div>

      {/* Banner Hari Libur / Agenda Sekolah Aktif Hari Ini */}
      {todayExemption?.is_teaching_exempted && todayExemption?.disabling_event && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 mb-6 text-amber-900 shadow-xs">
          <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold">
              Agenda Hari Ini: {todayExemption.disabling_event.title}
            </h3>
            <p className="text-xs text-amber-700 mt-0.5">
              {todayExemption.disabling_event.scope_type === 'all'
                ? 'Seluruh kegiatan KBM reguler dan kewajiban pengisian jurnal/presensi ditiadakan hari ini.'
                : 'Kegiatan KBM reguler untuk kelas yang terdampak agenda khusus ini ditiadakan.'}
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. LAYOUT UTAMA: JADWAL KBM HARI INI & INFORMASI PENDUKUNG
         ========================================================================= */}
      <div className="teacher-dashboard__main-grid">
        {/* Kolom Kiri: Jadwal Hari Ini + Jadwal Berikutnya */}
        <div className="teacher-dashboard__col">
          <div className="teacher-dashboard__section-card teacher-dashboard__section-card--fill">
            <div className="teacher-dashboard__section-header">
              <h2 className="teacher-dashboard__section-title">
                <Clock size={18} className="text-slate-800" />
                <span>Jurnal Mengajar Hari Ini</span>
              </h2>
            <div className="flex items-center gap-2">
              <span className="teacher-dashboard__section-badge font-mono">
                {dateInfo.dayName}, {dateInfo.formattedDate}
              </span>
              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer ml-1"
                onClick={() => navigate('/teacher/schedule')}
              >
                Jadwal Lengkap &rarr;
              </button>
            </div>
          </div>

          {loading ? (
            <div className="teacher-dashboard__empty-widget">
              <RotateCw size={24} className="animate-spin text-slate-400 mb-2" />
              <p className="text-xs text-slate-500">Memuat jadwal mengajar hari ini...</p>
            </div>
          ) : loadError ? (
            <div className="teacher-dashboard__empty-widget text-red-600">
              <AlertTriangle size={28} className="mb-2" />
              <p className="text-xs">{loadError}</p>
              <button
                type="button"
                className="mt-3 px-3 py-1.5 rounded bg-slate-800 text-white text-xs font-medium cursor-pointer"
                onClick={loadDashboardData}
              >
                Coba Lagi
              </button>
            </div>
          ) : todaySchedules.length === 0 ? (
            <div className="teacher-dashboard__empty-widget">
              <Calendar size={36} className="teacher-dashboard__empty-icon" />
              <h3 className="teacher-dashboard__empty-text">
                Tidak ada jadwal mengajar aktif pada hari {dateInfo.dayName}.
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Gunakan waktu luang untuk evaluasi pembelajaran, penyiapan materi kuis, atau koordinasi kurikulum sekolah.
              </p>
            </div>
          ) : (
            <div className="teacher-dashboard__schedule-list">
              {todaySchedules.map((item, idx) => {
                const className =
                  item.school_class?.name ||
                  item.schoolClass?.name ||
                  item.class_name ||
                  'Kelas';
                const isCompleted = item.journal_status === 'completed';

                return (
                  <div
                    key={item.id || idx}
                    className={`teacher-dashboard__schedule-item ${
                      isCompleted
                        ? 'teacher-dashboard__schedule-item--completed'
                        : 'teacher-dashboard__schedule-item--pending'
                    }`}
                  >
                    <div className="teacher-dashboard__sched-left">
                      <div className="teacher-dashboard__time-col">
                        <span className="teacher-dashboard__time-slot font-mono">
                          {formatScheduleTime(item)}
                        </span>
                        <span className="teacher-dashboard__period-num font-mono">
                          Jam Ke-{item.period_number || idx + 1} s/d{' '}
                          {(item.period_number || idx + 1) + (item.duration_periods || 2) - 1}
                        </span>
                      </div>

                      <div className="teacher-dashboard__sched-details">
                        <div className="teacher-dashboard__subject-row">
                          <h3 className="teacher-dashboard__subject-name">
                            {item.subject?.name || 'Mata Pelajaran'}
                          </h3>
                          <span className="teacher-dashboard__class-pill">
                            {className}
                          </span>
                        </div>
                        <div className="teacher-dashboard__sched-meta">
                          <span>
                            Ruang: <strong>{item.room?.name || 'Ruang Belajar'}</strong>
                          </span>
                          <span>&bull;</span>
                          <span>Durasi: <strong>{item.duration_periods || 2} JP</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="teacher-dashboard__sched-actions">
                      {item.is_teaching_exempted || item.journal_status === 'exempted' ? (
                        <Badge variant="warning" title={item.exemption_reason || 'Dikecualikan dari KBM'}>
                          {item.exemption_reason ? `Dikecualikan: ${item.exemption_reason}` : 'Dikecualikan KBM'}
                        </Badge>
                      ) : isCompleted ? (
                        <>
                          <Badge variant="success">Jurnal Disimpan</Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Eye}
                            onClick={() =>
                              navigate('/teacher/journal', { state: { schedule: item } })
                            }
                          >
                            Detail
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={PlayCircle}
                          onClick={() =>
                            navigate('/teacher/journal', { state: { schedule: item } })
                          }
                        >
                          Buka Jurnal
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

        {/* Kolom Kanan: Kepatuhan Jurnal + Sebaran Beban Mingguan */}
        <div className="teacher-dashboard__col">
<div className="teacher-dashboard__section-card">
            <div className="teacher-dashboard__section-header">
              <h2 className="teacher-dashboard__section-title">
                <FileText size={18} className="text-amber-600" />
                <span>Status Kepatuhan Jurnal KBM</span>
              </h2>
              {missingJournals.length > 0 ? (
                <Badge variant="warning">{missingJournals.length} Perlu Diisi</Badge>
              ) : (
                <Badge variant="success">Lengkap</Badge>
              )}
            </div>

            {missingJournals.length === 0 ? (
              <div className="teacher-dashboard__journal-ok">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="teacher-dashboard__journal-ok-title">Semua Jurnal Terisi Rapi</span>
                  <span className="teacher-dashboard__journal-ok-sub">
                    Tidak ada tanggungan jurnal KBM yang terlewat pada jadwal Anda.
                  </span>
                </div>
              </div>
            ) : (
              <div className="teacher-dashboard__missing-list">
                {missingJournals.map((item, idx) => (
                  <div key={item.id || idx} className="teacher-dashboard__missing-item">
                    <div>
                      <div className="teacher-dashboard__missing-title">
                        {item.subject?.name} &bull; {item.school_class?.name || item.schoolClass?.name || 'Kelas'}
                      </div>
                      <div className="teacher-dashboard__missing-sub">
                        Jam ke-{item.period_number} &bull; Melewati batas 30 menit sejak KBM dimulai
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate('/teacher/journal', { state: { schedule: item } })}
                    >
                      Isi Sekarang
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {weekLoad.hasData && (
            <div className="teacher-dashboard__section-card">
              <div className="teacher-dashboard__section-header">
                <h2 className="teacher-dashboard__section-title">
                  <BarChart3 size={18} className="text-slate-800" />
                  <span>Sebaran Beban Mengajar Minggu Ini</span>
                </h2>
                <span className="teacher-dashboard__section-badge font-mono">
                  {stats.weeklyJp} JP &middot; {weekLoad.activeDays} hari
                </span>
              </div>

              <div className="teacher-dashboard__load-bars" role="img" aria-label="Sebaran jam pelajaran per hari dalam minggu ini">
                {weekLoad.days.map((day) => (
                  <div
                    key={day.day}
                    className={`teacher-dashboard__load-col ${day.isToday ? 'is-today' : ''}`}
                  >
                    <span className="teacher-dashboard__load-val font-mono">{day.jp}</span>
                    <span className="teacher-dashboard__load-track">
                      <span
                        className="teacher-dashboard__load-bar"
                        style={{ height: `${Math.max(day.jp > 0 ? 6 : 0, Math.round((day.jp / weekLoad.maxJp) * 100))}%` }}
                      />
                    </span>
                    <span className="teacher-dashboard__load-day">{day.label}</span>
                  </div>
                ))}
              </div>

              <p className="teacher-dashboard__load-foot">
                Hari terpadat <strong>{weekLoad.busiest.label} ({weekLoad.busiest.jp} JP)</strong>
                &nbsp;&middot;&nbsp; rata-rata {weekLoad.avgJp} JP/hari efektif
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
