import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  List,
  AlertCircle,
  RefreshCw,
  GraduationCap,
  Sparkles,
  Info,
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

export default function StudentCalendarPage() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);

  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' | 'list'
  const [events, setEvents] = useState([]);
  const [contextData, setContextData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Modal Detail Read-Only
  const [selectedEvent, setSelectedEvent] = useState(null);

  const studentProfile = useMemo(() => {
    return {
      name: user?.name || 'Peserta Didik',
      nis: user?.nis_nip || '-',
      className:
        contextData?.class_name ||
        user?.school_class?.name ||
        user?.schoolClass?.name ||
        'Kelas Siswa',
      level: contextData?.class_level || user?.school_class?.level || 'X',
    };
  }, [user, contextData]);

  const loadCalendar = useCallback(async () => {
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
      if (res.data?.success && res.data.data) {
        setEvents(res.data.data.events || []);
        setContextData(res.data.data.context || null);
        setSummaryData(res.data.data.summary || null);
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Gagal memuat kalender kegiatan siswa.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentYear, currentMonth, filterType]);

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
    const exams = events.filter((e) => e.type === 'exam');
    const specialEvents = events.filter(
      (e) => e.type === 'class_event' || e.type === 'school_event'
    );

    return {
      totalAgenda: events.length,
      holidayCount: holidays.length,
      specialEventsCount: specialEvents.length,
      examCount: exams.length,
    };
  }, [events]);

  // Toolbar kanan kalender
  const toolbarRight = (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500 hidden sm:inline">Filter Kategori:</span>
      <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
        className="h-8 px-2.5 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
      >
        <option value="ALL">Semua Agenda</option>
        <option value="holiday">Hari Libur Resmi</option>
        <option value="school_event">Kegiatan Sekolah</option>
        <option value="class_event">Kegiatan Khusus Kelas</option>
        <option value="exam">Masa Ujian / Asesmen</option>
      </select>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6 sm:px-6">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Kalender &amp; Kegiatan Siswa
            </h1>
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
              <GraduationCap size={13} />
              <span>{studentProfile.className}</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Lihat agenda kegiatan sekolah, jadwal asesmen, dan kegiatan khusus yang berlaku untuk kelas Anda.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="secondary"
            onClick={loadCalendar}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Muat Ulang</span>
          </Button>
        </div>
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
          title="Hari Libur Resmi"
          value={kpiData.holidayCount}
          description="Siswa libur di rumah"
          icon={<AlertCircle size={18} className="text-rose-600" />}
        />
        <StatCard
          title="Kegiatan Khusus / Lapangan"
          value={kpiData.specialEventsCount}
          description="Kemah, Porseni, atau Projek"
          icon={<Sparkles size={18} className="text-amber-600" />}
        />
        <StatCard
          title="Asesmen / Ujian"
          value={kpiData.examCount}
          description="KBM dialihkan ke ujian"
          icon={<Info size={18} className="text-indigo-600" />}
        />
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2">
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition ${
            activeTab === 'calendar'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Calendar size={16} />
          <span>Tampilan Kalender Bulanan</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition ${
            activeTab === 'list'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <List size={16} />
          <span>Daftar Kegiatan Mendatang ({events.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'calendar' ? (
        <div>
          <SharedCalendarView
            year={currentYear}
            month={currentMonth}
            events={events}
            canManage={false}
            userRole="student"
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleCurrentMonth}
            onEventClick={(evt) => setSelectedEvent(evt)}
            toolbarRight={toolbarRight}
            isLoading={isLoading}
          />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-b-xl p-5 shadow-sm -mt-6">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-900">
              Daftar Seluruh Agenda Bulan {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </h2>
            <p className="text-xs text-gray-500">
              Berikut rincian kegiatan yang berlaku untuk kelas {studentProfile.className}. Klik kartu kegiatan untuk rincian instruksi lengkap.
            </p>
          </div>

          <UpcomingEventsList
            events={events}
            onEventClick={(evt) => setSelectedEvent(evt)}
            userRole="student"
            emptyMessage={`Belum ada agenda kegiatan yang didaftarkan untuk kelas ${studentProfile.className} pada bulan ini.`}
          />
        </div>
      )}

      {/* Read-Only Detail Modal */}
      <AcademicEventDetailModal
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
        userRole="student"
      />
    </div>
  );
}
