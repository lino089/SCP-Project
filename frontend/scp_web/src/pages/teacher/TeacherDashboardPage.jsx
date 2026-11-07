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
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { journalApi } from '../../services/journalApi';
import { leaveApi } from '../../services/leaveApi';
import { academicSettingApi } from '../../services/scheduleApi';
import academicEventApi from '../../services/academicEventApi';
import { Badge, Button } from '../../components/shared';
import { resolveSlotTime } from '../../utils/timetableHelper';
import './TeacherDashboard.css';

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

  // Tanggal & Hari Berjalan (Indonesia)
  const dateInfo = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1 = Senin, ..., 7 = Minggu
    const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    const todayIso = now.toISOString().split('T')[0];
    return {
      dayOfWeek,
      dayName: dayNames[dayOfWeek] || 'Senin',
      todayIso,
      formattedDate: `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`,
      currentTimeStr: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
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

  // Muat Seluruh Data Dashboard Guru
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      // 1. Dapatkan setting akademik aktif
      let cycle = Number(user?.active_cycle || 1);
      try {
        const setRes = await academicSettingApi.getSettings();
        if (setRes?.data?.active_cycle) {
          cycle = Number(setRes.data.active_cycle);
          setActiveCycle(cycle);
        }
      } catch {
        // Gunakan default profil user
      }

      // 2. Fetch data paralel: Jadwal Hari Ini, Semua Jadwal Mingguan, Missing Journals, & Izin Guru
      const [todayRes, weeklyRes, missingRes, leaveRes, exemptionRes] = await Promise.all([
        journalApi.getTeacherSchedules({
          day: dateInfo.dayOfWeek,
          cycle,
          all: 1,
          per_page: 50,
        }),
        journalApi.getTeacherSchedules({
          cycle,
          all: 1,
          per_page: 200,
        }),
        journalApi.getMissingJournals().catch(() => ({ data: [] })),
        leaveApi.getTeacherLeaveRequests({ per_page: 20 }).catch(() => ({ data: [] })),
        academicEventApi.checkExemption().catch(() => null),
      ]);

      const exData = exemptionRes?.data ?? exemptionRes;
      if (exData && (exData.disabling_event !== undefined || exData.is_teaching_exempted !== undefined)) {
        setTodayExemption(exData);
      }

      const todayList = Array.isArray(todayRes) ? todayRes : Array.isArray(todayRes?.data) ? todayRes.data : [];
      setTodaySchedules(todayList);

      const weeklyList = Array.isArray(weeklyRes) ? weeklyRes : Array.isArray(weeklyRes?.data) ? weeklyRes.data : [];
      setWeeklySchedules(weeklyList);

      const missingList = Array.isArray(missingRes) ? missingRes : Array.isArray(missingRes?.data) ? missingRes.data : [];
      setMissingJournals(missingList);

      const leaveList = Array.isArray(leaveRes) ? leaveRes : Array.isArray(leaveRes?.data) ? leaveRes.data : [];
      setTeacherLeaves(leaveList);
    } catch (err) {
      console.warn('Gagal memuat data Dashboard Guru:', err);
      setLoadError(err.message || 'Gagal memuat jadwal dan data KBM harian.');
    } finally {
      setLoading(false);
    }
  }, [user?.active_cycle, dateInfo.dayOfWeek]);

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
            {teacherProfile.isWali && (
              <span className="teacher-dashboard__role-badge teacher-dashboard__role-badge--wali">
                Wali Kelas {teacherProfile.homeroomClassName}
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

        {/* Card 4: Status Kehadiran / Izin */}
        <div className="teacher-dashboard__stat-card">
          <div className="teacher-dashboard__stat-top">
            <span className="teacher-dashboard__stat-title">Status Mengajar</span>
            <span className="teacher-dashboard__stat-indicator teacher-dashboard__stat-indicator--neutral" />
          </div>
          <div className="teacher-dashboard__stat-body">
            <span className="teacher-dashboard__stat-value text-base font-bold text-gray-900">
              {stats.todayLeave ? 'Sedang Izin' : 'Aktif KBM'}
            </span>
          </div>
          <p className="teacher-dashboard__stat-desc">
            {stats.todayLeave ? 'Tercatat di sistem perizinan' : 'Siap melaksanakan KBM di kelas'}
          </p>
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
        {/* Kolom Kiri: Jadwal Mengajar Khusus Hari Ini */}
        <div className="teacher-dashboard__section-card">
          <div className="teacher-dashboard__section-header">
            <h2 className="teacher-dashboard__section-title">
              <Clock size={18} className="text-slate-800" />
              <span>Jadwal Mengajar Hari Ini</span>
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

        {/* Kolom Kanan: Peringatan Jurnal & Info Penugasan */}
        <div className="space-y-4">
          {/* Card: Peringatan Jurnal Belum Terisi */}
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
              <div className="py-6 px-4 text-center flex flex-col items-center">
                <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
                <h4 className="text-xs font-bold text-gray-800">Semua Jurnal Terisi Rapi</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Tidak ada tanggungan jurnal KBM yang terlewat pada jadwal Anda.
                </p>
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
                        Jam ke-{item.period_number} &bull; Selesai lebih dari 30 menit lalu
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        navigate('/teacher/journal', { state: { schedule: item } })
                      }
                    >
                      Isi Sekarang
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card: Informasi Tugas & Akademik */}
          <div className="teacher-dashboard__section-card">
            <div className="teacher-dashboard__section-header">
              <h2 className="teacher-dashboard__section-title">
                <GraduationCap size={18} className="text-blue-600" />
                <span>Informasi Akademik</span>
              </h2>
            </div>
            <div className="space-y-2 text-xs text-gray-700">
              <div className="p-2.5 bg-gray-50 rounded border border-gray-200">
                <span className="text-gray-500 block text-[11px]">Sistem Putaran Jadwal:</span>
                <strong className="text-gray-900 font-semibold">Putaran {activeCycle} (Berjalan)</strong>
              </div>
              {teacherProfile.isWali && (
                <div className="p-2.5 bg-blue-50/70 rounded border border-blue-200">
                  <span className="text-blue-600 block text-[11px] font-semibold">Tanggung Jawab Wali Kelas:</span>
                  <strong className="text-blue-950 font-bold">{teacherProfile.homeroomClassName}</strong>
                  <p className="text-[11px] text-blue-800 mt-1">
                    Anda dapat memantau jadwal dan kehadiran siswa rombel binaan Anda melalui menu Jadwal &amp; Monitoring.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
