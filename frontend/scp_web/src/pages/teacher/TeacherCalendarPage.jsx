import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  Layers,
  HelpCircle,
  RefreshCw,
  BookOpen,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import academicEventApi from '../../services/academicEventApi';
import SharedCalendarView from '../../components/calendar/SharedCalendarView';
import UpcomingEventsList from '../../components/calendar/UpcomingEventsList';
import AcademicEventDetailModal from '../../components/calendar/AcademicEventDetailModal';
import Button from '../../components/shared/Button';
import StatCard from '../../components/shared/StatCard';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function TeacherCalendarPage() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);

  const [events, setEvents] = useState([]);
  const [dailyTeachingStatus, setDailyTeachingStatus] = useState({});
  const [summaryData, setSummaryData] = useState(null);
  const [contextData, setContextData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [onlyMyTeaching, setOnlyMyTeaching] = useState(false);
  const [filterType, setFilterType] = useState('ALL');

  // Modal Detail
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Feedback notifications
  const [errorMessage, setErrorMessage] = useState(null);

  const loadCalendar = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = {
        year: currentYear,
        month: currentMonth,
        only_affects_my_teaching: onlyMyTeaching ? 1 : 0,
      };
      if (filterType !== 'ALL') {
        params.type = filterType;
      }

      const res = await academicEventApi.getMyCalendar(params);
      const payload = res?.data ?? res;
      if (payload?.events) {
        setEvents(payload.events || []);
        setDailyTeachingStatus(payload.daily_teaching_status || {});
        setSummaryData(payload.summary || null);
        setContextData(payload.context || null);
      } else if (Array.isArray(payload)) {
        setEvents(payload);
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Gagal memuat kalender akademik guru.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentYear, currentMonth, onlyMyTeaching, filterType]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleCurrentMonth = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
  };

  // KPI Summary
  const kpiData = useMemo(() => {
    const holidays = events.filter((e) => e.type === 'holiday');
    const myImpacted = events.filter((e) => e.affects_my_teaching);
    const freeTeachingCount = Object.values(dailyTeachingStatus).filter(
      (s) => s.status === 'full_free'
    ).length;

    return {
      totalAgenda: events.length,
      holidayCount: holidays.length,
      teachingImpactCount: myImpacted.length,
      freeDaysCount: freeTeachingCount,
    };
  }, [events, dailyTeachingStatus]);

  // Toolbar slot kanan pada kalender
  const toolbarRight = (
    <div className="flex flex-wrap items-center gap-3">
      {/* Checkbox Hanya Agenda yang Berdampak pada Mengajar */}
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer bg-white px-2.5 py-1 rounded border border-gray-200 hover:bg-gray-50 transition select-none">
        <input
          type="checkbox"
          checked={onlyMyTeaching}
          onChange={(e) => setOnlyMyTeaching(e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
        />
        <span>Hanya yang Mempengaruhi Jam Mengajar</span>
      </label>

      {/* Filter Kategori */}
      <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
        className="h-8 px-2.5 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
      >
        <option value="ALL">Semua Kategori</option>
        <option value="holiday">Hari Libur Resmi</option>
        <option value="school_event">Kegiatan Sekolah</option>
        <option value="class_event">Kegiatan Tingkat/Rombel</option>
        <option value="exam">Masa Ujian / Asesmen</option>
      </select>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6 sm:px-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Kalender Akademik Guru
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
              {user?.name || 'Guru'}
            </span>
            {contextData?.is_kesiswaan && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                Kesiswaan
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Pantau jadwal agenda sekolah, hari libur resmi, kegiatan khusus KBM, dan otomatisasi penyesuaian jadwal mengajar Anda.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={loadCalendar}
          disabled={isLoading}
          className="flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Muat Ulang</span>
        </Button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Total Agenda Bulan Ini"
          value={kpiData.totalAgenda}
          description={`${MONTH_NAMES[currentMonth - 1]} ${currentYear}`}
          icon={<Calendar size={18} className="text-blue-600" />}
        />
        <StatCard
          title="Libur Resmi Sekolah"
          value={kpiData.holidayCount}
          description="Sekolah libur penuh"
          icon={<AlertCircle size={18} className="text-rose-600" />}
        />
        <StatCard
          title="Berdampak pada Jadwal Anda"
          value={kpiData.teachingImpactCount}
          description="Membebaskan jam ajar / KBM"
          icon={<BookOpen size={18} className="text-indigo-600" />}
        />
        <StatCard
          title="Hari Bebas KBM Penuh"
          value={kpiData.freeDaysCount}
          description="Seluruh jam ajar bebas KBM"
          icon={<CheckCircle2 size={18} className="text-emerald-600" />}
        />
      </div>

      {/* Shared Calendar Component */}
      <div>
        <SharedCalendarView
          year={currentYear}
          month={currentMonth}
          events={events}
          canManage={false}
          userRole="teacher"
          dailyTeachingStatus={dailyTeachingStatus}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleCurrentMonth}
          onEventClick={(evt) => setSelectedEvent(evt)}
          toolbarRight={toolbarRight}
          isLoading={isLoading}
        />
      </div>

      {/* Rincian Agenda Kegiatan Bulan Berjalan */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Rincian Agenda Kegiatan ({MONTH_NAMES[currentMonth - 1]} {currentYear})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Klik pada salah satu agenda untuk melihat detail dampak terhadap jadwal mengajar Anda.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
            {events.length} Agenda
          </span>
        </div>

        <UpcomingEventsList
          events={events}
          onEventClick={(evt) => setSelectedEvent(evt)}
          userRole="teacher"
          emptyMessage="Tidak ada agenda kegiatan terjadwal pada bulan ini sesuai filter yang dipilih."
        />
      </div>

      {/* Read-Only Detail Modal */}
      <AcademicEventDetailModal
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
        userRole="teacher"
      />
    </div>
  );
}
