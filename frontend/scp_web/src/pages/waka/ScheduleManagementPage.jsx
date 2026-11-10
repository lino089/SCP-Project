import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Flag,
  AlertCircle,
} from 'lucide-react';
import {
  Button,
  Select,
  Modal,
  Badge,
  PasswordModal,
  SearchInput,
  Pagination,
} from '../../components/shared';
import {
  ScheduleTableSkeleton,
  EmptyState,
  ErrorState,
} from '../../components/feedback';
import ScheduleBreakRow from '../../components/schedule/ScheduleBreakRow';
import { scheduleApi, academicSettingApi } from '../../services/scheduleApi';
import { classApi, roomApi, subjectApi, teacherApi } from '../../services/masterDataApi';
import { unwrapList } from '../../utils/responseHelper';
import {
  DAYS_LIST,
  DAY_TO_NUMBER,
  NUMBER_TO_DAY,
  getTimeSlotsForDay,
  resolveSlotTime,
  detectScheduleConflicts,
  getMorningActivity,
  getDayKbmStartTime,
} from '../../utils/timetableHelper';
import { checkMasterDataPrerequisites } from '../../utils/prerequisiteHelper';
import './ScheduleManagement.css';

export default function ScheduleManagementPage() {
  const navigate = useNavigate();

  // Settings & Master Datasets
  const [activeCycleSetting, setActiveCycleSetting] = useState(1);
  const [mondayIsUpacara, setMondayIsUpacara] = useState(true);
  const [periodTemplates, setPeriodTemplates] = useState([]);

  const [classList, setClassList] = useState([]);
  const [roomList, setRoomList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [teacherList, setTeacherList] = useState([]);
  const [isMasterDataLoading, setIsMasterDataLoading] = useState(true);

  // Schedules state & Load/Error states
  const [scheduleList, setScheduleList] = useState([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Filter States
  const [selectedCycle, setSelectedCycle] = useState(1);
  const [selectedDay, setSelectedDay] = useState('Semua Hari');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('ALL');

  // Search & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [classPage, setClassPage] = useState(1);
  const [classesPerPage, setClassesPerPage] = useState(2);
  const searchTimerRef = useRef(null);

  // Form modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [formData, setFormData] = useState({
    teacher_id: '',
    class_id: '',
    room_id: '',
    subject_id: '',
    day: 'Senin',
    slot: 1,
    duration: 2,
    cycle: 1,
  });
  const [formError, setFormError] = useState('');

  // Password verification modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'save' | 'delete', data: any, id?: any }
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState(null);
  const [toastError, setToastError] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setToastError(null);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const showErrorToast = (msg) => {
    setToastError(msg);
    setToastMessage(null);
    setTimeout(() => setToastError(null), 5000);
  };

  // Pre-condition gate verification
  const prerequisiteCheck = useMemo(() => {
    return checkMasterDataPrerequisites({
      classes: classList,
      rooms: roomList,
      subjects: subjectList,
      teachers: teacherList,
    });
  }, [classList, roomList, subjectList, teacherList]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Master data fetching (classes, rooms, subjects, teachers, settings) - only runs once on mount
  const fetchMasterData = useCallback(async () => {
    setIsMasterDataLoading(true);

    try {
      // 1. Settings
      try {
        const setRes = await academicSettingApi.getSettings();
        if (setRes?.data) {
          setActiveCycleSetting(Number(setRes.data.active_cycle || 1));
          setMondayIsUpacara(Boolean(setRes.data.monday_is_upacara));
          if (Array.isArray(setRes.data.period_templates)) {
            setPeriodTemplates(setRes.data.period_templates);
          }
        }
      } catch {
        // ignore fallback
      }

      // 2. Master Data (parallel)
      const [cRes, rRes, sRes, tRes] = await Promise.allSettled([
        classApi.getClasses({ per_page: 100 }),
        roomApi.getRooms({ per_page: 100 }),
        subjectApi.getSubjects({ per_page: 100 }),
        teacherApi.getTeachers({ per_page: 100 }),
      ]);

      const classes = cRes.status === 'fulfilled' ? unwrapList(cRes.value) : [];
      const rooms = rRes.status === 'fulfilled' ? unwrapList(rRes.value) : [];
      const subjects = sRes.status === 'fulfilled' ? unwrapList(sRes.value) : [];
      const teachers = tRes.status === 'fulfilled' ? unwrapList(tRes.value) : [];

      setClassList(classes);
      setRoomList(rooms);
      setSubjectList(subjects);
      setTeacherList(teachers);
    } catch (err) {
      console.error('Gagal memuat master data jadwal:', err);
    } finally {
      setIsMasterDataLoading(false);
    }
  }, []);

  // Fetch schedules for active cycle (P-14: AbortSignal guard)
  const fetchSchedules = useCallback(async (cycleToFetch, signal) => {
    const targetCycle = cycleToFetch !== undefined ? cycleToFetch : selectedCycle;
    setIsPageLoading(true);
    setFetchError(null);

    try {
      const schedRes = await scheduleApi.getSchedules({ cycle: targetCycle, all: 1 }, { signal });
      const raw = unwrapList(schedRes);
      const mapped = raw.map((s) => ({
        id: s.id,
        cycle: Number(s.cycle_type || s.cycle || 1),
        cycle_type: Number(s.cycle_type || s.cycle || 1),
        day:
          typeof s.day_of_week === 'number'
            ? NUMBER_TO_DAY[s.day_of_week] || 'Senin'
            : s.day || 'Senin',
        day_of_week:
          typeof s.day_of_week === 'number'
            ? s.day_of_week
            : DAY_TO_NUMBER[s.day] || 1,
        slot: Number(s.period_number || s.slot || 1),
        period_number: Number(s.period_number || s.slot || 1),
        duration: Number(s.duration_periods || s.duration || 1),
        duration_periods: Number(s.duration_periods || s.duration || 1),
        teacher_id: s.teacher_id || s.teacher?.id,
        class_id: s.class_id || s.school_class?.id,
        room_id: s.room_id || s.room?.id,
        subject_id: s.subject_id || s.subject?.id,
        teacherName: s.teacher?.name || s.teacherName || 'Guru',
        className: s.school_class?.name || s.className || 'Kelas',
        level: s.school_class?.level || s.level || 10,
        roomName: s.room?.name || s.roomName || 'Ruang',
        roomType: s.room?.type || s.roomType || 'kelas',
        subjectName: s.subject?.name || s.subjectName || 'Mata Pelajaran',
      }));
      setScheduleList(mapped);
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setFetchError(
        err.message || 'Gagal memuat data jadwal pelajaran dari backend. Silakan coba beberapa saat lagi.'
      );
      setScheduleList([]);
    } finally {
      setIsPageLoading(false);
    }
  }, [selectedCycle]);

  // Combined fetch for retry action
  const refreshAllData = useCallback(async () => {
    await Promise.all([fetchMasterData(), fetchSchedules(selectedCycle)]);
  }, [fetchMasterData, fetchSchedules, selectedCycle]);

  // Load master data once on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMasterData();
  }, [fetchMasterData]);

  // Trigger schedule fetch when cycle changes (P-14: cancel in-flight request on fast switch)
  useEffect(() => {
    const controller = new AbortController();
    fetchSchedules(selectedCycle, controller.signal);
    return () => controller.abort();
  }, [fetchSchedules, selectedCycle]);

  // Conflict detection across all schedules in current cycle
  const conflictScheduleIds = useMemo(() => {
    const cycleSchedules = scheduleList.filter(
      (s) => Number(s.cycle || s.cycle_type) === Number(selectedCycle)
    );
    return detectScheduleConflicts(cycleSchedules, roomList);
  }, [scheduleList, selectedCycle, roomList]);

  // Filtered Classes based on Level, Specific Class, and Search Query
  const filteredClasses = useMemo(() => {
    return classList.filter((c) => {
      // 1. Level filter
      if (selectedLevelFilter !== 'ALL' && String(c.level) !== String(selectedLevelFilter)) {
        return false;
      }
      // 2. Specific class filter
      if (selectedClassFilter !== 'all' && String(c.id) !== String(selectedClassFilter)) {
        return false;
      }
      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesClassName = c.name?.toLowerCase().includes(q);
        const classSchedules = scheduleList.filter(
          (s) =>
            String(s.class_id) === String(c.id) &&
            Number(s.cycle || s.cycle_type) === Number(selectedCycle)
        );
        const matchesContent = classSchedules.some(
          (s) =>
            s.subjectName?.toLowerCase().includes(q) ||
            s.teacherName?.toLowerCase().includes(q) ||
            s.roomName?.toLowerCase().includes(q)
        );
        if (!matchesClassName && !matchesContent) {
          return false;
        }
      }
      return true;
    });
  }, [classList, selectedLevelFilter, selectedClassFilter, searchQuery, scheduleList, selectedCycle]);

  // Pagination for classes
  const totalClasses = filteredClasses.length;
  const totalPages = Math.max(1, Math.ceil(totalClasses / classesPerPage));
  const currentSafePage = Math.min(Math.max(1, classPage), totalPages);

  const paginatedClasses = useMemo(() => {
    const startIdx = (currentSafePage - 1) * classesPerPage;
    return filteredClasses.slice(startIdx, startIdx + classesPerPage);
  }, [filteredClasses, currentSafePage, classesPerPage]);

  // Days list to display in table columns (All 5 days or single selected day)
  const isAllDaysView = selectedDay === 'Semua Hari';
  const matrixDays = useMemo(() => {
    if (isAllDaysView) {
      return DAYS_LIST;
    }
    return [selectedDay];
  }, [isAllDaysView, selectedDay]);

  // Time slots for display
  const displaySlots = useMemo(() => {
    return getTimeSlotsForDay(
      selectedDay === 'Semua Hari' ? 'Senin' : selectedDay,
      mondayIsUpacara,
      periodTemplates
    );
  }, [selectedDay, mondayIsUpacara, periodTemplates]);

  // Smooth filter & pagination transition handlers (avoid flickering)
  const handlePageChange = (newPage) => {
    if (newPage === currentSafePage) return;
    setIsTransitioning(true);
    setClassPage(newPage);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 180);
  };

  const handleFilterChange = (setter, value, resetPage = true) => {
    setIsTransitioning(true);
    setter(value);
    if (resetPage) setClassPage(1);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 180);
  };

  const handleSearchChange = (val) => {
    const text = typeof val === 'string' ? val : val?.target?.value || '';
    setSearchQuery(text);
    setIsTransitioning(true);
    setClassPage(1);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 220);
  };

  const handleResetFilters = () => {
    setIsTransitioning(true);
    setSelectedLevelFilter('ALL');
    setSelectedClassFilter('all');
    setSelectedDay('Semua Hari');
    setSearchQuery('');
    setClassPage(1);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 200);
  };

  // Open modal to add schedule
  const handleOpenAddModal = (presetSlot = null, presetDay = null, presetClassId = null) => {
    if (!prerequisiteCheck.isReady) {
      showErrorToast(prerequisiteCheck.message);
      return;
    }
    setEditingSchedule(null);
    setFormError('');
    setFormData({
      teacher_id: teacherList[0]?.id || '',
      class_id: presetClassId || (selectedClassFilter !== 'all' ? selectedClassFilter : classList[0]?.id || ''),
      room_id: roomList[0]?.id || '',
      subject_id: subjectList[0]?.id || '',
      day: presetDay && presetDay !== 'Semua Hari' ? presetDay : 'Senin',
      slot: presetSlot || 1,
      duration: 2,
      cycle: selectedCycle,
    });
    setIsFormModalOpen(true);
  };

  // Open modal to edit existing schedule
  const handleOpenEditModal = (item) => {
    setEditingSchedule(item);
    setFormError('');
    setFormData({
      teacher_id: item.teacher_id,
      class_id: item.class_id,
      room_id: item.room_id,
      subject_id: item.subject_id,
      day: item.day,
      slot: item.slot || item.period_number || 1,
      duration: item.duration || item.duration_periods || 1,
      cycle: item.cycle || item.cycle_type || selectedCycle,
    });
    setIsFormModalOpen(true);
  };

  // Submit form trigger - requests password modal
  const handleFormSubmit = (e) => {
    e?.preventDefault();
    if (!formData.teacher_id || !formData.class_id || !formData.room_id || !formData.subject_id) {
      setFormError('Semua data guru, kelas, ruang, dan mata pelajaran wajib dipilih.');
      return;
    }
    setFormError('');
    setPendingAction({
      type: editingSchedule ? 'update' : 'create',
      data: { ...formData, id: editingSchedule?.id },
    });
    setPasswordModalError('');
    setIsPasswordModalOpen(true);
  };

  // Delete trigger - requests password modal
  const handleDeleteTrigger = () => {
    if (!editingSchedule) return;
    setPendingAction({
      type: 'delete',
      id: editingSchedule.id,
      data: editingSchedule,
    });
    setPasswordModalError('');
    setIsPasswordModalOpen(true);
  };

  // Reset trigger - requests password modal
  const handleOpenResetScheduleModal = () => {
    setPendingAction({
      type: 'reset',
    });
    setPasswordModalError('');
    setIsPasswordModalOpen(true);
  };

  // Upacara toggle trigger - requests password modal
  const handleRequestUpacaraToggle = () => {
    const nextStatus = !mondayIsUpacara;
    setPasswordModalError('');
    setPendingAction({
      type: 'upacara',
      target: nextStatus,
    });
    setIsPasswordModalOpen(true);
  };

  // Password confirmation handler (Step-Up Auth)
  const handlePasswordConfirm = async (password) => {
    if (!pendingAction) return;
    setPasswordModalLoading(true);
    setPasswordModalError('');

    try {
      if (pendingAction.type === 'create') {
        const payload = {
          cycle_type: Number(pendingAction.data.cycle),
          day_of_week: DAY_TO_NUMBER[pendingAction.data.day] || 1,
          period_number: Number(pendingAction.data.slot),
          duration_periods: Number(pendingAction.data.duration),
          class_id: Number(pendingAction.data.class_id),
          teacher_id: Number(pendingAction.data.teacher_id),
          room_id: Number(pendingAction.data.room_id),
          subject_id: Number(pendingAction.data.subject_id),
          password,
        };

        try {
          const res = await scheduleApi.createSchedule(payload);
          const created = res.data?.schedule || res.data || payload;
          const newSched = {
            id: created.id,
            ...payload,
            day: pendingAction.data.day,
            slot: payload.period_number,
            duration: payload.duration_periods,
            cycle: payload.cycle_type,
            teacherName: teacherList.find((t) => t.id === payload.teacher_id)?.name || 'Guru',
            className: classList.find((c) => c.id === payload.class_id)?.name || 'Kelas',
            roomName: roomList.find((r) => r.id === payload.room_id)?.name || 'Ruang',
            subjectName: subjectList.find((s) => s.id === payload.subject_id)?.name || 'Mapel',
          };
          setScheduleList((prev) => [...prev, newSched]);
          setIsPasswordModalOpen(false);
          setIsFormModalOpen(false);
          showToast('Jadwal pelajaran berhasil ditambahkan.');
          await fetchSchedules(selectedCycle);
        } catch (apiErr) {
          const msg = apiErr.message || apiErr.response?.data?.message;
          setPasswordModalError(msg || 'Data jadwal tidak valid atau terjadi bentrok.');
          setPasswordModalLoading(false);
          return;
        }
      } else if (pendingAction.type === 'update') {
        const payload = {
          cycle_type: Number(pendingAction.data.cycle),
          day_of_week: DAY_TO_NUMBER[pendingAction.data.day] || 1,
          period_number: Number(pendingAction.data.slot),
          duration_periods: Number(pendingAction.data.duration),
          class_id: Number(pendingAction.data.class_id),
          teacher_id: Number(pendingAction.data.teacher_id),
          room_id: Number(pendingAction.data.room_id),
          subject_id: Number(pendingAction.data.subject_id),
          password,
        };

        try {
          await scheduleApi.updateSchedule(pendingAction.data.id, payload);
          setScheduleList((prev) =>
            prev.map((s) =>
              s.id === pendingAction.data.id
                ? {
                    ...s,
                    ...payload,
                    day: pendingAction.data.day,
                    slot: payload.period_number,
                    duration: payload.duration_periods,
                    teacherName: teacherList.find((t) => t.id === payload.teacher_id)?.name || s.teacherName,
                    className: classList.find((c) => c.id === payload.class_id)?.name || s.className,
                    roomName: roomList.find((r) => r.id === payload.room_id)?.name || s.roomName,
                    subjectName: subjectList.find((s) => s.id === payload.subject_id)?.name || s.subjectName,
                  }
                : s
            )
          );
          setIsPasswordModalOpen(false);
          setIsFormModalOpen(false);
          showToast('Jadwal pelajaran berhasil diperbarui.');
          await fetchSchedules(selectedCycle);
        } catch (apiErr) {
          const msg = apiErr.message || apiErr.response?.data?.message;
          setPasswordModalError(msg || 'Gagal memperbarui jadwal: kata sandi salah atau bentrok.');
          setPasswordModalLoading(false);
          return;
        }
      } else if (pendingAction.type === 'delete') {
        try {
          await scheduleApi.deleteSchedule(pendingAction.id, { password });
          setScheduleList((prev) => prev.filter((s) => s.id !== pendingAction.id));
          setIsPasswordModalOpen(false);
          setIsFormModalOpen(false);
          showToast('Jadwal pelajaran berhasil dihapus.');
          await fetchSchedules(selectedCycle);
        } catch (apiErr) {
          if (apiErr.status === 409 || apiErr.response?.status === 409) {
            setPasswordModalError(
              'Jadwal tidak dapat dihapus (HTTP 409): Jadwal ini telah memiliki riwayat catatan jurnal KBM.'
            );
          } else {
            const msg = apiErr.message || apiErr.response?.data?.message;
            setPasswordModalError(msg || 'Kata sandi verifikasi tidak valid.');
          }
          setPasswordModalLoading(false);
          return;
        }
      } else if (pendingAction.type === 'reset') {
        try {
          const res = await scheduleApi.resetSchedules({ password });
          setScheduleList([]);
          setIsPasswordModalOpen(false);
          setPendingAction(null);
          showToast(res.data?.message || res.message || 'Seluruh Data Jadwal berhasil di-reset.');
          await fetchSchedules(selectedCycle);
        } catch (apiErr) {
          if (apiErr.status === 422) {
            setPasswordModalError(
              apiErr.errors?.password?.[0] || 'Kata sandi verifikasi tidak valid.'
            );
          } else {
            setPasswordModalError(
              apiErr.message || 'Gagal mereset data jadwal pelajaran.'
            );
          }
          setPasswordModalLoading(false);
          return;
        }
      } else if (pendingAction.type === 'upacara') {
        const nextStatus = pendingAction.target;
        try {
          await academicSettingApi.updateMondayStatus({ is_upacara: nextStatus, password });
        } catch (apiErr) {
          if (apiErr.status === 422) {
            setPasswordModalError(
              apiErr.errors?.password?.[0] || apiErr.message || 'Kata sandi verifikasi tidak valid.'
            );
          } else {
            setPasswordModalError(
              apiErr.message || 'Gagal memperbarui status upacara hari Senin.'
            );
          }
          setPasswordModalLoading(false);
          return;
        }

        setMondayIsUpacara(nextStatus);
        setIsPasswordModalOpen(false);
        setPendingAction(null);
        showToast(
          `Status Upacara Hari Senin berhasil diubah ke ${nextStatus ? 'AKTIF' : 'NONAKTIF'}.`
        );
      }
    } catch {
      setPasswordModalError('Terjadi kesalahan saat memproses jadwal.');
    } finally {
      setPasswordModalLoading(false);
    }
  };

  return (
    <div className="schedule-page">
      {/* Toast Messages */}
      {toastMessage && (
        <div className="schedule-toast" role="status">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {toastError && (
        <div className="schedule-toast schedule-toast--error" role="alert">
          <AlertCircle size={16} className="text-red-600" />
          <span>{toastError}</span>
        </div>
      )}

      {/* Header */}
      <div className="schedule-header">
        <div className="schedule-header__title-group">
          <h1 className="schedule-header__title">Jadwal Pelajaran</h1>
          <p className="schedule-header__subtitle">
            Kelola matriks jadwal mingguan KBM, pemetaan jam riil, dan alokasi ruang belajar institusi.
          </p>
        </div>
        <div className="schedule-header__actions">
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            onClick={handleOpenResetScheduleModal}
            title="Reset Seluruh Data Jadwal"
          >
            Reset Jadwal
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/kurikulum/jadwal/import')}
          >
            Import Jadwal
          </Button>
          <Button
            variant="primary"
            icon={Plus}
            disabled={!prerequisiteCheck.isReady}
            onClick={() => handleOpenAddModal()}
          >
            Tambah Jadwal Manual
          </Button>
        </div>
      </div>

      {/* Conflict Summary Alert Banner */}
      {conflictScheduleIds.size > 0 && (
        <div className="schedule-conflict-card" role="alert">
          <div className="schedule-conflict-left">
            <Badge variant="error">{conflictScheduleIds.size} Bentrok Terdeteksi</Badge>
            <span className="text-xs text-gray-700">
              Terdapat jadwal yang bertabrakan pada guru, ruangan, atau kelas yang sama di slot waktu
              bersamaan.
            </span>
          </div>
          <span className="text-xs font-mono text-red-600 font-semibold">
            Periksa kartu bertanda merah di matriks bawah
          </span>
        </div>
      )}

      {/* Monday Ceremony Control Card */}
      <div className="schedule-ceremony-card">
        <div className="schedule-ceremony-card__info">
          <div className="schedule-ceremony-card__top">
            <span className="schedule-ceremony-card__label">Upacara hari Senin</span>
            <Badge variant={mondayIsUpacara ? 'success' : 'neutral'}>
              {mondayIsUpacara ? 'Aktif' : 'Nonaktif'}
            </Badge>
          </div>
          <div className="schedule-ceremony-card__title">
            {mondayIsUpacara ? 'Upacara Aktif' : 'KBM Normal'}
          </div>
          <p className="schedule-ceremony-card__desc">
            {mondayIsUpacara
              ? 'Jam ke-1 dialokasikan untuk upacara bendera (mulai 08:00).'
              : 'Tidak ada upacara, KBM jam ke-1 dimulai normal (07:15).'}
          </p>
        </div>
        <div className="schedule-ceremony-card__actions">
          <Button variant="secondary" size="sm" icon={Flag} onClick={handleRequestUpacaraToggle}>
            Ubah ke {mondayIsUpacara ? 'Nonaktif' : 'Aktif'}
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="schedule-filters-card">
        <div className="schedule-filters">
          {/* Putaran Switcher */}
          <div className="schedule-filter-item">
            <span className="schedule-filter-label">Putaran Jadwal</span>
            <div className="inline-flex items-center bg-gray-100 p-1 rounded-md gap-1 w-fit">
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-[12px] transition-all cursor-pointer ${
                  selectedCycle === 1
                    ? 'bg-white text-gray-900 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 font-normal'
                }`}
                onClick={() => setSelectedCycle(1)}
              >
                Putaran 1 {activeCycleSetting === 1 && '(Aktif)'}
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-[12px] transition-all cursor-pointer ${
                  selectedCycle === 2
                    ? 'bg-white text-gray-900 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 font-normal'
                }`}
                onClick={() => setSelectedCycle(2)}
              >
                Putaran 2 {activeCycleSetting === 2 && '(Aktif)'}
              </button>
            </div>
          </div>

          {/* Hari Filter */}
          <div className="schedule-filter-item">
            <Select
              label="Hari Pelajaran"
              value={selectedDay}
              options={[
                { value: 'Semua Hari', label: 'Semua Hari (Senin - Jumat)' },
                ...DAYS_LIST.map((d) => ({ value: d, label: d })),
              ]}
              onChange={(e) => handleFilterChange(setSelectedDay, e.target.value, false)}
            />
          </div>

          {/* Tingkat Filter */}
          <div className="schedule-filter-item">
            <Select
              label="Tingkat Kelas"
              value={selectedLevelFilter}
              options={[
                { value: 'ALL', label: 'Semua Tingkat' },
                { value: '10', label: 'Tingkat 10 (Kelas X)' },
                { value: '11', label: 'Tingkat 11 (Kelas XI)' },
                { value: '12', label: 'Tingkat 12 (Kelas XII)' },
              ]}
              onChange={(e) => {
                handleFilterChange((val) => {
                  setSelectedLevelFilter(val);
                  setSelectedClassFilter('all');
                }, e.target.value, true);
              }}
            />
          </div>

          {/* Specific Class Filter */}
          <div className="schedule-filter-item">
            <Select
              label="Rombel Kelas"
              value={selectedClassFilter}
              options={[
                { value: 'all', label: 'Semua Rombel Kelas' },
                ...classList
                  .filter((c) => selectedLevelFilter === 'ALL' || String(c.level) === String(selectedLevelFilter))
                  .map((c) => ({ value: String(c.id), label: c.name })),
              ]}
              onChange={(e) => handleFilterChange(setSelectedClassFilter, e.target.value, true)}
            />
          </div>
        </div>

        {/* Row 2: Search Input & Per Page Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={handleSearchChange}
              onClear={() => handleSearchChange('')}
              placeholder="Cari kelas, nama guru, atau mata pelajaran..."
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Tampilkan:</span>
            <select
              value={String(classesPerPage)}
              onChange={(e) => {
                setClassesPerPage(Number(e.target.value));
                setClassPage(1);
              }}
              className="text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="1">1 Kelas / Halaman</option>
              <option value="2">2 Kelas / Halaman</option>
              <option value="3">3 Kelas / Halaman</option>
              <option value="4">4 Kelas / Halaman</option>
            </select>
          </div>
        </div>

        {/* Legend Bar */}
        <div className="schedule-legend-bar">
          <div className="schedule-legend-items">
            <div className="schedule-legend-item">
              <span className="legend-swatch legend-swatch--active" />
              <span>Jadwal Normal</span>
            </div>
            <div className="schedule-legend-item">
              <span className="legend-swatch legend-swatch--conflict" />
              <span>Bentrok (Guru / Ruang / Kelas)</span>
            </div>
            {mondayIsUpacara && (
              <div className="schedule-legend-item">
                <Flag size={12} className="text-amber-600" />
                <span className="text-amber-800">Senin: Jam ke-1 Upacara (Mulai 08:00)</span>
              </div>
            )}
          </div>
          <div>
            Menampilkan:{' '}
            <strong className="text-gray-900">
              {isPageLoading || isTransitioning ? (
                <span className="inline-block animate-pulse text-gray-400">Memuat...</span>
              ) : (
                `${totalClasses} Rombel Kelas ${selectedLevelFilter !== 'ALL' ? `(Tingkat ${selectedLevelFilter})` : ''}`
              )}
            </strong>
          </div>
        </div>
      </div>

      {/* Dynamic Content: 1. Loading Skeleton | 2. Error State | 3. Empty State | 4. Schedule Tables */}
      {isPageLoading || isTransitioning ? (
        <ScheduleTableSkeleton
          count={classesPerPage}
          days={matrixDays}
          hasCeremony={mondayIsUpacara}
        />
      ) : fetchError ? (
        <div className="bg-white border border-red-200 rounded-lg p-6">
          <ErrorState
            title="Gagal Memuat Jadwal Pelajaran"
            message={fetchError}
            onRetry={refreshAllData}
            retryLabel="Muat Ulang Jadwal"
          />
        </div>
      ) : paginatedClasses.length === 0 ? (
        <EmptyState
          type={searchQuery || selectedLevelFilter !== 'ALL' || selectedClassFilter !== 'all' ? 'search' : 'default'}
          title={
            searchQuery || selectedLevelFilter !== 'ALL' || selectedClassFilter !== 'all'
              ? 'Tidak Ada Jadwal atau Kelas Ditemukan'
              : 'Belum Ada Jadwal Pelajaran'
          }
          description={
            searchQuery
              ? `Tidak ditemukan rombel kelas atau jadwal yang cocok dengan kata kunci "${searchQuery}".`
              : selectedLevelFilter !== 'ALL' || selectedClassFilter !== 'all'
              ? 'Tidak ada rombel kelas yang sesuai dengan kombinasi filter yang Anda pilih.'
              : 'Jadwal pelajaran untuk putaran ini belum diatur atau belum diimpor dari berkas FET.'
          }
          actionLabel={
            searchQuery || selectedLevelFilter !== 'ALL' || selectedClassFilter !== 'all'
              ? 'Reset Semua Filter'
              : 'Impor Jadwal FET'
          }
          onAction={
            searchQuery || selectedLevelFilter !== 'ALL' || selectedClassFilter !== 'all'
              ? handleResetFilters
              : () => navigate('/kurikulum/jadwal/import')
          }
        />
      ) : (
        <div className="schedule-classes-container">
          {paginatedClasses.map((c) => {
            // Schedules for this specific class in the active cycle
            const classSchedules = scheduleList.filter(
              (s) =>
                String(s.class_id) === String(c.id) &&
                Number(s.cycle || s.cycle_type) === Number(selectedCycle)
            );

            const totalJP = classSchedules.reduce(
              (sum, s) => sum + Number(s.duration || s.duration_periods || 1),
              0
            );
            const uniqueSubjects = new Set(classSchedules.map((s) => s.subject_id)).size;
            const uniqueTeachers = new Set(classSchedules.map((s) => s.teacher_id)).size;
            const hasConflict = classSchedules.some((s) => conflictScheduleIds.has(s.id));

            return (
              <div key={c.id} className="schedule-class-section">
                {/* Header Identitas Rombel Kelas */}
                <div className="schedule-class-header">
                  <div className="schedule-class-title-group">
                    <div className="schedule-class-title-row">
                      <h2 className="schedule-class-title">Kelas {c.name}</h2>
                      <Badge variant="outline">Tingkat {c.level}</Badge>
                      {hasConflict && (
                        <Badge variant="error" className="text-[10px]">
                          Bentrok Terdeteksi
                        </Badge>
                      )}
                    </div>
                    <span className="schedule-class-subtitle">
                      SMK NEGERI 1 BANTUL &bull; Putaran {selectedCycle} {activeCycleSetting === selectedCycle && '(Aktif)'}
                    </span>
                  </div>

                  <div className="schedule-class-actions">
                    <span className="schedule-class-stat-badge">
                      <strong>{totalJP}</strong> JP / Minggu
                    </span>
                    <span className="schedule-class-stat-badge">
                      <strong>{uniqueSubjects}</strong> Mapel
                    </span>
                    <span className="schedule-class-stat-badge">
                      <strong>{uniqueTeachers}</strong> Guru
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      disabled={!prerequisiteCheck.isReady}
                      onClick={() => handleOpenAddModal(null, null, c.id)}
                    >
                      Tambah Jadwal
                    </Button>
                  </div>
                </div>

                {/* Table Matrix */}
                <div className="schedule-matrix-container border-0 rounded-none">
                  <table className="schedule-matrix">
                    <thead>
                      <tr>
                        <th scope="col" className="whitespace-nowrap">
                          Jam / Waktu Riil
                        </th>
                        {matrixDays.map((dayName) => {
                          const kbmStartTime = getDayKbmStartTime(dayName, mondayIsUpacara);
                          return (
                            <th key={dayName} scope="col" className="whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span>{dayName}</span>
                                <span className="text-[10px] text-text-tertiary font-normal tracking-normal lowercase">
                                  &bull; mulai {kbmStartTime} WIB
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Morning Entry & Character Building Row (07:00 WIB) */}
                      <tr className="schedule-morning-row border-b border-border-default/70 bg-slate-50/30">
                        <td className="schedule-slot-cell whitespace-nowrap bg-slate-50/80">
                          <div className="schedule-slot-header">
                            <span className="schedule-slot-num text-text-primary font-semibold">
                              Jam Masuk
                            </span>
                            <span className="schedule-slot-time text-primary-600 font-semibold">
                              07:00 WIB
                            </span>
                          </div>
                        </td>

                        {matrixDays.map((dayName) => {
                          const morning = getMorningActivity(dayName, mondayIsUpacara);
                          const isMondayUpacara = dayName === 'Senin' && mondayIsUpacara;

                          return (
                            <td key={`morning-${dayName}`} className="schedule-morning-cell align-top p-2.5">
                              <div
                                className={`schedule-morning-card p-2.5 rounded-lg border transition-all ${
                                  isMondayUpacara
                                    ? 'schedule-morning-card--upacara bg-amber-50/70 border-amber-200/80'
                                    : 'schedule-morning-card--regular bg-slate-50/70 border-slate-200/70'
                                }`}
                              >
                                <div className="schedule-morning-card__header flex items-center justify-between gap-1.5 mb-1">
                                  <span
                                    className={`schedule-morning-badge text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                      isMondayUpacara
                                        ? 'schedule-morning-badge--upacara bg-amber-100 text-amber-900 border border-amber-300/60'
                                        : 'schedule-morning-badge--regular bg-slate-200/70 text-slate-700 border border-slate-300/50'
                                    }`}
                                  >
                                    {isMondayUpacara && (
                                      <Flag size={10} className="inline mr-1 text-amber-700 shrink-0" />
                                    )}
                                    {morning.badge}
                                  </span>
                                  <span className="schedule-morning-time text-[10px] font-mono text-text-tertiary">
                                    {morning.time}
                                  </span>
                                </div>
                                <div
                                  className={`schedule-morning-title text-[12px] font-semibold leading-tight ${
                                    isMondayUpacara ? 'text-amber-950' : 'text-slate-800'
                                  }`}
                                >
                                  {morning.title}
                                </div>
                                <div className="schedule-morning-desc text-[10px] text-text-tertiary mt-1">
                                  {isMondayUpacara
                                    ? 'KBM Jam Ke-1 dimulai 08:00 WIB'
                                    : `KBM Jam Ke-1 dimulai ${morning.kbmStart} WIB`}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Slots Iteration */}
                      {displaySlots.map((slotObj) => (
                        <Fragment key={slotObj.slot}>
                          <tr>
                            <td className="schedule-slot-cell whitespace-nowrap">
                              <div className="schedule-slot-header">
                                <span className="schedule-slot-num">{slotObj.label}</span>
                                {matrixDays.length === 1 && (
                                  <span className="schedule-slot-time">
                                    {getTimeSlotsForDay(matrixDays[0], mondayIsUpacara, periodTemplates).find(
                                      (s) => s.slot === slotObj.slot
                                    )?.start || ''}
                                    {getTimeSlotsForDay(matrixDays[0], mondayIsUpacara, periodTemplates).find(
                                      (s) => s.slot === slotObj.slot
                                    )
                                      ? ` - ${
                                          getTimeSlotsForDay(matrixDays[0], mondayIsUpacara, periodTemplates).find(
                                            (s) => s.slot === slotObj.slot
                                          )?.end
                                        }`
                                      : ''}
                                  </span>
                                )}
                              </div>
                            </td>

                          {matrixDays.map((dayName) => {
                            // Find schedule items starting at this slot
                            const cellSchedules = classSchedules.filter((s) => {
                              const matchSlot = Number(s.slot || s.period_number) === Number(slotObj.slot);
                              if (!matchSlot) return false;
                              return s.day === dayName;
                            });

                            // Find schedule continuing into this slot from an earlier period
                            const continuationSchedule = classSchedules.find((s) => {
                              if (s.day !== dayName) return false;
                              const start = Number(s.slot || s.period_number);
                              const dur = Number(s.duration || s.duration_periods || 1);
                              return start < slotObj.slot && slotObj.slot < start + dur;
                            });

                            // Check if this slot is off-KBM for the current day
                            const daySlots = getTimeSlotsForDay(dayName, mondayIsUpacara, periodTemplates);
                            const isDayOff = !daySlots.some((s) => s.slot === Number(slotObj.slot));

                            return (
                              <td key={dayName}>
                                {cellSchedules.length > 0 ? (
                                  <div className="schedule-cell-content">
                                    {cellSchedules.map((item) => {
                                      const isConflict = conflictScheduleIds.has(item.id);
                                      const slotTime = resolveSlotTime(
                                        item.day,
                                        item.slot || item.period_number,
                                        item.duration || item.duration_periods || 1,
                                        mondayIsUpacara,
                                        periodTemplates
                                      );

                                      return (
                                        <div
                                          key={item.id}
                                          className={`schedule-card ${isConflict ? 'schedule-card--conflict' : ''}`}
                                          onClick={() => handleOpenEditModal(item)}
                                          title="Klik untuk mengedit atau menghapus jadwal"
                                        >
                                          <div className="schedule-card__top">
                                            <div className="schedule-card__title-group">
                                              <span className="schedule-card__subject">{item.subjectName}</span>
                                              {isConflict && (
                                                <Badge variant="error" className="text-[9px] px-1 py-0 shrink-0">
                                                  Bentrok
                                                </Badge>
                                              )}
                                            </div>
                                            <span className="schedule-card__time">
                                              {slotTime.startTime} - {slotTime.endTime}
                                            </span>
                                          </div>
                                          <span className="schedule-card__teacher">
                                            {item.teacherName}
                                          </span>
                                          <div className="schedule-card__badge-row">
                                            <span className="schedule-card__info-tag font-mono">
                                              {item.duration || item.duration_periods} JP
                                            </span>
                                            <span className="schedule-card__info-tag font-mono">
                                              {item.roomName}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : continuationSchedule ? (
                                  <div
                                    className="schedule-continuation-block"
                                    onClick={() => handleOpenEditModal(continuationSchedule)}
                                    title={`Lanjutan dari Jam Ke-${continuationSchedule.slot}: ${continuationSchedule.subjectName}`}
                                  >
                                    <span className="schedule-continuation-text">
                                      ↳ Lanjutan: {continuationSchedule.subjectName} ({continuationSchedule.roomName})
                                    </span>
                                  </div>
                                ) : isDayOff ? (
                                  <div className="schedule-cell-off" title={`Di luar alokasi jam KBM ${dayName} (Off)`}>
                                    -x-
                                  </div>
                                ) : (
                                  <div className="schedule-cell--empty">
                                    <button
                                      type="button"
                                      className="schedule-cell__empty-btn"
                                      disabled={!prerequisiteCheck.isReady}
                                      onClick={() => handleOpenAddModal(slotObj.slot, dayName, c.id)}
                                      title={
                                        prerequisiteCheck.isReady
                                          ? `Tambah jadwal ${c.name} hari ${dayName} Jam Ke-${slotObj.slot}`
                                          : 'Lengkapi Master Data terlebih dahulu'
                                      }
                                    >
                                      <Plus size={12} />
                                      <span>Kosong</span>
                                    </button>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          </tr>

                          {/* Istirahat I setelah Jam Ke-3 */}
                          {slotObj.slot === 3 && (
                            <ScheduleBreakRow
                              breakNumber={1}
                              matrixDays={matrixDays}
                              mondayIsUpacara={mondayIsUpacara}
                            />
                          )}

                          {/* Istirahat II setelah Jam Ke-6 */}
                          {slotObj.slot === 6 && (
                            <ScheduleBreakRow
                              breakNumber={2}
                              matrixDays={matrixDays}
                              mondayIsUpacara={mondayIsUpacara}
                            />
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Class Pagination */}
      {!isPageLoading && !isTransitioning && !fetchError && filteredClasses.length > classesPerPage && (
        <div className="flex justify-center mt-2">
          <Pagination
            currentPage={currentSafePage}
            totalPages={totalPages}
            totalItems={totalClasses}
            perPage={classesPerPage}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Modal Form Tambah / Edit Jadwal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingSchedule ? 'Edit Jadwal Pelajaran' : 'Tambah Jadwal Pelajaran'}
        size="md"
        footer={
          <div className="schedule-form-footer">
            {editingSchedule && (
              <Button
                variant="outline"
                icon={Trash2}
                className="text-red-600 hover:bg-red-50 hover:border-red-300"
                onClick={handleDeleteTrigger}
              >
                Hapus Jadwal
              </Button>
            )}
            <div className="schedule-form-footer__right">
              <Button variant="secondary" onClick={() => setIsFormModalOpen(false)}>
                Batal
              </Button>
              <Button variant="primary" icon={Save} onClick={handleFormSubmit}>
                Simpan Jadwal
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleFormSubmit} className="schedule-form">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <div className="schedule-form-row">
            <Select
              label="Putaran Jadwal"
              value={String(formData.cycle)}
              options={[
                { value: '1', label: 'Putaran 1' },
                { value: '2', label: 'Putaran 2' },
              ]}
              onChange={(e) => setFormData({ ...formData, cycle: Number(e.target.value) })}
              required
            />
            <Select
              label="Hari KBM"
              value={formData.day}
              options={DAYS_LIST.map((d) => ({ value: d, label: d }))}
              onChange={(e) => setFormData({ ...formData, day: e.target.value })}
              required
            />
          </div>

          <div className="schedule-form-row">
            <Select
              label="Jam Pelajaran Mulai"
              value={String(formData.slot)}
              options={Array.from({ length: 10 }, (_, i) => ({
                value: String(i + 1),
                label: `Jam Ke-${i + 1}`,
              }))}
              onChange={(e) => setFormData({ ...formData, slot: Number(e.target.value) })}
              required
            />
            <Select
              label="Durasi Pelajaran (JP)"
              value={String(formData.duration)}
              options={[
                { value: '1', label: '1 Jam Pelajaran (45 Menit)' },
                { value: '2', label: '2 Jam Pelajaran (90 Menit)' },
                { value: '3', label: '3 Jam Pelajaran (135 Menit)' },
                { value: '4', label: '4 Jam Pelajaran (180 Menit)' },
              ]}
              onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
              required
            />
          </div>

          <Select
            label="Rombel Kelas"
            value={String(formData.class_id)}
            options={classList.map((c) => ({
              value: String(c.id),
              label: `${c.name} (Tingkat ${c.level})`,
            }))}
            onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
            required
          />

          <Select
            label="Mata Pelajaran"
            value={String(formData.subject_id)}
            options={subjectList.map((s) => ({
              value: String(s.id),
              label: s.name,
            }))}
            onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
            required
          />

          <Select
            label="Guru Pengampu"
            value={String(formData.teacher_id)}
            options={teacherList.map((t) => ({
              value: String(t.id),
              label: `${t.name} ${t.nis_nip ? `[NIP: ${t.nis_nip}]` : ''}`,
            }))}
            onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
            required
          />

          <Select
            label="Alokasi Ruangan"
            value={String(formData.room_id)}
            options={roomList.map((r) => ({
              value: String(r.id),
              label: `${r.name} (${r.type === 'lab' ? 'Lab Komputer' : r.type === 'bengkel' ? 'Bengkel' : 'Ruang Teori'})`,
            }))}
            onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
            required
          />
        </form>
      </Modal>

      {/* Password Confirmation Modal (Step-Up Auth) */}
      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setPasswordModalError('');
          setPendingAction(null);
        }}
        onConfirm={handlePasswordConfirm}
        title={
          pendingAction?.type === 'reset'
            ? 'Konfirmasi Reset Data Jadwal'
            : pendingAction?.type === 'delete'
            ? 'Konfirmasi Penghapusan Jadwal'
            : pendingAction?.type === 'upacara'
            ? 'Konfirmasi Perubahan Status Upacara'
            : 'Konfirmasi Penyimpanan Jadwal'
        }
        description={
          pendingAction?.type === 'reset'
            ? 'Tindakan ini akan menghapus seluruh data jadwal pelajaran yang aktif di sistem sekolah.'
            : pendingAction?.type === 'delete'
            ? 'Tindakan ini akan menghapus jadwal KBM secara permanen. Jadwal yang telah memiliki jurnal KBM tidak dapat dihapus. Masukkan kata sandi akun Anda untuk konfirmasi.'
            : pendingAction?.type === 'upacara'
            ? `Anda akan mengubah status Upacara Hari Senin menjadi ${
                pendingAction?.target ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'
              }. Perubahan ini memengaruhi alokasi jam pelajaran pertama pada hari Senin. Masukkan kata sandi akun Anda untuk verifikasi.`
            : 'Perubahan jadwal memengaruhi jadwal KBM aktif sekolah. Masukkan kata sandi akun Anda untuk verifikasi otoritas.'
        }
        consequence={
          pendingAction?.type === 'reset'
            ? 'PERINGATAN: Seluruh jadwal pelajaran akan dihapus dari sistem. Data riwayat catatan jurnal KBM masa lalu tetap aman. Tindakan ini tidak dapat dibatalkan. Masukkan kata sandi akun Anda untuk mengonfirmasi.'
            : ''
        }
        confirmText={
          pendingAction?.type === 'reset'
            ? 'Reset Semua Jadwal'
            : pendingAction?.type === 'delete'
            ? 'Hapus Jadwal'
            : pendingAction?.type === 'upacara'
            ? `Ubah ke ${pendingAction?.target ? 'Aktif' : 'Nonaktif'}`
            : 'Simpan'
        }
        confirmVariant={
          pendingAction?.type === 'reset' || pendingAction?.type === 'delete'
            ? 'danger'
            : 'primary'
        }
        loading={passwordModalLoading}
        error={passwordModalError}
      />
    </div>
  );
}
