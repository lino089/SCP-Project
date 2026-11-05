import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
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
import { classApi } from '../../services/masterDataApi';
import AcademicEventModal from './components/AcademicEventModal';
import SharedCalendarView from '../../components/calendar/SharedCalendarView';
import Button from '../../components/shared/Button';
import Badge from '../../components/shared/Badge';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import StatCard from '../../components/shared/StatCard';
import './AcademicCalendarPage.css';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function AcademicCalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1 - 12
  const [events, setEvents] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState('ALL');
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [filterClassId, setFilterClassId] = useState('ALL');
  const [classesList, setClassesList] = useState([]);

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

  // Muat daftar kelas untuk dropdown filter rombel
  useEffect(() => {
    classApi.getClasses({ per_page: 100 })
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          setClassesList(res.data);
        } else if (res.data?.data && Array.isArray(res.data.data)) {
          setClassesList(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        year: currentYear,
        month: currentMonth,
      };

      if (filterType !== 'ALL') params.type = filterType;
      if (filterGrade !== 'ALL') params.grade = filterGrade;
      if (filterClassId !== 'ALL') params.class_id = Number(filterClassId);

      const res = await academicEventApi.getMyCalendar(params);
      if (res.data?.success && res.data.data) {
        setEvents(res.data.data.events || []);
        setSummaryData(res.data.data.summary || null);
      } else if (Array.isArray(res.data?.data)) {
        setEvents(res.data.data);
      }
    } catch (err) {
      showToastError(err.response?.data?.message || err.message || 'Gagal memuat agenda kalender akademik.');
    } finally {
      setIsLoading(false);
    }
  }, [currentYear, currentMonth, filterType, filterGrade, filterClassId]);

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

  // KPI Summary
  const kpiData = useMemo(() => {
    if (summaryData) {
      return {
        totalAgenda: summaryData.total_events || 0,
        holidayCount: summaryData.holiday_count || 0,
        classEventCount: (summaryData.class_event_count || 0) + (summaryData.school_event_count || 0),
        examCount: summaryData.exam_count || 0,
      };
    }
    const holidays = events.filter((e) => e.type === 'holiday');
    const classEvents = events.filter((e) => e.type === 'class_event' || e.type === 'school_event');
    const exams = events.filter((e) => e.type === 'exam');
    return {
      totalAgenda: events.length,
      holidayCount: holidays.length,
      classEventCount: classEvents.length,
      examCount: exams.length,
    };
  }, [events, summaryData]);

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
      if (Array.isArray(e.target_classes) && e.target_classes.length > 0) {
        const names = e.target_classes.map((c) => c.name).join(', ');
        return <Badge variant="warning">{names}</Badge>;
      }
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

  // Filter rombel berdasarkan grade terpilih
  const filteredClassOptions = useMemo(() => {
    if (filterGrade === 'ALL') return classesList;
    return classesList.filter((c) => {
      const lvl = String(c.level || '').toUpperCase();
      if (filterGrade === '10') return lvl === '10' || lvl === 'X';
      if (filterGrade === '11') return lvl === '11' || lvl === 'XI';
      if (filterGrade === '12') return lvl === '12' || lvl === 'XII';
      return true;
    });
  }, [classesList, filterGrade]);

  // Toolbar kanan untuk SharedCalendarView
  const calendarToolbarRight = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Filter Kategori */}
      <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
        className="h-8 px-2.5 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
        title="Filter Kategori Agenda"
      >
        <option value="ALL">Semua Kategori</option>
        <option value="holiday">Hari Libur Resmi</option>
        <option value="school_event">Kegiatan Sekolah</option>
        <option value="class_event">Kegiatan Tingkat/Rombel</option>
        <option value="exam">Masa Ujian / Asesmen</option>
      </select>

      {/* Filter Tingkat */}
      <select
        value={filterGrade}
        onChange={(e) => {
          setFilterGrade(e.target.value);
          setFilterClassId('ALL');
        }}
        className="h-8 px-2.5 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
        title="Filter Tingkat Kelas"
      >
        <option value="ALL">Semua Tingkat</option>
        <option value="10">Tingkat 10 (X)</option>
        <option value="11">Tingkat 11 (XI)</option>
        <option value="12">Tingkat 12 (XII)</option>
      </select>

      {/* Filter Rombel */}
      <select
        value={filterClassId}
        onChange={(e) => setFilterClassId(e.target.value)}
        className="h-8 px-2.5 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
        title="Filter Rombel Kelas"
      >
        <option value="ALL">Semua Rombel</option>
        {filteredClassOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );

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

      {/* Shared Calendar Component */}
      <div className="mb-6">
        <SharedCalendarView
          year={currentYear}
          month={currentMonth}
          events={events}
          canManage={true}
          userRole="waka"
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleCurrentMonth}
          onDateClick={handleOpenCreateModal}
          onEventClick={handleOpenEditModal}
          toolbarRight={calendarToolbarRight}
          isLoading={isLoading}
        />
      </div>

      {/* Tabel Rincian Agenda Bulan Ini */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800">
            Daftar Agenda Terjadwal ({MONTH_NAMES[currentMonth - 1]} {currentYear})
          </h2>
          <span className="text-xs text-gray-500">Total {events.length} agenda terdaftar</span>
        </div>

        {events.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs">
            Belum ada agenda kegiatan yang didaftarkan pada bulan ini sesuai filter yang dipilih.
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
