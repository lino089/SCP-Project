import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  FileText,
  AlertCircle,
  PlayCircle,
  RotateCw,
  Sparkles,
  ArrowRight,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import journalApi from '../../services/journalApi';
import academicEventApi from '../../services/academicEventApi';
import { Badge, Button } from '../../components/shared';
import { resolveSlotTime } from '../../utils/timetableHelper';
import { SkeletonCard, ErrorState } from '../../components/feedback';
import { unwrap, unwrapList } from '../../utils/responseHelper';
import { getJakartaDayInfo } from '../../utils/dateUtils';

export default function TeacherDashboardPage() {
  const { user, isWaliKelas, isKesiswaan } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activeCycle, setActiveCycle] = useState(() => Number(user?.active_cycle || 1));
  const [mondayIsUpacara] = useState(() => Boolean(user?.academic_setting?.monday_is_upacara ?? true));
  const [periodTemplates] = useState(() => user?.academic_setting?.period_templates || []);

  const [todaySchedules, setTodaySchedules] = useState([]);
  const [weeklySchedules, setWeeklySchedules] = useState([]);
  const [missingJournals, setMissingJournals] = useState([]);
  const [todayExemption, setTodayExemption] = useState(null);

  // Tanggal & Hari Berjalan (Indonesia) berbasis Asia/Jakarta (P-11)
  const dateInfo = useMemo(() => {
    const dayInfo = getJakartaDayInfo();
    return {
      dayOfWeek: dayInfo.dayOfWeek,
      dayName: dayInfo.dayName,
      todayIso: dayInfo.dateStr,
      formattedDate: dayInfo.formattedDate,
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
      isWali: Boolean(isWaliKelas?.() && homeroomClassName),
      homeroomClassName,
      isKesiswaanRole: Boolean(isKesiswaan?.()),
    };
  }, [user, isWaliKelas, isKesiswaan]);

  const fetchDashboardData = useCallback(async () => {
    try {
      // 1. Ambil active cycle dari user profile (P-13: hilangkan 403 /academic-settings)
      const cycle = Number(user?.academic_setting?.active_cycle || user?.active_cycle || 1);
      setActiveCycle(cycle);

      const [allSchedRes, missingRes, eventRes] = await Promise.allSettled([
        journalApi.getTeacherSchedules({ cycle_type: cycle }),
        journalApi.getMissingJournals(),
        academicEventApi.checkExemption({ date: dateInfo.todayIso }),
      ]);

      if (allSchedRes.status === 'fulfilled') {
        const list = unwrapList(allSchedRes.value);
        setWeeklySchedules(list);
        const todayList = list.filter((s) => Number(s.day_of_week) === dateInfo.dayOfWeek);
        setTodaySchedules(todayList);
      }

      if (missingRes.status === 'fulfilled') {
        const list = unwrapList(missingRes.value);
        setMissingJournals(list);
      }

      if (eventRes.status === 'fulfilled') {
        const exData = unwrap(eventRes.value);
        if (exData && (exData.disabling_event !== undefined || exData.is_teaching_exempted !== undefined)) {
          setTodayExemption(exData);
        } else {
          setTodayExemption(null);
        }
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message || 'Gagal memuat jadwal mengajar dan ringkasan.');
    } finally {
      setLoading(false);
    }
  }, [user, dateInfo]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardData();
  };

  // Perhitungan Beban Jam Pelajaran (JP)
  const jpSummary = useMemo(() => {
    const todayJp = todaySchedules.reduce((acc, s) => acc + Number(s.duration_periods || 2), 0);
    const weeklyJp = weeklySchedules.reduce((acc, s) => acc + Number(s.duration_periods || 2), 0);
    return { todayJp, weeklyJp };
  }, [todaySchedules, weeklySchedules]);


  // Sebaran beban per hari (Senin–Sabtu) dari jadwal mingguan
  const weekLoad = useMemo(() => {
    const labels = { 1: 'Sen', 2: 'Sel', 3: 'Rab', 4: 'Kam', 5: 'Jum', 6: 'Sab' };
    const days = [1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      label: labels[day],
      jp: 0,
      isToday: Number(dateInfo.dayOfWeek) === day,
    }));

    weeklySchedules.forEach((item) => {
      const row = days.find((d) => d.day === Number(item.day_of_week));
      if (row) row.jp += Number(item.duration_periods || 2);
    });

    const maxJp = Math.max(...days.map((d) => d.jp), 1);
    const activeDays = days.filter((d) => d.jp > 0).length;
    const totalJp = days.reduce((acc, d) => acc + d.jp, 0);
    const busiest = days.reduce((a, b) => (b.jp > a.jp ? b : a), days[0]);

    return {
      days,
      maxJp,
      busiest,
      hasData: totalJp > 0,
      avgJp: activeDays > 0 ? (totalJp / activeDays).toFixed(1).replace('.', ',') : '0',
    };
  }, [weeklySchedules, dateInfo.dayOfWeek]);

  // Jadwal hari kerja berikutnya (maks. 2 sesi)
  const nextSchedules = useMemo(() => {
    const names = { 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu', 7: 'Minggu' };
    const today = Number(dateInfo.dayOfWeek);
    for (let offset = 1; offset <= 7; offset += 1) {
      const targetDay = ((today - 1 + offset) % 7) + 1;
      const items = weeklySchedules.filter((x) => Number(x.day_of_week) === targetDay);
      if (items.length === 0) continue;
      return { dayLabel: names[targetDay], items: items.slice(0, 2) };
    }
    return null;
  }, [weeklySchedules, dateInfo.dayOfWeek]);

  if (loading) {
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
      {/* Profil Guru & Status Card */}
      <section className="surface-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="section-label">Pendidik &amp; Pengampu</p>
            <h1 className="text-[17px] font-semibold text-[var(--color-text-primary)] mt-1 leading-snug truncate">
              {teacherProfile.name}
            </h1>
            <p className="text-meta mt-1">
              NIP: {teacherProfile.nip} · {dateInfo.dayName}, {dateInfo.formattedDate}
            </p>

            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <Badge variant="success" size="sm" dot>
                Siklus {activeCycle}
              </Badge>
              {teacherProfile.isWali && (
                <Badge variant="neutral" size="sm">
                  Wali Kelas {teacherProfile.homeroomClassName}
                </Badge>
              )}
              {teacherProfile.isKesiswaanRole && (
                <Badge variant="neutral" size="sm">
                  Kesiswaan / BK
                </Badge>
              )}
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            className="p-0 min-h-0 h-8 w-8 shrink-0"
            aria-label="Segarkan"
          >
            <RotateCw size={16} strokeWidth={1.75} />
          </Button>
        </div>

        {/* Ringkasan JP */}
        <div className="grid grid-cols-2 gap-0 pt-3 border-t border-[var(--color-border-subtle)] divide-x divide-[var(--color-border-subtle)]">
          <div className="pr-3">
            <p className="section-label">Hari Ini</p>
            <p className="metric-value mt-1">
              {todaySchedules.length}
              <span className="text-[11px] font-medium text-[var(--color-text-secondary)] ml-1">
                sesi · {jpSummary.todayJp} JP
              </span>
            </p>
          </div>
          <div className="pl-3">
            <p className="section-label">Minggu Ini</p>
            <p className="metric-value mt-1">
              {weeklySchedules.length}
              <span className="text-[11px] font-medium text-[var(--color-text-secondary)] ml-1">
                sesi · {jpSummary.weeklyJp} JP
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Agenda Sekolah Menghalangi KBM */}
      {todayExemption && (
        <div className="p-3 bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded-[14px] flex items-start gap-2.5">
          <Calendar className="text-[var(--color-info-fg)] shrink-0 mt-0.5" size={16} />
          <div className="text-xs text-[var(--color-info-fg)] leading-relaxed">
            <span className="font-bold">Agenda Sekolah Aktif:</span> {todayExemption.title}. KBM ditiadakan dan guru dibebaskan dari kewajiban pengisian jurnal hari ini.
          </div>
        </div>
      )}

      {/* Peringatan Jurnal Terlewat (Missing Journals) */}
      {missingJournals.length > 0 && (
        <div className="p-3.5 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[14px] flex items-start gap-3">
          <AlertCircle className="text-[var(--color-warning-fg)] shrink-0 mt-0.5" size={18} />
          <div className="flex-1 min-w-0">
            <h2 className="text-xs font-bold text-[var(--color-warning-fg)]">
              {missingJournals.length} Jurnal KBM Perlu Dilengkapi
            </h2>
            <p className="text-[11px] text-[var(--color-warning-fg)] mt-0.5 leading-relaxed">
              Terdapat sesi mengajar yang telah usai namun belum diselesaikan laporannya beserta presensi siswa.
            </p>
          </div>
        </div>
      )}

      {/* Quick Menu Shortcuts */}
      <div>
        <h2 className="section-label">
          Menu Operasional Guru
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/teacher/schedule')}
            className="p-3 surface-card text-left hover:border-[var(--color-border-strong)] transition-all active:scale-[0.99] flex flex-col justify-between h-20"
          >
            <div className="icon-tile icon-tile--sm">
              <Clock size={15} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-text-primary)]">Jadwal Mengajar</p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">Pribadi &amp; binaan</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/teacher/quiz')}
            className="p-3 surface-card text-left hover:border-[var(--color-border-strong)] transition-all active:scale-[0.99] flex flex-col justify-between h-20"
          >
            <div className="icon-tile icon-tile--sm">
              <Sparkles size={15} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-text-primary)]">Kuis Pembelajaran</p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">Generate &amp; koreksi</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/teacher/leave')}
            className="p-3 surface-card text-left hover:border-[var(--color-border-strong)] transition-all active:scale-[0.99] flex flex-col justify-between h-20"
          >
            <div className="icon-tile icon-tile--sm">
              <FileText size={15} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-text-primary)]">Izin Mengajar</p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">Ajukan izin &amp; tugas</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/teacher/calendar')}
            className="p-3 surface-card text-left hover:border-[var(--color-border-strong)] transition-all active:scale-[0.99] flex flex-col justify-between h-20"
          >
            <div className="icon-tile icon-tile--sm">
              <Calendar size={15} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-text-primary)]">Kalender Akademik</p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">Agenda &amp; masa ujian</p>
            </div>
          </button>

          {(teacherProfile.isWali || teacherProfile.isKesiswaanRole) && (
            <button
              type="button"
              onClick={() => navigate('/teacher/permissions')}
              className="col-span-2 p-3 surface-card text-left hover:border-[var(--color-border-strong)] transition-all active:scale-[0.99] flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="icon-tile icon-tile--sm">
                  <CheckSquare size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--color-text-primary)]">Verifikasi Perizinan</p>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    {teacherProfile.isKesiswaanRole
                      ? 'Persetujuan izin siswa & guru sekolah'
                      : `Monitoring izin siswa binaan ${teacherProfile.homeroomClassName}`}
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-[var(--color-text-muted)]" />
            </button>
          )}
        </div>
      </div>

      {/* Jadwal Mengajar Hari Ini */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="section-label">
            Jadwal Mengajar Hari Ini ({todaySchedules.length})
          </h2>
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            {dateInfo.dayName}
          </span>
        </div>

        {todaySchedules.length === 0 ? (
          <div className="p-4 surface-card text-center space-y-1">
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">Tidak Ada Jadwal Mengajar</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Anda tidak memiliki jadwal mengajar terdaftar pada hari {dateInfo.dayName}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todaySchedules.map((schedule) => {
              const timeSlot = resolveSlotTime(
                schedule.day_of_week,
                schedule.period_number,
                schedule.duration_periods,
                mondayIsUpacara,
                periodTemplates
              );

              return (
                <div
                  key={schedule.id}
                  className="surface-card p-3 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="neutral" size="sm">
                          {schedule.school_class?.name || 'Rombel'}
                        </Badge>
                        <Badge variant="warning" size="sm">
                          Jam Ke-{schedule.period_number} ({schedule.duration_periods} JP)
                        </Badge>
                        <span className="text-[11px] font-mono text-[var(--color-text-secondary)] font-bold bg-[var(--color-surface-subtle)] px-1.5 py-0.5 rounded-[6px]">
                          {timeSlot.timeText}
                        </span>
                      </div>

                      <h3 className="text-xs font-bold text-[var(--color-text-primary)] mt-1 truncate">
                        {schedule.subject?.name || 'Mata Pelajaran'}
                      </h3>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                        Ruang: <span className="font-semibold text-[var(--color-text-primary)]">{schedule.room?.name || '-'}</span>
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => navigate('/teacher/journal', { state: { schedule } })}
                    className="w-full gap-2 text-xs font-bold py-2 bg-[var(--color-warning-bg)] hover:bg-[var(--color-brand)] text-[var(--color-text-primary)]"
                  >
                    <PlayCircle size={15} />
                    Buka Sesi Kelas &amp; Isi Jurnal KBM
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sebaran Beban Mengajar Minggu Ini */}
      {weekLoad.hasData && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="section-label">Sebaran Beban Minggu Ini</h2>
            <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
              {jpSummary.weeklyJp} JP
            </span>
          </div>
          <div className="surface-card p-3">
            <div className="grid grid-cols-6 gap-1.5 items-end">
              {weekLoad.days.map((day) => (
                <div key={day.day} className="flex flex-col items-center gap-1">
                  <span
                    className={`text-[10px] font-mono ${
                      day.isToday
                        ? 'font-bold text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-muted)]'
                    }`}
                  >
                    {day.jp}
                  </span>
                  <span className="w-full h-[64px] flex items-end rounded bg-[var(--color-surface-subtle)] overflow-hidden">
                    <span
                      className={`w-full rounded ${
                        day.isToday ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-border-strong)]'
                      }`}
                      style={{
                        height: `${Math.max(day.jp > 0 ? 6 : 0, Math.round((day.jp / weekLoad.maxJp) * 100))}%`,
                      }}
                    />
                  </span>
                  <span
                    className={`text-[9px] font-semibold ${
                      day.isToday
                        ? 'text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-muted)]'
                    }`}
                  >
                    {day.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 pt-2 border-t border-[var(--color-border-light)] text-[10px] text-[var(--color-text-muted)]">
              Terpadat{' '}
              <b className="text-[var(--color-text-primary)]">
                {weekLoad.busiest.label} ({weekLoad.busiest.jp} JP)
              </b>{' '}
              &middot; rata-rata {weekLoad.avgJp} JP/hari
            </p>
          </div>
        </div>
      )}

      {/* Jadwal Berikutnya */}
      {nextSchedules && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="section-label">Jadwal Berikutnya</h2>
            <span className="text-[11px] text-[var(--color-text-muted)]">{nextSchedules.dayLabel}</span>
          </div>
          <div className="surface-card divide-y divide-[var(--color-border-light)]">
            {nextSchedules.items.map((item, idx) => (
              <div key={item.id || idx} className="p-3 flex items-start gap-2.5">
                <span className="text-[10px] font-mono font-semibold text-[var(--color-text-secondary)] min-w-[58px] pt-0.5">
                  {
                    resolveSlotTime(
                      item.day_of_week,
                      item.period_number,
                      item.duration_periods,
                      mondayIsUpacara,
                      periodTemplates
                    ).timeText
                  }
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                    {item.subject?.name || 'Mata Pelajaran'}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    {item.school_class?.name || item.schoolClass?.name || 'Rombel'} &middot;{' '}
                    {item.room?.name || 'Ruang Belajar'} &middot; {item.duration_periods || 2} JP
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
