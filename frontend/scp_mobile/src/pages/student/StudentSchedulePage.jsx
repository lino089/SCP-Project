import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RotateCw,
  AlertCircle,
  Layers,
  GraduationCap,
  Clock,
  User,
  MapPin,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { scheduleApi, academicSettingApi } from '../../services/scheduleApi';
import academicEventApi from '../../services/academicEventApi';
import { MobileScheduleTimeline } from '../../components/schedule';
import { Badge, Button, BottomSheetModal } from '../../components/shared';
import { resolveSlotTime } from '../../utils/timetableHelper';
import { unwrap, unwrapList } from '../../utils/responseHelper';
import { todayLocalISO } from '../../utils/dateUtils';

export default function StudentSchedulePage() {
  const { user } = useAuth();

  // Student Profile
  const student = useMemo(() => {
    return {
      name: user?.name || 'Peserta Didik',
      nis: user?.nis_nip || user?.nis || '-',
      className:
        user?.school_class?.name ||
        user?.schoolClass?.name ||
        user?.className ||
        (user?.class_id ? `Kelas #${user.class_id}` : 'Belum Ditentukan'),
      classId: user?.class_id || null,
      level: user?.school_class?.level || 10,
    };
  }, [user]);

  // Active Day & Cycle State
  const currentDayOfWeek = useMemo(() => {
    const day = new Date().getDay();
    if (day >= 1 && day <= 5) return day;
    return 1; // Default to Senin
  }, []);

  const [selectedCycle, setSelectedCycle] = useState(() => Number(user?.active_cycle || 1));
  const [selectedDay, setSelectedDay] = useState(currentDayOfWeek);
  const [mondayIsUpacara, setMondayIsUpacara] = useState(() => (typeof user?.monday_is_upacara === 'boolean' ? user.monday_is_upacara : true));
  const [periodTemplates, setPeriodTemplates] = useState([]);

  // Data states
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [todayEvent, setTodayEvent] = useState(null);

  // Detail Modal
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Fetch Settings & Schedules
  const loadScheduleData = useCallback(async () => {
    setFetchError(null);
    try {
      const [tplRes, setRes] = await Promise.all([
        academicSettingApi.getPeriodTemplates().catch(() => ({ data: [] })),
        academicSettingApi.getSettings().catch(() => ({ data: {} })),
      ]);

      if (tplRes?.data && Array.isArray(tplRes.data)) {
        setPeriodTemplates(tplRes.data);
      }
      const sData = setRes?.data || setRes;
      if (typeof sData?.monday_is_upacara === 'boolean') {
        setMondayIsUpacara(sData.monday_is_upacara);
      } else if (typeof user?.monday_is_upacara === 'boolean') {
        setMondayIsUpacara(user.monday_is_upacara);
      }

      // Ambil Jadwal Kelas
      if (student.classId) {
        const schedRes = await scheduleApi.getSchedules({
          class_id: student.classId,
          cycle: selectedCycle,
          per_page: 100,
        });
        setSchedules(unwrapList(schedRes));
      } else {
        setSchedules([]);
      }

      // Cek agenda khusus KBM (P-11: todayLocalISO, P-9: unwrap)
      const todayStr = todayLocalISO();
      try {
        const eventRes = await academicEventApi.checkExemption({
          for_my_class: 1,
          date: todayStr,
        });
        const eventData = unwrap(eventRes);
        if (eventData?.disabling_event) {
          setTodayEvent(eventData.disabling_event);
        } else {
          setTodayEvent(null);
        }
      } catch {
        setTodayEvent(null);
      }
    } catch (err) {
      console.warn('Gagal memuat jadwal siswa:', err);
      setFetchError(err.message || 'Gagal memuat jadwal pelajaran dari server.');
    } finally {
      setIsLoading(false);
    }
  }, [student.classId, selectedCycle]);

  useEffect(() => {
    let cancel = false;
    async function init() {
      try {
        await loadScheduleData();
      } catch {
        if (!cancel) setFetchError('Gagal menghubungkan ke server.');
      }
    }
    init();
    return () => {
      cancel = true;
    };
  }, [loadScheduleData]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await loadScheduleData();
  };

  const handleCardClick = (slot) => {
    setSelectedSlot(slot);
  };

  return (
    <div className="space-y-4">
      {/* Header Info Rombel */}
      <div className="surface-card p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-[var(--color-warning-fg)]" />
              <h1 className="font-semibold text-[var(--color-text-primary)] text-sm">{student.className}</h1>
              <Badge variant="outline" className="text-[11px] font-mono px-1.5 py-0">
                Tingkat {student.level}
              </Badge>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Jadwal Pelajaran Kelas {student.className}
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Refresh jadwal"
            className="p-2 rounded-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[var(--color-warning-fg)]' : ''}`} />
          </button>
        </div>

        {/* Cycle Switcher Tabs */}
        <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <Layers className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span className="font-medium">Putaran Siklus:</span>
          </div>
          <div className="flex gap-1 bg-[var(--color-surface-subtle)] p-0.5 rounded-[10px] border border-[var(--color-border-subtle)]">
            <button
              onClick={() => {
                setSelectedCycle(1);
                setIsLoading(true);
              }}
              className={`px-3 py-1 rounded-[10px] text-xs font-semibold transition-all ${
                selectedCycle === 1
                  ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Siklus 1
            </button>
            <button
              onClick={() => {
                setSelectedCycle(2);
                setIsLoading(true);
              }}
              className={`px-3 py-1 rounded-[10px] text-xs font-semibold transition-all ${
                selectedCycle === 2
                  ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Siklus 2
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {fetchError && (
        <div className="mb-4 p-3.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] flex items-center justify-between gap-3 text-[var(--color-danger-fg)] text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-danger-fg)]" />
            <span>{fetchError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            className="shrink-0 text-[var(--color-danger-fg)] border-[var(--color-danger-border)] hover:bg-[var(--color-danger-bg)]"
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Disabling Event Banner */}
      {todayEvent && (
        <div className="mb-4 p-3.5 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[14px] flex items-start gap-3 text-[var(--color-warning-fg)] text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-warning-fg)] mt-0.5" />
          <div>
            <span className="font-semibold block">{todayEvent.title}</span>
            <span className="text-[var(--color-text-secondary)] mt-0.5 block">
              Agenda ini meniadakan kegiatan pembelajaran reguler untuk kelas Anda.
            </span>
          </div>
        </div>
      )}

      {/* Timeline Jadwal Hari Terpilih */}
      <MobileScheduleTimeline
        schedules={schedules}
        mondayIsUpacara={mondayIsUpacara}
        periodTemplates={periodTemplates}
        role="student"
        selectedDay={selectedDay}
        onChangeDay={setSelectedDay}
        isLoading={isLoading}
        onCardClick={handleCardClick}
      />

      {/* Modal Detail Sesi KBM */}
      <BottomSheetModal
        isOpen={Boolean(selectedSlot)}
        onClose={() => setSelectedSlot(null)}
        title="Detail Sesi Pelajaran"
        subtitle={selectedSlot?.subject?.name || 'Mata Pelajaran'}
        size="md"
      >
        {selectedSlot && (
          <div className="space-y-3.5 pb-2 text-xs">
            <div className="p-3 bg-[var(--color-bg-app)] surface-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)]">Mata Pelajaran:</span>
                <span className="font-semibold text-[var(--color-text-primary)] text-right">
                  {selectedSlot.subject?.name || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)]">Guru Pengampu:</span>
                <span className="font-semibold text-[var(--color-text-primary)] text-right flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  {selectedSlot.teacher?.name || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)]">Ruangan Kelas:</span>
                <span className="font-medium text-[var(--color-text-primary)] text-right flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  {selectedSlot.room?.name || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)]">Jam Pelajaran:</span>
                <Badge variant="outline" className="font-mono text-[11px]">
                  Jam ke-{selectedSlot.period_number} ({selectedSlot.duration_periods || 1} JP)
                </Badge>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border-subtle)]/60">
                <span className="text-[var(--color-text-secondary)]">Waktu KBM:</span>
                <span className="font-mono font-semibold text-[var(--color-text-primary)] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  {resolveSlotTime(
                    selectedSlot.day_of_week || selectedDay,
                    selectedSlot.period_number || 1,
                    selectedSlot.duration_periods || 1
                  ).timeText} WIB
                </span>
              </div>
            </div>

            <div className="p-3 bg-[var(--color-warning-bg)]/60 border border-[var(--color-warning-border)] rounded-[14px] flex items-start gap-2.5 text-[var(--color-warning-fg)]">
              <BookOpen className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-warning-fg)]" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-semibold block">Catatan Kehadiran KBM</span>
                Pastikan Anda hadir tepat waktu di ruangan sebelum jam pelajaran dimulai.
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setSelectedSlot(null)}
              className="w-full mt-2"
            >
              Tutup Detail
            </Button>
          </div>
        )}
      </BottomSheetModal>
    </div>
  );
}
