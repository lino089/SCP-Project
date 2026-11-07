import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  List,
  RefreshCw,
  AlertCircle,
  Users,
  Sparkles,
  Layers,
  GraduationCap,
} from 'lucide-react';
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

export default function ParentCalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);

  const [events, setEvents] = useState([]);
  const [childrenList, setChildrenList] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('ALL');
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // View state & filters
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list'
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filterType, setFilterType] = useState('ALL');

  // Effect to load calendar data asynchronously
  useEffect(() => {
    let isMounted = true;

    const fetchCalendar = async () => {
      try {
        const params = {
          year: currentYear,
          month: currentMonth,
        };

        if (selectedChildId !== 'ALL' && selectedChildId) {
          params.child_id = Number(selectedChildId);
        }
        if (filterType !== 'ALL') {
          params.type = filterType;
        }

        const res = await academicEventApi.getMyCalendar(params);
        if (isMounted && res.data) {
          setEvents(res.data.events || []);
          const children = res.data.context?.children || [];
          setChildrenList(children);
          setSummaryData(res.data.summary || null);
          setErrorMessage(null);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(
            err.response?.data?.message ||
              err.message ||
              'Gagal memuat agenda kalender sekolah.'
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
  }, [currentYear, currentMonth, selectedChildId, filterType]);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = {
        year: currentYear,
        month: currentMonth,
      };

      if (selectedChildId !== 'ALL' && selectedChildId) {
        params.child_id = Number(selectedChildId);
      }
      if (filterType !== 'ALL') {
        params.type = filterType;
      }

      const res = await academicEventApi.getMyCalendar(params);
      if (res.data) {
        setEvents(res.data.events || []);
        const children = res.data.context?.children || [];
        setChildrenList(children);
        setSummaryData(res.data.summary || null);
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          'Gagal memuat agenda kalender sekolah.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentYear, currentMonth, selectedChildId, filterType]);

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
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">
            Kalender Sekolah
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Informasi hari libur, kegiatan sekolah & ujian anak
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

      {/* Child Selector if multiple children */}
      {childrenList.length > 1 && (
        <div className="bg-[var(--color-surface)] p-3 rounded-[16px] border border-[var(--color-border-subtle)] shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-[var(--color-text-primary)]">
            <Users size={14} className="text-[var(--color-text-secondary)]" />
            <span>Pilih Anak:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setSelectedChildId('ALL');
              }}
              className={`text-xs px-3 py-1.5 rounded-[14px] font-medium shrink-0 transition-all ${
                selectedChildId === 'ALL'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] font-semibold shadow-[var(--shadow-pill)]'
                  : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]'
              }`}
            >
              Semua Anak ({childrenList.length})
            </button>
            {childrenList.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setSelectedChildId(String(ch.id));
                }}
                className={`text-xs px-3 py-1.5 rounded-[14px] font-medium shrink-0 transition-all ${
                  selectedChildId === String(ch.id)
                    ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] font-semibold shadow-[var(--shadow-pill)]'
                    : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]'
                }`}
              >
                {ch.name} ({ch.class_name})
              </button>
            ))}
          </div>
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
          title="Kegiatan Sekolah"
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

          {childrenList.length === 1 && (
            <span className="text-[11px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-subtle)] px-2 py-1 rounded-[10px] truncate">
              {childrenList[0].name} ({childrenList[0].class_name})
            </span>
          )}
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
            userRole="parent"
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
              userRole="parent"
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
            userRole="parent"
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
        userRole="parent"
      />
    </div>
  );
}
