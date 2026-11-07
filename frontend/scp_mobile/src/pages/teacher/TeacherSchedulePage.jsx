import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCw,
  PlayCircle,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import journalApi from '../../services/journalApi';
import { scheduleApi, academicSettingApi } from '../../services/scheduleApi';
import {
  DAYS_LIST,
  DAY_TO_NUMBER,
  resolveSlotTime,
  detectScheduleConflicts,
} from '../../utils/timetableHelper';
import { Badge, Button } from '../../components/shared';
import { SkeletonCard, EmptyState, ErrorState } from '../../components/feedback';

export default function TeacherSchedulePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Konteks Penugasan Wali Kelas
  const homeroomAssignment = useMemo(() => {
    return user?.assignments?.find((a) => a.type === 'wali_kelas');
  }, [user]);

  const homeroomClassId = homeroomAssignment?.class_id;
  const homeroomClassName =
    homeroomAssignment?.school_class?.name ||
    homeroomAssignment?.class_name ||
    (homeroomClassId ? `Kelas #${homeroomClassId}` : null);

  // View Context: 'my_schedule' | 'homeroom'
  const [scheduleContext, setScheduleContext] = useState('my_schedule');

  // Academic Settings
  const [activeCycle, setActiveCycle] = useState(() => Number(user?.active_cycle || 1));
  const [selectedCycle, setSelectedCycle] = useState(() => Number(user?.active_cycle || 1));
  const [mondayIsUpacara, setMondayIsUpacara] = useState(true);
  const [periodTemplates, setPeriodTemplates] = useState([]);

  // Filter States
  const [selectedDay, setSelectedDay] = useState(() => {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const todayName = dayNames[new Date().getDay()];
    return DAYS_LIST.includes(todayName) ? todayName : 'Senin';
  });

  // Schedule datasets
  const [mySchedules, setMySchedules] = useState([]);
  const [homeroomSchedules, setHomeroomSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Fetch Settings once
  useEffect(() => {
    academicSettingApi.getSettings()
      .then((res) => {
        if (res?.data) {
          const c = Number(res.data.active_cycle || 1);
          setActiveCycle(c);
          setSelectedCycle(c);
          setMondayIsUpacara(Boolean(res.data.monday_is_upacara));
          if (Array.isArray(res.data.period_templates)) {
            setPeriodTemplates(res.data.period_templates);
          }
        }
      })
      .catch(() => {});
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const myRes = await journalApi.getTeacherSchedules({ cycle_type: selectedCycle });
      const myList = Array.isArray(myRes) ? myRes : Array.isArray(myRes?.data) ? myRes.data : [];
      setMySchedules(myList);

      if (homeroomClassId) {
        const hrRes = await scheduleApi.getAll({
          class_id: homeroomClassId,
          cycle_type: selectedCycle,
        });
        const hrList = Array.isArray(hrRes) ? hrRes : Array.isArray(hrRes?.data) ? hrRes.data : [];
        setHomeroomSchedules(hrList);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message || 'Gagal memuat jadwal pelajaran.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCycle, homeroomClassId]);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const myRes = await journalApi.getTeacherSchedules({ cycle_type: selectedCycle });
        const myList = Array.isArray(myRes) ? myRes : Array.isArray(myRes?.data) ? myRes.data : [];
        if (isMounted) setMySchedules(myList);

        if (homeroomClassId) {
          const hrRes = await scheduleApi.getAll({
            class_id: homeroomClassId,
            cycle_type: selectedCycle,
          });
          const hrList = Array.isArray(hrRes) ? hrRes : Array.isArray(hrRes?.data) ? hrRes.data : [];
          if (isMounted) setHomeroomSchedules(hrList);
        }
        if (isMounted) setLoadError(null);
      } catch (err) {
        if (isMounted) setLoadError(err.message || 'Gagal memuat jadwal pelajaran.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [selectedCycle, homeroomClassId]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchSchedules();
  };

  // Conflict Detection
  const conflicts = useMemo(() => {
    return detectScheduleConflicts(mySchedules);
  }, [mySchedules]);

  // Active Schedule List based on context & selected day
  const activeList = useMemo(() => {
    const source = scheduleContext === 'homeroom' ? homeroomSchedules : mySchedules;
    const targetDayNum = DAY_TO_NUMBER[selectedDay];
    return source
      .filter((s) => Number(s.day_of_week) === targetDayNum)
      .sort((a, b) => Number(a.period_number) - Number(b.period_number));
  }, [scheduleContext, homeroomSchedules, mySchedules, selectedDay]);

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="surface-card p-3.5 shadow-[var(--shadow-card)] flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-[var(--color-text-primary)]">Jadwal Mengajar Guru</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Siklus Aktif: <span className="font-bold text-[var(--color-brand-text)]">Siklus {activeCycle}</span>
          </p>
        </div>

        <div className="flex bg-[var(--color-surface-subtle)] p-1 rounded-[14px]">
          <button
            type="button"
            onClick={() => setSelectedCycle(1)}
            className={`px-3 py-1 rounded-[10px] text-xs font-bold transition-all ${
              selectedCycle === 1
                ? 'bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Siklus 1
          </button>
          <button
            type="button"
            onClick={() => setSelectedCycle(2)}
            className={`px-3 py-1 rounded-[10px] text-xs font-bold transition-all ${
              selectedCycle === 2
                ? 'bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Siklus 2
          </button>
        </div>
      </div>

      {/* Context Toggle: Jadwal Saya vs Kelas Binaan (Wali Kelas) */}
      {homeroomClassName && (
        <div className="flex bg-[var(--color-surface-subtle)] p-1 rounded-[16px]">
          <button
            type="button"
            onClick={() => setScheduleContext('my_schedule')}
            className={`flex-1 py-1.5 rounded-[14px] text-xs font-bold transition-all ${
              scheduleContext === 'my_schedule'
                ? 'bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Jadwal Saya Pribadi
          </button>
          <button
            type="button"
            onClick={() => setScheduleContext('homeroom')}
            className={`flex-1 py-1.5 rounded-[14px] text-xs font-bold transition-all ${
              scheduleContext === 'homeroom'
                ? 'bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Kelas Binaan ({homeroomClassName})
          </button>
        </div>
      )}

      {/* Conflict Warning */}
      {conflicts.length > 0 && scheduleContext === 'my_schedule' && (
        <div className="p-3 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[14px] flex items-start gap-2.5">
          <AlertTriangle className="text-[var(--color-warning-fg)] shrink-0 mt-0.5" size={16} />
          <div className="text-[11px] text-[var(--color-warning-fg)] leading-relaxed">
            <span className="font-bold">Perhatian:</span> Terdapat {conflicts.length} bentrok jadwal pada jadwal mengajar Anda. Hubungi Waka Kurikulum untuk penyesuaian.
          </div>
        </div>
      )}

      {/* Horizontal Day Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {DAYS_LIST.slice(0, 6).map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => setSelectedDay(day)}
            className={`px-3.5 py-1.5 rounded-[14px] text-xs font-bold shrink-0 transition-all ${
              selectedDay === day
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] font-semibold shadow-[var(--shadow-pill)]'
                : 'bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Schedule Items List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="section-label">
            {scheduleContext === 'homeroom'
              ? `Jadwal ${homeroomClassName} • ${selectedDay}`
              : `Jadwal Mengajar • ${selectedDay}`}{' '}
            ({activeList.length} Slot)
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            className="p-1 h-7 w-7 min-h-0"
            aria-label="Segarkan"
          >
            <RotateCw size={14} />
          </Button>
        </div>

        {isLoading ? (
          <SkeletonCard count={3} />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={handleRefresh} />
        ) : activeList.length === 0 ? (
          <EmptyState
            title="Tidak Ada Jadwal"
            message={`Tidak ada sesi pelajaran terdaftar pada hari ${selectedDay} (${selectedCycle === 1 ? 'Siklus 1' : 'Siklus 2'}).`}
          />
        ) : (
          <div className="space-y-2">
            {activeList.map((schedule) => {
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
                  className="surface-card p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="warning" size="sm">
                          Jam Ke-{schedule.period_number} ({schedule.duration_periods} JP)
                        </Badge>
                        <span className="text-[11px] font-mono text-[var(--color-text-secondary)] font-bold bg-[var(--color-surface-subtle)] px-1.5 py-0.5 rounded-[6px]">
                          {timeSlot.timeText}
                        </span>
                        <Badge variant="neutral" size="sm">
                          {schedule.school_class?.name || 'Rombel'}
                        </Badge>
                      </div>

                      <h3 className="text-xs font-bold text-[var(--color-text-primary)] mt-1 truncate">
                        {schedule.subject?.name || 'Mata Pelajaran'}
                      </h3>

                      {scheduleContext === 'homeroom' && (
                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate mt-0.5">
                          Guru: <span className="font-semibold">{schedule.teacher?.name || '-'}</span>
                        </p>
                      )}

                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        Ruang: <span className="font-semibold text-[var(--color-text-secondary)]">{schedule.room?.name || '-'}</span>
                      </p>
                    </div>

                    <div className="shrink-0">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => navigate('/teacher/journal', { state: { schedule } })}
                        className="px-2.5 py-1.5 text-xs font-bold gap-1 bg-[var(--color-warning-bg)] hover:bg-[var(--color-brand)] text-[var(--color-text-primary)]"
                      >
                        <PlayCircle size={14} />
                        Buka Sesi
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
