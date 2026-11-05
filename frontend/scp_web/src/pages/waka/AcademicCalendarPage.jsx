import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Layers,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import academicEventApi from '../../services/academicEventApi';
import AcademicEventModal from './components/AcademicEventModal';
import Button from '../../components/shared/Button';
import Badge from '../../components/shared/Badge';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import StatCard from '../../components/shared/StatCard';
import './AcademicCalendarPage.css';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const WEEKDAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function AcademicCalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1 - 12
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');

  // Feedback notifications
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToastSuccess = (msg) => {
    setFeedbackMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const showToastError = (msg) => {
    setErrorMessage(msg);
    setFeedbackMessage(null);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await academicEventApi.getEvents({
        year: currentYear,
        month: currentMonth,
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setEvents(res.data.data);
      } else if (Array.isArray(res.data)) {
        setEvents(res.data);
      }
    } catch (err) {
      showToastError(err.response?.data?.message || err.message || 'Gagal memuat agenda kalender akademik.');
    } finally {
      setIsLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Navigasi Bulan
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

  // Kalkulasi Grid Tanggal Bulanan (Senin - Minggu)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0);

    // Dapatkan hari dalam minggu untuk tanggal 1 (0 = Minggu, 1 = Senin, dst.)
    let startDayOfWeek = firstDayOfMonth.getDay();
    // Konversi ke format Senin = 0, Minggu = 6
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days = [];
    const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();

    // Hari dari bulan sebelumnya untuk mengisi slot awal
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(currentYear, currentMonth - 2, dayNum);
      const dateStr = prevDate.toISOString().split('T')[0];
      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isWeekend: prevDate.getDay() === 0 || prevDate.getDay() === 6,
      });
    }

    // Hari dari bulan aktif
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const curDate = new Date(currentYear, currentMonth - 1, i);
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isWeekend: curDate.getDay() === 0 || curDate.getDay() === 6,
      });
    }

    // Sisa slot untuk melengkapi baris terakhir kelipatan 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(currentYear, currentMonth, i);
      const dateStr = nextDate.toISOString().split('T')[0];
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isWeekend: nextDate.getDay() === 0 || nextDate.getDay() === 6,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Mapping Event ke Tanggal Grid
  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      if (filterType !== 'ALL' && e.type !== filterType) {
        return;
      }

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
  }, [events, calendarDays, filterType]);

  // KPI Summary
  const kpiData = useMemo(() => {
    const holidays = events.filter((e) => e.type === 'holiday');
    const classEvents = events.filter((e) => e.type === 'class_event' || e.type === 'school_event');
    const exams = events.filter((e) => e.type === 'exam');
    return {
      totalAgenda: events.length,
      holidayCount: holidays.length,
      classEventCount: classEvents.length,
      examCount: exams.length,
    };
  }, [events]);

  const handleOpenCreateModal = (prefillDate = null) => {
    setEditingEvent(prefillDate ? { start_date: prefillDate, end_date: prefillDate } : null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    try {
      if (editingEvent && editingEvent.id) {
        await academicEventApi.updateEvent(editingEvent.id, payload);
        showToastSuccess('Agenda kalender akademik berhasil diperbarui.');
      } else {
        await academicEventApi.createEvent(payload);
        showToastSuccess('Agenda kalender akademik berhasil ditambahkan.');
      }
      setIsModalOpen(false);
      setEditingEvent(null);
      loadEvents();
    } catch (err) {
      showToastError(err.response?.data?.message || err.message || 'Gagal menyimpan agenda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await academicEventApi.deleteEvent(deleteTarget.id);
      showToastSuccess(`Agenda "${deleteTarget.title}" berhasil dihapus.`);
      setDeleteTarget(null);
      loadEvents();
    } catch (err) {
      showToastError(err.response?.data?.message || err.message || 'Gagal menghapus agenda.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getScopeBadge = (e) => {
    if (e.scope_type === 'all') {
      return <Badge variant="secondary">Seluruh Sekolah</Badge>;
    }
    if (e.scope_type === 'grade') {
      const grades = (e.scope_targets || []).join(', ');
      return <Badge variant="info">Tingkat {grades}</Badge>;
    }
    if (e.scope_type === 'class') {
      const count = (e.scope_targets || []).length;
      return <Badge variant="warning">{count} Rombel</Badge>;
    }
    return null;
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'holiday':
        return <Badge variant="danger">Libur Resmi</Badge>;
      case 'school_event':
        return <Badge variant="warning">Kegiatan Sekolah</Badge>;
      case 'class_event':
        return <Badge variant="warning">Kegiatan Tingkat/Rombel</Badge>;
      case 'exam':
        return <Badge variant="primary">Ujian / Asesmen</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="academic-calendar-container">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="dashboard-toast mb-4" role="status">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="dashboard-toast dashboard-toast--error mb-4" role="alert">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Kalender Akademik &amp; Agenda KBM
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Kelola agenda sekolah, hari libur nasional, kegiatan khusus tingkat/rombel, dan otomatisasi pengecualian KBM.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadEvents} disabled={isLoading} className="flex items-center gap-1.5">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Muat Ulang</span>
          </Button>
          <Button variant="primary" onClick={() => handleOpenCreateModal()} className="flex items-center gap-1.5">
            <Plus size={16} />
            <span>Tambah Agenda</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          title="Total Agenda Bulan Ini"
          value={kpiData.totalAgenda}
          description={`${MONTH_NAMES[currentMonth - 1]} ${currentYear}`}
          icon={<Calendar size={18} className="text-blue-600" />}
        />
        <StatCard
          title="Libur Nasional & Resmi"
          value={kpiData.holidayCount}
          description="KBM libur penuh"
          icon={<AlertCircle size={18} className="text-rose-600" />}
        />
        <StatCard
          title="Kegiatan Khusus KBM"
          value={kpiData.classEventCount}
          description="Kemah, KI, atau Acara Sekolah"
          icon={<Layers size={18} className="text-amber-600" />}
        />
        <StatCard
          title="Masa Ujian / Asesmen"
          value={kpiData.examCount}
          description="KBM reguler dialihkan"
          icon={<HelpCircle size={18} className="text-indigo-600" />}
        />
      </div>

      {/* Toolbar Filter & Navigasi Bulan */}
      <div className="bg-white p-3 border border-gray-200 rounded-lg mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="calendar-nav-btn"
            title="Bulan Sebelumnya"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="calendar-nav-btn"
            title="Bulan Berikutnya"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={handleCurrentMonth}
            className="px-2.5 py-1 text-xs font-semibold rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 transition"
          >
            Hari Ini
          </button>

          <span className="text-base sm:text-lg font-bold text-gray-800 ml-2">
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Filter Kategori:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-8 px-2.5 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Semua Agenda</option>
            <option value="holiday">Hari Libur Resmi</option>
            <option value="school_event">Kegiatan Sekolah</option>
            <option value="class_event">Kegiatan Tingkat/Rombel</option>
            <option value="exam">Masa Ujian / Asesmen</option>
          </select>
        </div>
      </div>

      {/* Grid Kalender Bulanan */}
      <div className="calendar-grid-wrapper mb-6">
        <div className="calendar-weekdays-row">
          {WEEKDAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`calendar-weekday-cell ${i >= 5 ? 'calendar-weekday-cell--weekend' : ''}`}
            >
              {name}
            </div>
          ))}
        </div>

        <div className="calendar-days-grid">
          {calendarDays.map((day) => {
            const isToday =
              day.dateStr ===
              `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const dayEvents = eventsByDate[day.dateStr] || [];

            return (
              <div
                key={day.dateStr}
                className={`calendar-day-cell ${!day.isCurrentMonth ? 'calendar-day-cell--outside' : ''} ${
                  isToday ? 'calendar-day-cell--today' : ''
                }`}
              >
                <div className="calendar-day-header">
                  <span className="calendar-day-number">{day.dayNumber}</span>
                  {day.isCurrentMonth && (
                    <button
                      type="button"
                      className="calendar-add-event-btn"
                      title={`Tambah agenda pada ${day.dateStr}`}
                      onClick={() => handleOpenCreateModal(day.dateStr)}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                <div className="calendar-events-list">
                  {dayEvents.map((evt) => (
                    <div
                      key={`${evt.id}-${day.dateStr}`}
                      className={`calendar-event-chip calendar-event-chip--${evt.type}`}
                      title={`${evt.title} (${evt.type}) - Klik untuk edit`}
                      onClick={() => handleOpenEditModal(evt)}
                    >
                      {evt.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bar Keterangan Warna (Legend) */}
      <div className="calendar-legend-bar mb-6">
        <span className="font-semibold text-gray-700">Keterangan:</span>
        <div className="calendar-legend-item">
          <div className="calendar-legend-dot calendar-legend-dot--holiday" />
          <span>Libur Nasional &amp; Resmi (KBM Libur)</span>
        </div>
        <div className="calendar-legend-item">
          <div className="calendar-legend-dot calendar-legend-dot--event" />
          <span>Kegiatan Khusus Sekolah / Tingkat / Rombel</span>
        </div>
        <div className="calendar-legend-item">
          <div className="calendar-legend-dot calendar-legend-dot--exam" />
          <span>Masa Penilaian / Ujian</span>
        </div>
      </div>

      {/* Tabel Rincian Agenda Bulan Ini */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800">
            Daftar Agenda Terjadwal ({MONTH_NAMES[currentMonth - 1]} {currentYear})
          </h2>
          <span className="text-xs text-gray-500">Total {events.length} agenda terdaftar</span>
        </div>

        {events.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs">
            Belum ada agenda kegiatan yang didaftarkan pada bulan ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Nama Kegiatan</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Cakupan Peserta</th>
                  <th className="py-2.5 px-3">Dampak KBM</th>
                  <th className="py-2.5 px-3">Dibuat Oleh</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-gray-900">
                      {evt.start_date === evt.end_date
                        ? evt.start_date
                        : `${evt.start_date} s.d. ${evt.end_date}`}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-gray-800 max-w-xs">
                      <div>{evt.title}</div>
                      {evt.description && (
                        <div className="text-[11px] text-gray-500 font-normal truncate">
                          {evt.description}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{getTypeBadge(evt.type)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{getScopeBadge(evt)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {evt.disables_teaching ? (
                        <Badge variant="danger">KBM Ditiadakan</Badge>
                      ) : (
                        <Badge variant="success">KBM Berjalan</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-gray-500">
                      {evt.creator?.name || 'Waka Kurikulum'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(evt)}
                          className="p-1.5 text-gray-600 hover:text-blue-600 rounded hover:bg-gray-100 transition"
                          title="Edit Agenda"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(evt)}
                          className="p-1.5 text-gray-600 hover:text-red-600 rounded hover:bg-gray-100 transition"
                          title="Hapus Agenda"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Agenda */}
      <AcademicEventModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEvent(null);
        }}
        onSubmit={handleSubmitModal}
        initialData={editingEvent}
        loading={isSubmitting}
      />

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Agenda Kalender"
        message={`Apakah Anda yakin ingin menghapus agenda "${deleteTarget?.title}"? Tindakan ini akan mengaktifkan kembali jadwal KBM reguler pada rentang tanggal tersebut.`}
        confirmLabel="Ya, Hapus"
        confirmVariant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
