import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import './SharedCalendarView.css';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const WEEKDAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function SharedCalendarView({
  year,
  month,
  events = [],
  canManage = false,
  userRole = 'waka',
  dailyTeachingStatus = {},
  onPrevMonth,
  onNextMonth,
  onToday,
  onDateClick,
  onEventClick,
  toolbarRight = null,
  isLoading = false,
}) {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, [today]);

  // Kalkulasi Grid Tanggal Bulanan (Senin - Minggu)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    // Hari dalam minggu untuk tanggal 1 (0 = Minggu, 1 = Senin, dst.)
    let startDayOfWeek = firstDayOfMonth.getDay();
    // Konversi ke format Senin = 0, Minggu = 6
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days = [];
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();

    // Hari dari bulan sebelumnya untuk mengisi slot awal
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 2, dayNum);
      const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(prevDate.getDate()).padStart(2, '0');
      const dateStr = `${prevDate.getFullYear()}-${mStr}-${dStr}`;
      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isWeekend: prevDate.getDay() === 0 || prevDate.getDay() === 6,
      });
    }

    // Hari dari bulan aktif
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const curDate = new Date(year, month - 1, i);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isWeekend: curDate.getDay() === 0 || curDate.getDay() === 6,
      });
    }

    // Sisa slot untuk melengkapi kelipatan 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month, i);
      const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(nextDate.getDate()).padStart(2, '0');
      const dateStr = `${nextDate.getFullYear()}-${mStr}-${dStr}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isWeekend: nextDate.getDay() === 0 || nextDate.getDay() === 6,
      });
    }

    return days;
  }, [year, month]);

  // Mapping Event ke Tanggal Grid
  const eventsByDate = useMemo(() => {
    const map = {};
    (events || []).forEach((e) => {
      const start = e.start_date;
      const end = e.end_date;

      calendarDays.forEach((day) => {
        if (day.dateStr >= start && day.dateStr <= end) {
          if (!map[day.dateStr]) map[day.dateStr] = [];
          map[day.dateStr].push(e);
        }
      });
    });
    return map;
  }, [events, calendarDays]);

  return (
    <div className="shared-calendar-container">
      {/* 1. Toolbar & Navigasi */}
      <div className="shared-calendar-toolbar">
        <div className="shared-calendar-nav">
          <button
            type="button"
            onClick={onPrevMonth}
            disabled={isLoading}
            className="shared-calendar-nav-btn"
            title="Bulan Sebelumnya"
            aria-label="Bulan Sebelumnya"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            disabled={isLoading}
            className="shared-calendar-nav-btn"
            title="Bulan Berikutnya"
            aria-label="Bulan Berikutnya"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={onToday}
            disabled={isLoading}
            className="shared-calendar-today-btn"
          >
            Hari Ini
          </button>

          <span className="shared-calendar-month-title">
            {MONTH_NAMES[month - 1]} {year}
          </span>
        </div>

        {toolbarRight && (
          <div className="shared-calendar-toolbar-extra">
            {toolbarRight}
          </div>
        )}
      </div>

      {/* 2. Grid Kalender Bulanan */}
      <div className="shared-calendar-grid-wrapper">
        <div className="shared-calendar-weekdays">
          {WEEKDAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`shared-calendar-weekday-cell ${i >= 5 ? 'shared-calendar-weekday-cell--weekend' : ''}`}
            >
              {name}
            </div>
          ))}
        </div>

        <div className="shared-calendar-days">
          {calendarDays.map((day) => {
            const isToday = day.dateStr === todayIso;
            const dayEvents = eventsByDate[day.dateStr] || [];
            const teacherStatus = dailyTeachingStatus[day.dateStr];

            return (
              <div
                key={day.dateStr}
                className={`shared-calendar-day-cell ${!day.isCurrentMonth ? 'shared-calendar-day-cell--outside' : ''} ${
                  isToday ? 'shared-calendar-day-cell--today' : ''
                }`}
              >
                <div className="shared-calendar-day-header">
                  <span className="shared-calendar-day-num">{day.dayNumber}</span>
                  {canManage && day.isCurrentMonth && (
                    <button
                      type="button"
                      className="shared-calendar-add-btn"
                      title={`Tambah agenda pada ${day.dateStr}`}
                      onClick={() => onDateClick?.(day.dateStr)}
                      aria-label={`Tambah agenda ${day.dateStr}`}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                {/* Status Mengajar Guru (Role Teacher) */}
                {userRole === 'teacher' && teacherStatus && (
                  <div className="shared-calendar-teacher-status">
                    {teacherStatus.status === 'full_free' ? (
                      <span
                        className="shared-calendar-teacher-pill shared-calendar-teacher-pill--free"
                        title={teacherStatus.label}
                      >
                        Bebas KBM
                      </span>
                    ) : teacherStatus.status === 'partial_teaching' ? (
                      <span
                        className="shared-calendar-teacher-pill shared-calendar-teacher-pill--partial"
                        title={teacherStatus.label}
                      >
                        KBM Parsial
                      </span>
                    ) : null}
                  </div>
                )}

                {/* Chip Daftar Agenda */}
                <div className="shared-calendar-events-list">
                  {dayEvents.map((evt) => {
                    const isAffecting = userRole === 'teacher' && Boolean(evt.affects_my_teaching);
                    return (
                      <div
                        key={`${evt.id}-${day.dateStr}`}
                        className={`shared-calendar-event-chip shared-calendar-event-chip--${evt.type || 'school_event'}`}
                        title={`${evt.title}${isAffecting ? ' • Berdampak pada jadwal mengajar Anda' : ''} - Klik untuk rincian`}
                        onClick={() => onEventClick?.(evt)}
                      >
                        {isAffecting && <span className="mr-0.5 text-amber-700 font-bold">[*]</span>}
                        <span>{evt.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Bar Keterangan Warna (Legend) */}
      <div className="shared-calendar-legend">
        <span className="font-semibold text-gray-700">Keterangan:</span>
        <div className="shared-calendar-legend-item">
          <div className="shared-calendar-legend-dot shared-calendar-legend-dot--holiday" />
          <span>Libur Resmi (KBM Libur Penuh)</span>
        </div>
        <div className="shared-calendar-legend-item">
          <div className="shared-calendar-legend-dot shared-calendar-legend-dot--event" />
          <span>Kegiatan Khusus Sekolah / Tingkat / Rombel</span>
        </div>
        <div className="shared-calendar-legend-item">
          <div className="shared-calendar-legend-dot shared-calendar-legend-dot--exam" />
          <span>Masa Penilaian / Ujian</span>
        </div>
        {userRole === 'teacher' && (
          <>
            <div className="shared-calendar-legend-item">
              <div className="shared-calendar-legend-dot shared-calendar-legend-dot--free" />
              <span>Jadwal Anda Bebas KBM</span>
            </div>
            <div className="shared-calendar-legend-item">
              <div className="shared-calendar-legend-dot shared-calendar-legend-dot--partial" />
              <span>KBM Parsial (Ada Kelas Tetap Masuk)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
