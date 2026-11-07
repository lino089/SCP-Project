import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  List,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Layers,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import academicEventApi from '../../services/academicEventApi';
import {
  MobileCalendarView,
  UpcomingEventsList,
  AcademicEventDetailSheet,
} from '../../components/calendar';
import StatCard from '../../components/shared/StatCard';
import Button from '../../components/shared/Button';

const FILTER_TYPES = [
  { id: 'ALL', label: 'Semua' },
  { id: 'holiday', label: 'Libur' },
  { id: 'school_event', label: 'Sekolah' },
  { id: 'class_event', label: 'Khusus' },
  { id: 'exam', label: 'Ujian' },
];

export default function StudentCalendarPage() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);

  const [events, setEvents] = useState([]);
  const [contextData, setContextData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // View state & filters
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list'
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filterType, setFilterType] = useState('ALL');

  const studentProfile = useMemo(() => {
    return {
      name: user?.name || 'Peserta Didik',
      nis: user?.nis_nip || '-',
      className:
        contextData?.student?.class_name ||
        user?.school_class?.name ||
        user?.schoolClass?.name ||
        'Kelas Siswa',
      level:
        contextData?.student?.level ||
        user?.school_class?.level ||
        'X',
    };
  }, [user, contextData]);

  // Effect to load calendar data asynchronously
  useEffect(() => {
    let isMounted = true;

    const fetchCalendar = async () => {
      try {
        const params = {
          year: currentYear,
          month: currentMonth,
        };
        if (filterType !== 'ALL') {
          params.type = filterType;
        }

        const res = await academicEventApi.getMyCalendar(params);
        if (isMounted && res.data) {
          setEvents(res.data.events || []);
          setContextData(res.data.context || null);
          setSummaryData(res.data.summary || null);
          setErrorMessage(null);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(
            err.response?.data?.message ||
              err.message ||
              'Gagal memuat agenda kalender siswa.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchCalendar();

    return () => {
      isMounted = false;
    };
  }, [currentYear, currentMonth, filterType]);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = {
        year: currentYear,
        month: currentMonth,
      };
      if (filterType !== 'ALL') {
        params.type = filterType;
      }

      const res = await academicEventApi.getMyCalendar(params);
      if (res.data) {
        setEvents(res.data.events || []);
        setContextData(res.data.context || null);
        setSummaryData(res.data.summary || null);
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          'Gagal memuat agenda kalender siswa.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentYear, currentMonth, filterType]);

  const handlePrevMonth = () => {
    setIsLoading(true);
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setIsLoading(true);
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDate(null);
  };

  const handleToday = () => {
    setIsLoading(true);
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
    const mStr = String(today.getMonth() + 1).padStart(2, '0');
    const dStr = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${today.getFullYear()}-${mStr}-${dStr}`);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Bar with Student Badge */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="page-title">
              Kalender Kegiatan
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] font-semibold font-mono">
              {studentProfile.className}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Jadwal kegiatan sekolah, libur resmi, & asesmen
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="w-9 h-9 flex items-center justify-center rounded-[14px] bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] active:scale-95 disabled:opacity-50"
          title="Segarkan kalender"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[14px] flex items-center gap-2 text-xs text-[var(--color-danger-fg)]">
          <AlertCircle size={15} className="shrink-0 text-[var(--color-danger-fg)]" />
          <span className="flex-1">{errorMessage}</span>
          <Button size="sm" variant="ghost" onClick={handleRefresh}>
            Ulangi
          </Button>
        </div>
      )}

      {/* 2. Stat Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          title="Total Agenda"
          value={summaryData?.total_events ?? events.length}
          icon={CalendarIcon}
          variant="default"
        />
        <StatCard
          title="Hari Libur"
          value={summaryData?.holiday_count ?? 0}
          icon={Sparkles}
          variant="warning"
        />
        <StatCard
          title="Kegiatan Rombel"
          value={summaryData?.special_event_count ?? 0}
          icon={Layers}
          variant="primary"
        />
        <StatCard
          title="Ujian & Asesmen"
          value={summaryData?.exam_count ?? 0}
          icon={GraduationCap}
          variant="success"
        />
      </div>

      {/* 3. Controls & Filter Bar */}
      <div className="space-y-2.5 bg-[var(--color-surface)] p-3 rounded-[16px] border border-[var(--color-border-subtle)] shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          {/* Mode Tabs */}
          <div className="flex items-center p-0.5 bg-[var(--color-surface-subtle)] rounded-[14px] border border-[var(--color-border-subtle)] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] transition-all ${
                viewMode === 'calendar'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] font-semibold shadow-[var(--shadow-pill)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <CalendarIcon size={13} />
              <span>Kalender</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] transition-all ${
                viewMode === 'list'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] font-semibold shadow-[var(--shadow-pill)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <List size={13} />
              <span>Daftar</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-[var(--color-text-secondary)]">
            NIS: {studentProfile.nis}
          </span>
        </div>

        {/* Type Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {FILTER_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setIsLoading(true);
                setFilterType(t.id);
              }}
              className={`text-xs px-2.5 py-1 rounded-[10px] shrink-0 font-medium transition-all ${
                filterType === t.id
                  ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] font-semibold shadow-[var(--shadow-pill)]'
                  : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Active View */}
      {viewMode === 'calendar' ? (
        <div className="space-y-3.5">
          <MobileCalendarView
            year={currentYear}
            month={currentMonth}
            events={events}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
            isLoading={isLoading}
            userRole="student"
          />

          <div>
            <h3 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider mb-2 font-mono">
              {selectedDate ? 'Agenda Tanggal Terpilih' : 'Daftar Agenda Bulan Ini'}
            </h3>
            <UpcomingEventsList
              events={events}
              selectedDate={selectedDate}
              onClearDateFilter={() => setSelectedDate(null)}
              onEventClick={(evt) => setSelectedEvent(evt)}
              userRole="student"
              emptyMessage={
                selectedDate
                  ? 'Tidak ada agenda kegiatan pada tanggal yang dipilih.'
                  : 'Tidak ada agenda kegiatan pada bulan ini.'
              }
            />
          </div>
        </div>
      ) : (
        <div>
          <UpcomingEventsList
            events={events}
            onEventClick={(evt) => setSelectedEvent(evt)}
            userRole="student"
            isLoading={isLoading}
            emptyMessage="Tidak ada agenda kegiatan pada periode yang dipilih."
          />
        </div>
      )}

      {/* 5. Detail Bottom Sheet */}
      <AcademicEventDetailSheet
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
        userRole="student"
      />
    </div>
  );
}
