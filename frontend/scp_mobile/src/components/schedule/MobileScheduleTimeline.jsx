import { useState, useMemo } from 'react';
import {
  Clock,
  MapPin,
  User,
  Coffee,
  AlertTriangle,
  Sparkles,
  LogOut,
} from 'lucide-react';
import {
  SCHOOL_DAYS,
  NUMBER_TO_DAY,
  getMorningActivity,
  getTimeSlotsForDay,
  getBreaksForDay,
  resolveSlotTime,
  getDismissalTimeForDay,
} from '../../utils/timetableHelper';
import Badge from '../shared/Badge';
import './MobileScheduleTimeline.css';

export default function MobileScheduleTimeline({
  schedules = [],
  mondayIsUpacara = true,
  periodTemplates = null,
  role = 'teacher',
  onCardClick = null,
  selectedDay = null,
  onChangeDay = null,
  isLoading = false,
  conflictIds = new Set(),
}) {
  // Determine current day of week (1 = Senin..5 = Jumat)
  const currentDayOfWeek = useMemo(() => {
    const day = new Date().getDay();
    if (day >= 1 && day <= 5) return day;
    return 1; // Default to Senin if weekend
  }, []);

  const [internalDay, setInternalDay] = useState(currentDayOfWeek);
  const activeDay = selectedDay ?? internalDay;

  const handleDaySelect = (dayId) => {
    if (onChangeDay) {
      onChangeDay(dayId);
    } else {
      setInternalDay(dayId);
    }
  };

  const dayName = NUMBER_TO_DAY[activeDay] || 'Senin';
  const morningActivity = getMorningActivity(dayName, mondayIsUpacara);
  const daySlots = getTimeSlotsForDay(dayName, mondayIsUpacara, periodTemplates);
  const breakList = getBreaksForDay(dayName, mondayIsUpacara);
  const dismissalTime = getDismissalTimeForDay(
    schedules,
    dayName,
    mondayIsUpacara,
    periodTemplates
  );

  // Filter schedules for the active day
  const daySchedules = useMemo(() => {
    return (schedules || []).filter((s) => {
      const sDay =
        typeof s.day_of_week === 'number'
          ? s.day_of_week
          : s.day === dayName
          ? activeDay
          : null;
      return sDay === activeDay;
    });
  }, [schedules, activeDay, dayName]);

  // Track covered slots so multi-JP lessons aren't rendered multiple times
  const { renderedRows } = useMemo(() => {
    const rows = [];
    const coveredSlots = new Set();

    daySlots.forEach((slotObj) => {
      const slotNum = slotObj.slot;

      // Check if slot has already been consumed by a multi-JP lesson
      if (coveredSlots.has(slotNum)) {
        return;
      }

      // Find schedule starting at this slot
      const startingSchedule = daySchedules.find((s) => {
        const sSlot = Number(s.slot || s.period_number || 1);
        return sSlot === slotNum;
      });

      if (startingSchedule) {
        const duration = Number(
          startingSchedule.duration ||
            startingSchedule.duration_periods ||
            1
        );
        for (let d = 0; d < duration; d++) {
          coveredSlots.add(slotNum + d);
        }

        const slotTime = resolveSlotTime(
          dayName,
          slotNum,
          duration,
          mondayIsUpacara,
          periodTemplates
        );

        rows.push({
          type: 'lesson',
          slot: slotNum,
          duration,
          slotTime,
          schedule: startingSchedule,
        });
      } else {
        coveredSlots.add(slotNum);
        rows.push({
          type: 'empty',
          slot: slotNum,
          slotTime: {
            startTime: slotObj.start,
            endTime: slotObj.end,
            timeText: `${slotObj.start} - ${slotObj.end}`,
          },
          schedule: null,
        });
      }

      // Check if there is a break after this slot
      const matchingBreak = breakList.find((b) => b.afterSlot === slotNum);
      if (matchingBreak) {
        rows.push({
          type: 'break',
          breakInfo: matchingBreak,
        });
      }
    });

    return { renderedRows: rows };
  }, [daySlots, daySchedules, dayName, mondayIsUpacara, periodTemplates, breakList]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-12 bg-[var(--color-border-subtle)] rounded-[16px] animate-pulse" />
        <div className="h-16 bg-[var(--color-surface-subtle)] rounded-[16px] animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-20 bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-[16px] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-timeline">
      {/* 1. Day Navigation Tabs (5 Days) */}
      <div className="schedule-day-tabs">
        {SCHOOL_DAYS.map((d) => {
          const isActive = d.id === activeDay;
          const isToday = d.id === currentDayOfWeek;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => handleDaySelect(d.id)}
              className={`schedule-day-tab ${
                isActive ? 'schedule-day-tab--active' : ''
              } ${isToday ? 'schedule-day-tab--today' : ''}`}
            >
              <span className="schedule-day-tab__name">
                {isActive ? d.name : d.short}
              </span>
              {isToday && <span className="schedule-day-tab__indicator" />}
            </button>
          );
        })}
      </div>

      {/* 2. Morning Habituation / Ceremony Banner (07:00 WIB) */}
      {morningActivity && (
        <div
          className={`schedule-morning-banner schedule-morning-banner--${
            morningActivity.variant || 'neutral'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[14px] bg-[var(--color-surface)]/80 border border-current/20 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold font-sans">
                  {morningActivity.title}
                </span>
                <Badge
                  variant={morningActivity.variant === 'warning' ? 'warning' : 'neutral'}
                  className="text-[9px] px-1.5 py-0"
                >
                  {morningActivity.badge}
                </Badge>
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">
                {morningActivity.description}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold shrink-0">
            {morningActivity.time}
          </span>
        </div>
      )}

      {/* 3. Timeline Rows (Lessons, Breaks, Empty Slots) */}
      <div className="space-y-2.5">
        {renderedRows.map((row, idx) => {
          if (row.type === 'break') {
            return (
              <div
                key={`break-${row.breakInfo.afterSlot}-${idx}`}
                className="schedule-break-row"
              >
                <div className="flex items-center gap-2 font-medium text-amber-900">
                  <Coffee size={14} className="text-amber-600" />
                  <span className="font-semibold">{row.breakInfo.name}</span>
                  <span className="text-[11px] text-amber-700 font-mono">
                    ({row.breakInfo.duration} Menit)
                  </span>
                </div>
                <span className="font-mono font-bold text-amber-900">
                  {row.breakInfo.time} WIB
                </span>
              </div>
            );
          }

          if (row.type === 'empty') {
            return (
              <div
                key={`empty-${row.slot}-${idx}`}
                className="schedule-empty-slot"
              >
                <span>Jam Ke-{row.slot} • Bebas KBM / Tidak Ada Sesi Terjadwal</span>
                <span className="font-mono text-[var(--color-text-muted)]">
                  {row.slotTime.timeText}
                </span>
              </div>
            );
          }

          // Lesson Row
          const sch = row.schedule;
          const isConflict = conflictIds.has(sch.id);
          const subjectName = sch.subject?.name || sch.subjectName || 'Mata Pelajaran';
          const className =
            sch.school_class?.name ||
            sch.schoolClass?.name ||
            sch.className ||
            (sch.class_id ? `Kelas #${sch.class_id}` : '-');
          const teacherName = sch.teacher?.name || sch.teacherName || 'Guru Pengampu';
          const roomName = sch.room?.name || sch.roomName || 'Ruang';

          return (
            <button
              key={`lesson-${sch.id || row.slot}-${idx}`}
              type="button"
              onClick={() => onCardClick?.(sch)}
              className={`schedule-lesson-card ${
                isConflict ? 'schedule-lesson-card--conflict' : ''
              }`}
            >
              <div className="schedule-lesson-card__header">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="schedule-lesson-card__time">
                    {row.slotTime.timeText} WIB
                  </span>
                  <Badge variant="neutral" className="text-[11px]">
                    {row.duration} JP (Jam {row.slot}
                    {row.duration > 1 ? `-${row.slot + row.duration - 1}` : ''})
                  </Badge>
                  {isConflict && (
                    <Badge variant="danger" className="text-[11px] flex items-center gap-1">
                      <AlertTriangle size={10} /> Bentrok
                    </Badge>
                  )}
                </div>
              </div>

              <h4 className="schedule-lesson-card__subject">{subjectName}</h4>

              <div className="schedule-lesson-card__meta">
                {role === 'teacher' ? (
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    Kelas: {className}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 truncate">
                    <User size={12} className="text-[var(--color-text-muted)] shrink-0" />
                    <span>{teacherName}</span>
                  </span>
                )}
              </div>

              <div className="schedule-lesson-card__footer">
                <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                  <MapPin size={11} className="text-[var(--color-text-muted)]" />
                  <span>{roomName}</span>
                </span>
                {role !== 'teacher' && (
                  <span className="text-[var(--color-text-muted)] ml-auto">Kelas {className}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Estimated Dismissal Time Banner */}
      <div className="flex items-center justify-between p-3.5 bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)] rounded-[16px] text-xs text-[var(--color-text-secondary)]">
        <div className="flex items-center gap-2">
          <LogOut size={15} className="text-[var(--color-text-secondary)]" />
          <span>Perkiraan Jam Pulang KBM:</span>
        </div>
        <span className="font-mono font-bold text-[var(--color-text-primary)] bg-[var(--color-surface)] px-2.5 py-1 rounded-lg border border-[var(--color-border-subtle)]">
          ~{dismissalTime} WIB
        </span>
      </div>
    </div>
  );
}


