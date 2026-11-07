import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './MobileCalendarView.css';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const WEEKDAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function MobileCalendarView({
  year,
  month,
  events = [],
  dailyTeachingStatus = {},
  selectedDate = null,
  onSelectDate = null,
  onPrevMonth,
  onNextMonth,
  onToday,
  isLoading = false,
  userRole = 'teacher',
}) {
  const todayIso = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Generate 7-column calendar grid (Senin - Minggu)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    // Day of week for 1st of month (0 = Minggu, 1 = Senin, ...)
    let startDayOfWeek = firstDay.getDay();
    // Realign to Senin = 0, Minggu = 6
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days = [];
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();

    // Previous month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 2, dayNum);
      const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(prevDate.getDate()).padStart(2, '0');
      days.push({
        dateStr: `${prevDate.getFullYear()}-${mStr}-${dStr}`,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isWeekend: prevDate.getDay() === 0 || prevDate.getDay() === 6,
      });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const curDate = new Date(year, month - 1, i);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isWeekend: curDate.getDay() === 0 || curDate.getDay() === 6,
      });
    }

    // Remaining slots to round up to multiple of 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month, i);
      const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(nextDate.getDate()).padStart(2, '0');
      days.push({
        dateStr: `${nextDate.getFullYear()}-${mStr}-${dStr}`,
        dayNumber: i,
        isCurrentMonth: false,
        isWeekend: nextDate.getDay() === 0 || nextDate.getDay() === 6,
      });
    }

    return days;
  }, [year, month]);

  // Index events by dateStr
  const eventsByDate = useMemo(() => {
    const map = {};
    (events || []).forEach((e) => {
      const start = e.start_date;
      const end = e.end_date || e.start_date;

      calendarDays.forEach((day) => {
        if (day.dateStr >= start && day.dateStr <= end) {
          if (!map[day.dateStr]) map[day.dateStr] = [];
          map[day.dateStr].push(e);
        }
      });
    });
    return map;
  }, [events, calendarDays]);

  const handleCellClick = (day) => {
    if (!day.isCurrentMonth) return;
    if (onSelectDate) {
      // Toggle selection or select
      onSelectDate(selectedDate === day.dateStr ? null : day.dateStr);
    }
  };

  return (
    <div className="mobile-calendar">
      {/* 1. Header Toolbar */}
      <div className="mobile-calendar__header">
        <div className="mobile-calendar__title-wrap">
          <span className="mobile-calendar__month-title">
            {MONTH_NAMES[month - 1]} {year}
          </span>
        </div>

        <div className="mobile-calendar__nav">
          <button
            type="button"
            onClick={onToday}
            disabled={isLoading}
            className="mobile-calendar__today-btn"
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={onPrevMonth}
            disabled={isLoading}
            className="mobile-calendar__nav-btn"
            aria-label="Bulan Sebelumnya"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            disabled={isLoading}
            className="mobile-calendar__nav-btn"
            aria-label="Bulan Berikutnya"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 2. Weekdays Header */}
      <div className="mobile-calendar__weekdays">
        {WEEKDAY_NAMES.map((name, i) => (
          <div
            key={name}
            className={`mobile-calendar__weekday ${i >= 5 ? 'mobile-calendar__weekday--weekend' : ''}`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* 3. Days Grid */}
      <div className="mobile-calendar__days-grid">
        {calendarDays.map((day) => {
          const isToday = day.dateStr === todayIso;
          const isSelected = selectedDate === day.dateStr;
          const dayEvents = eventsByDate[day.dateStr] || [];
          const teacherStatus = dailyTeachingStatus[day.dateStr];

          return (
            <div
              key={day.dateStr}
              onClick={() => handleCellClick(day)}
              className={`mobile-calendar__day-cell ${
                !day.isCurrentMonth ? 'mobile-calendar__day-cell--outside' : ''
              } ${day.isWeekend ? 'mobile-calendar__day-cell--weekend' : ''} ${
                isToday ? 'mobile-calendar__day-cell--today' : ''
              } ${isSelected ? 'mobile-calendar__day-cell--selected' : ''}`}
            >
              <span className="mobile-calendar__day-num">{day.dayNumber}</span>

              {/* Teacher KBM Status Pill */}
              {userRole === 'teacher' && teacherStatus && day.isCurrentMonth && (
                <div className="w-full px-0.5">
                  {teacherStatus.status === 'full_free' ? (
                    <span className="mobile-calendar__teacher-tag mobile-calendar__teacher-tag--free block">
                      Bebas
                    </span>
                  ) : teacherStatus.status === 'partial_teaching' ? (
                    <span className="mobile-calendar__teacher-tag mobile-calendar__teacher-tag--partial block">
                      Parsial
                    </span>
                  ) : null}
                </div>
              )}

              {/* Event Dots Indicator */}
              {day.isCurrentMonth && dayEvents.length > 0 && (
                <div className="mobile-calendar__dots">
                  {dayEvents.slice(0, 3).map((evt, idx) => {
                    const dotClass =
                      evt.type === 'holiday'
                        ? 'mobile-calendar__dot--holiday'
                        : evt.type === 'exam'
                        ? 'mobile-calendar__dot--exam'
                        : evt.type === 'class_event'
                        ? 'mobile-calendar__dot--class_event'
                        : 'mobile-calendar__dot--school_event';
                    return (
                      <span
                        key={`${evt.id || idx}-${idx}`}
                        className={`mobile-calendar__dot ${dotClass}`}
                      />
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <span className="mobile-calendar__dot-more">
                      +{dayEvents.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Legend Bar */}
      <div className="mobile-calendar__legend">
        <div className="mobile-calendar__legend-item">
          <span className="mobile-calendar__legend-dot bg-[var(--color-danger-bg)]0" />
          <span>Libur Resmi</span>
        </div>
        <div className="mobile-calendar__legend-item">
          <span className="mobile-calendar__legend-dot bg-amber-500" />
          <span>Kegiatan</span>
        </div>
        <div className="mobile-calendar__legend-item">
          <span className="mobile-calendar__legend-dot bg-blue-500" />
          <span>Ujian</span>
        </div>
        {userRole === 'teacher' && (
          <>
            <div className="mobile-calendar__legend-item">
              <span className="mobile-calendar__legend-dot bg-emerald-500" />
              <span>Bebas KBM</span>
            </div>
            <div className="mobile-calendar__legend-item">
              <span className="mobile-calendar__legend-dot bg-amber-600" />
              <span>KBM Parsial</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


