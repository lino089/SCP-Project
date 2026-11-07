import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Sparkles,
  Info,
  Clock,
  ChevronRight,
} from 'lucide-react';
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

export default function ParentCalendarPage() {
  const today = useMemo(() => new Date(), []);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);

  const [events, setEvents] = useState([]);
  const [childrenList, setChildrenList] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Modal Detail
  const [selectedEvent, setSelectedEvent] = useState(null);

  const loadCalendar = useCallback(async () => {
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
      const payload = res?.data ?? res;
      if (payload?.events) {
        setEvents(payload.events || []);
        const children = payload.context?.children || [];
        setChildrenList(children);
      } else if (Array.isArray(payload)) {
        setEvents(payload);
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Gagal memuat agenda kalender sekolah.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentYear, currentMonth, selectedChildId, filterType]);

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

  // Agenda Minggu Berjalan (Current Week Highlights)
  const currentWeekEvents = useMemo(() => {
    const cur = new Date();
    // Cari hari Senin minggu ini
    const day = cur.getDay();
    const diff = cur.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(cur.setDate(diff));
    const sunday = new Date(cur.setDate(diff + 6));

    const monStr = monday.toISOString().split('T')[0];
    const sunStr = sunday.toISOString().split('T')[0];

    return (events || []).filter((e) => {
      return (
        (e.start_date >= monStr && e.start_date <= sunStr) ||
        (e.end_date >= monStr && e.end_date <= sunStr) ||
        (e.start_date <= monStr && e.end_date >= sunStr)
      );
    });
  }, [events]);

  // Label nama anak terpilih
  const selectedChildLabel = useMemo(() => {
    if (selectedChildId === 'ALL') {
      if (childrenList.length > 1) return 'Semua Anak';
      if (childrenList.length === 1) {
        const c = childrenList[0];
        return `${c.name} (${c.class_name})`;
      }
      return 'Siswa Terhubung';
    }
    const found = childrenList.find((c) => String(c.id) === String(selectedChildId));
    return found ? `${found.name} (${found.class_name})` : 'Siswa Terhubung';
  }, [selectedChildId, childrenList]);

  // KPI Summary
  const kpiData = useMemo(() => {
    const holidays = events.filter((e) => e.type === 'holiday');
    const exams = events.filter((e) => e.type === 'exam');
    const specials = events.filter(
      (e) => e.type === 'class_event' || e.type === 'school_event'
    );

    return {
      totalAgenda: events.length,
      holidayCount: holidays.length,
      specialCount: specials.length,
      examCount: exams.length,
    };
  }, [events]);

  // Toolbar kanan untuk SharedCalendarView
  const toolbarRight = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Dropdown Anak (jika > 1 anak) */}
      {childrenList.length > 1 && (
        <select
          value={selectedChildId}
          onChange={(e) => setSelectedChildId(e.target.value)}
          className="h-8 px-2.5 text-xs font-semibold border border-blue-300 rounded bg-blue-50 text-blue-900 focus:ring-1 focus:ring-blue-500"
          title="Pilih Anak"
        >
          <option value="ALL">Semua Anak</option>
          {childrenList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.class_name})
            </option>
          ))}
        </select>
      )}

      {/* Filter Kategori */}
      <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
        className="h-8 px-2.5 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
      >
        <option value="ALL">Semua Agenda</option>
        <option value="holiday">Hari Libur Resmi</option>
        <option value="school_event">Kegiatan Sekolah</option>
        <option value="class_event">Kegiatan Khusus</option>
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
              Agenda &amp; Kalender Sekolah
            </h1>
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
              <UserCheck size={13} />
              <span>{selectedChildLabel}</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Informasi resmi kalender akademik, hari libur, dan jadwal kegiatan khusus putra/putri Anda di SMK Negeri 1 Bantul.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {childrenList.length > 1 && (
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="h-9 px-3 text-xs font-semibold border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Anak</option>
              {childrenList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.class_name})
                </option>
              ))}
            </select>
          )}

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

      {/* Banner Sorotan Minggu Berjalan (Highlights) */}
      {currentWeekEvents.length > 0 && (
        <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
            <Clock size={15} className="text-blue-600" />
            <span>Informasi Minggu Ini untuk {selectedChildLabel}</span>
          </div>

          <div className="space-y-2 mt-2">
            {currentWeekEvents.map((evt) => (
              <div
                key={evt.id}
                onClick={() => setSelectedEvent(evt)}
                className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer transition"
              >
                <div>
                  <div className="font-bold text-gray-900 flex items-center gap-2">
                    <span>{evt.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                      {evt.start_date === evt.end_date
                        ? evt.start_date
                        : `${evt.start_date} s.d. ${evt.end_date}`}
                    </span>
                  </div>
                  {evt.attendance_guidance && (
                    <div className="text-gray-600 mt-1">
                      <strong className="text-blue-700">Kepastian Kehadiran:</strong>{' '}
                      {evt.attendance_guidance}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 text-blue-600 font-semibold shrink-0 self-end sm:self-auto">
                  <span>Lihat Detail</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            ))}
          </div>
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
          title="Kegiatan Khusus Sekolah"
          value={kpiData.specialCount}
          description="Kemah, Porseni, Field Trip"
          icon={<Sparkles size={18} className="text-amber-600" />}
        />
        <StatCard
          title="Masa Ujian / Asesmen"
          value={kpiData.examCount}
          description="Penilaian Tengah / Akhir Semester"
          icon={<Info size={18} className="text-indigo-600" />}
        />
      </div>

      {/* Shared Calendar Component */}
      <div>
        <SharedCalendarView
          year={currentYear}
          month={currentMonth}
          events={events}
          canManage={false}
          userRole="parent"
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleCurrentMonth}
          onEventClick={(evt) => setSelectedEvent(evt)}
          toolbarRight={toolbarRight}
          isLoading={isLoading}
        />
      </div>

      {/* Daftar Agenda Kegiatan Bulan Ini */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Daftar Agenda Kegiatan ({MONTH_NAMES[currentMonth - 1]} {currentYear})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Klik pada salah satu kartu kegiatan untuk melihat rincian pengumuman dan kepastian kehadiran anak.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
            {events.length} Agenda
          </span>
        </div>

        <UpcomingEventsList
          events={events}
          onEventClick={(evt) => setSelectedEvent(evt)}
          userRole="parent"
          emptyMessage="Tidak ada agenda kegiatan terjadwal untuk putra/putri Anda pada bulan ini."
        />
      </div>

      {/* Read-Only Detail Modal */}
      <AcademicEventDetailModal
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
        userRole="parent"
      />
    </div>
  );
}
