import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Clock,
  AlertTriangle,
  Trash2,
  Save,
  CheckCircle2,
  MapPin,
  GraduationCap,
  Flag,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Button, Select, Modal, Badge, PasswordModal } from '../../components/shared';
import { scheduleApi, academicSettingApi } from '../../services/scheduleApi';
import { classApi, roomApi, subjectApi, teacherApi } from '../../services/masterDataApi';
import {
  DAYS_LIST,
  DAY_TO_NUMBER,
  NUMBER_TO_DAY,
  getTimeSlotsForDay,
  resolveSlotTime,
  detectScheduleConflicts,
} from '../../utils/timetableHelper';
import { checkMasterDataPrerequisites } from '../../utils/prerequisiteHelper';
import './ScheduleManagement.css';

// Fallback schedules in case backend is offline
const FALLBACK_SCHEDULES = [
  {
    id: 1,
    cycle: 1,
    cycle_type: 1,
    day: 'Senin',
    day_of_week: 1,
    slot: 1,
    period_number: 1,
    duration: 2,
    duration_periods: 2,
    teacher_id: 1,
    class_id: 1,
    room_id: 1,
    subject_id: 1,
    teacherName: 'Drs. Ahmad Fauzi, M.Pd.',
    className: 'X-RPL-1',
    level: 10,
    roomName: 'R-101',
    roomType: 'kelas',
    subjectName: 'Matematika',
  },
  {
    id: 2,
    cycle: 1,
    cycle_type: 1,
    day: 'Senin',
    day_of_week: 1,
    slot: 3,
    period_number: 3,
    duration: 2,
    duration_periods: 2,
    teacher_id: 2,
    class_id: 1,
    room_id: 1,
    subject_id: 2,
    teacherName: 'Siti Nurhaliza, S.Pd.',
    className: 'X-RPL-1',
    level: 10,
    roomName: 'R-101',
    roomType: 'kelas',
    subjectName: 'Bahasa Indonesia',
  },
  {
    id: 3,
    cycle: 1,
    cycle_type: 1,
    day: 'Senin',
    day_of_week: 1,
    slot: 1,
    period_number: 1,
    duration: 2,
    duration_periods: 2,
    teacher_id: 3,
    class_id: 2,
    room_id: 2,
    subject_id: 3,
    teacherName: 'Budi Santoso, S.T., M.T.',
    className: 'X-TKJ-1',
    level: 10,
    roomName: 'Lab Komputer 1',
    roomType: 'lab',
    subjectName: 'Dasar Pemrograman',
  },
  {
    id: 4,
    cycle: 1,
    cycle_type: 1,
    day: 'Selasa',
    day_of_week: 2,
    slot: 1,
    period_number: 1,
    duration: 2,
    duration_periods: 2,
    teacher_id: 1,
    class_id: 1,
    room_id: 1,
    subject_id: 1,
    teacherName: 'Drs. Ahmad Fauzi, M.Pd.',
    className: 'X-RPL-1',
    level: 10,
    roomName: 'R-101',
    roomType: 'kelas',
    subjectName: 'Matematika',
  },
];

export default function ScheduleManagementPage() {
  const navigate = useNavigate();

  // Settings & Master Datasets
  const [activeCycleSetting, setActiveCycleSetting] = useState(1);
  const [mondayIsUpacara, setMondayIsUpacara] = useState(true);

  const [classList, setClassList] = useState([]);
  const [roomList, setRoomList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [teacherList, setTeacherList] = useState([]);

  // Schedules state
  const [scheduleList, setScheduleList] = useState(FALLBACK_SCHEDULES);

  // Filter States
  const [selectedCycle, setSelectedCycle] = useState(1);
  const [selectedDay, setSelectedDay] = useState('Semua Hari');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('ALL');
  const [selectedRoomTypeFilter, setSelectedRoomTypeFilter] = useState('ALL');

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

  // Load all initial data on mount & when cycle changes
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        // 1. Settings
        try {
          const setRes = await academicSettingApi.getSettings();
          if (isMounted && setRes?.data) {
            const cyc = Number(setRes.data.active_cycle || 1);
            setActiveCycleSetting(cyc);
            setMondayIsUpacara(Boolean(setRes.data.monday_is_upacara));
          }
        } catch {
          // Use defaults
        }

        // 2. Master Data
        const [cRes, rRes, sRes, tRes] = await Promise.allSettled([
          classApi.getClasses(),
          roomApi.getRooms(),
          subjectApi.getSubjects(),
          teacherApi.getTeachers(),
        ]);

        if (isMounted) {
          const classes = cRes.status === 'fulfilled' && cRes.value.data ? (Array.isArray(cRes.value.data) ? cRes.value.data : cRes.value.data.data || []) : [];
          const rooms = rRes.status === 'fulfilled' && rRes.value.data ? (Array.isArray(rRes.value.data) ? rRes.value.data : rRes.value.data.data || []) : [];
          const subjects = sRes.status === 'fulfilled' && sRes.value.data ? (Array.isArray(sRes.value.data) ? sRes.value.data : sRes.value.data.data || []) : [];
          const teachers = tRes.status === 'fulfilled' && tRes.value.data ? (Array.isArray(tRes.value.data) ? tRes.value.data : tRes.value.data.data || []) : [];

          setClassList(classes);
          setRoomList(rooms);
          setSubjectList(subjects);
          setTeacherList(teachers);
        }

        // 3. Schedules
        try {
          const schedRes = await scheduleApi.getSchedules({ cycle: selectedCycle });
          if (isMounted && schedRes?.data) {
            const raw = Array.isArray(schedRes.data) ? schedRes.data : schedRes.data.data || [];
            if (raw.length > 0) {
              const mapped = raw.map((s) => ({
                id: s.id,
                cycle: Number(s.cycle_type || s.cycle || 1),
                cycle_type: Number(s.cycle_type || s.cycle || 1),
                day: typeof s.day_of_week === 'number' ? NUMBER_TO_DAY[s.day_of_week] || 'Senin' : s.day || 'Senin',
                day_of_week: typeof s.day_of_week === 'number' ? s.day_of_week : DAY_TO_NUMBER[s.day] || 1,
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
            }
          }
        } catch {
          // Fallback schedules
        }
      } catch {
        // Fallback
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [selectedCycle]);

  // Conflict detection
  const conflictScheduleIds = useMemo(() => {
    const cycleSchedules = scheduleList.filter(
      (s) => Number(s.cycle || s.cycle_type) === Number(selectedCycle)
    );
    return detectScheduleConflicts(cycleSchedules);
  }, [scheduleList, selectedCycle]);

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
      class_id: presetClassId || classList[0]?.id || '',
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
          const newSched = res.data?.schedule || {
            ...payload,
            id: Date.now(),
            day: pendingAction.data.day,
            slot: payload.period_number,
            duration: payload.duration_periods,
            teacherName: teacherList.find((t) => t.id === payload.teacher_id)?.name || 'Guru',
            className: classList.find((c) => c.id === payload.class_id)?.name || 'Kelas',
            roomName: roomList.find((r) => r.id === payload.room_id)?.name || 'Ruang',
            subjectName: subjectList.find((s) => s.id === payload.subject_id)?.name || 'Mapel',
          };
          setScheduleList((prev) => [...prev, newSched]);
        } catch (apiErr) {
          if (apiErr.status === 422) {
            setPasswordModalError(apiErr.message || 'Data jadwal tidak valid atau terjadi bentrok.');
            setPasswordModalLoading(false);
            return;
          }
          // Fallback offline create
          const fallbackNew = {
            id: Date.now(),
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
          setScheduleList((prev) => [...prev, fallbackNew]);
        }

        setIsPasswordModalOpen(false);
        setIsFormModalOpen(false);
        showToast('Jadwal pelajaran berhasil ditambahkan.');
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
        } catch (apiErr) {
          if (apiErr.status === 422) {
            setPasswordModalError(apiErr.message || 'Gagal memperbarui jadwal: kata sandi salah atau bentrok.');
            setPasswordModalLoading(false);
            return;
          }
        }

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
      } else if (pendingAction.type === 'delete') {
        try {
          await scheduleApi.deleteSchedule(pendingAction.id, { password });
        } catch (apiErr) {
          if (apiErr.status === 409) {
            setPasswordModalError(
              'Jadwal tidak dapat dihapus (HTTP 409): Jadwal ini telah memiliki riwayat catatan jurnal KBM.'
            );
            setPasswordModalLoading(false);
            return;
          }
          if (apiErr.status === 422) {
            setPasswordModalError('Kata sandi verifikasi tidak valid.');
            setPasswordModalLoading(false);
            return;
          }
        }

        setScheduleList((prev) => prev.filter((s) => s.id !== pendingAction.id));
        setIsPasswordModalOpen(false);
        setIsFormModalOpen(false);
        showToast('Jadwal pelajaran berhasil dihapus.');
      }
    } catch {
      setPasswordModalError('Terjadi kesalahan saat memproses jadwal.');
    } finally {
      setPasswordModalLoading(false);
    }
  };

  // Filtered schedules for current cycle and active filters
  const filteredSchedules = useMemo(() => {
    return scheduleList.filter((s) => {
      if (Number(s.cycle || s.cycle_type) !== Number(selectedCycle)) return false;
      if (selectedDay !== 'Semua Hari' && s.day !== selectedDay) return false;
      if (selectedClassFilter !== 'all' && Number(s.class_id) !== Number(selectedClassFilter)) return false;
      if (selectedLevelFilter !== 'ALL' && String(s.level) !== String(selectedLevelFilter)) return false;
      if (selectedRoomTypeFilter !== 'ALL' && s.roomType !== selectedRoomTypeFilter) return false;
      return true;
    });
  }, [
    scheduleList,
    selectedCycle,
    selectedDay,
    selectedClassFilter,
    selectedLevelFilter,
    selectedRoomTypeFilter,
  ]);

  // Columns definition: if 'Semua Hari' -> Columns are Days (Senin - Jumat)
  // If specific day -> Columns are classes
  const isAllDaysView = selectedDay === 'Semua Hari';

  const matrixColumns = useMemo(() => {
    if (isAllDaysView) {
      return DAYS_LIST.map((d) => ({ key: d, label: d, type: 'day' }));
    }
    // Specific Day view: columns are classes
    const classesToShow = classList.filter((c) => {
      if (selectedLevelFilter !== 'ALL' && String(c.level) !== String(selectedLevelFilter)) return false;
      if (selectedClassFilter !== 'all' && Number(c.id) !== Number(selectedClassFilter)) return false;
      return true;
    });
    return classesToShow.map((c) => ({ key: String(c.id), label: c.name, type: 'class', classObj: c }));
  }, [isAllDaysView, classList, selectedLevelFilter, selectedClassFilter]);

  // Time slots for selected day (if all days, use regular standard 1-10)
  const displaySlots = useMemo(() => {
    return getTimeSlotsForDay(selectedDay === 'Semua Hari' ? 'Senin' : selectedDay, mondayIsUpacara);
  }, [selectedDay, mondayIsUpacara]);

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
            icon={ExternalLink}
            onClick={() => navigate('/web/upload-import')}
          >
            Import PDF FET
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

      {/* Pre-condition Gate Alert Banner */}
      {!prerequisiteCheck.isReady && (
        <div className="schedule-precondition-card" role="alert">
          <div className="schedule-precondition-left">
            <AlertTriangle size={20} className="shrink-0 text-amber-700" />
            <div>
              <strong>Prasyarat Master Data Belum Lengkap</strong>
              <p className="mt-0.5 text-xs text-amber-800">
                Penyusunan jadwal dinonaktifkan sementara karena entitas master data berikut belum tersedia:{' '}
                <em>{prerequisiteCheck.missingEntities.join(', ')}</em>.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/web/master-data')}
          >
            Lengkapi di Master Data &rarr;
          </Button>
        </div>
      )}

      {/* Conflict Summary Alert Banner (If Any Conflicts Found) */}
      {conflictScheduleIds.size > 0 && (
        <div className="schedule-conflict-card" role="alert">
          <div className="schedule-conflict-left">
            <Badge variant="error">{conflictScheduleIds.size} Bentrok Terdeteksi</Badge>
            <span className="text-xs text-gray-700">
              Terdapat jadwal yang bertabrakan pada guru, ruangan, atau kelas yang sama di slot waktu bersamaan.
            </span>
          </div>
          <span className="text-xs font-mono text-red-600 font-semibold">
            Periksa kartu bertanda merah di matriks bawah
          </span>
        </div>
      )}

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

          {/* Day Filter */}
          <div className="schedule-filter-item">
            <Select
              label="Hari Pelajaran"
              value={selectedDay}
              options={[
                { value: 'Semua Hari', label: 'Semua Hari (Senin - Jumat)' },
                ...DAYS_LIST.map((d) => ({ value: d, label: d })),
              ]}
              onChange={(e) => setSelectedDay(e.target.value)}
            />
          </div>

          {/* Level Filter */}
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
                setSelectedLevelFilter(e.target.value);
                setSelectedClassFilter('all');
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
              onChange={(e) => setSelectedClassFilter(e.target.value)}
            />
          </div>

          {/* Room Type Filter */}
          <div className="schedule-filter-item">
            <Select
              label="Tipe Ruang"
              value={selectedRoomTypeFilter}
              options={[
                { value: 'ALL', label: 'Semua Tipe Ruang' },
                { value: 'kelas', label: 'Ruang Teori' },
                { value: 'lab', label: 'Laboratorium Komputer' },
                { value: 'bengkel', label: 'Bengkel / Praktik' },
              ]}
              onChange={(e) => setSelectedRoomTypeFilter(e.target.value)}
            />
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
            Tampilan:{' '}
            <strong className="text-gray-900">
              {isAllDaysView ? 'Matriks Hari (Senin - Jumat)' : `Matriks Kelas (${selectedDay})`}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Schedule Matrix Grid */}
      <div className="schedule-matrix-container">
        <table className="schedule-matrix">
          <thead>
            <tr>
              <th scope="col" className="whitespace-nowrap">Jam / Waktu Riil</th>
              {matrixColumns.map((col) => (
                <th key={col.key} scope="col" className="whitespace-nowrap">
                  {col.type === 'day' ? col.label : `Kelas ${col.label}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Optional Ceremony Header Row on Monday */}
            {(selectedDay === 'Senin' || isAllDaysView) && mondayIsUpacara && (
              <tr className="bg-amber-50/60 border-b border-amber-200/50">
                <td className="schedule-slot-cell whitespace-nowrap bg-amber-100/50">
                  <div className="schedule-slot-header">
                    <span className="schedule-slot-num text-amber-900">Upacara</span>
                    <span className="schedule-slot-time text-amber-700">07:00 - 07:45</span>
                  </div>
                </td>
                <td colSpan={matrixColumns.length} className="py-2.5 px-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-[12px] font-medium text-amber-900">
                    <Flag size={14} className="text-amber-700" />
                    <span>Upacara Bendera Hari Senin &bull; KBM Jam Ke-1 Dimulai Pukul 08:00 WIB</span>
                  </div>
                </td>
              </tr>
            )}

            {/* Slots Iteration */}
            {displaySlots.map((slotObj) => (
              <tr key={slotObj.slot}>
                <td className="schedule-slot-cell whitespace-nowrap">
                  <div className="schedule-slot-header">
                    <span className="schedule-slot-num">{slotObj.label}</span>
                    <span className="schedule-slot-time">
                      {slotObj.start} - {slotObj.end}
                    </span>
                  </div>
                </td>

                {matrixColumns.map((col) => {
                  // Find schedule items matching this cell
                  const cellSchedules = filteredSchedules.filter((s) => {
                    const matchSlot = Number(s.slot || s.period_number) === Number(slotObj.slot);
                    if (!matchSlot) return false;

                    if (col.type === 'day') {
                      return s.day === col.key;
                    }
                    return String(s.class_id) === String(col.key);
                  });

                  return (
                    <td key={col.key}>
                      {cellSchedules.length > 0 ? (
                        <div className="schedule-cell-content">
                          {cellSchedules.map((item) => {
                            const isConflict = conflictScheduleIds.has(item.id);
                            const slotTime = resolveSlotTime(
                              item.day,
                              item.slot || item.period_number,
                              item.duration || item.duration_periods || 1,
                              mondayIsUpacara
                            );

                            return (
                              <div
                                key={item.id}
                                className={`schedule-card ${isConflict ? 'schedule-card--conflict' : ''}`}
                                onClick={() => handleOpenEditModal(item)}
                                title="Klik untuk mengedit atau menghapus jadwal"
                              >
                                <div className="schedule-card__top">
                                  <span className="schedule-card__subject">{item.subjectName}</span>
                                  {isConflict && (
                                    <Badge variant="error" className="text-[9px] px-1 py-0">
                                      Bentrok
                                    </Badge>
                                  )}
                                </div>
                                <span className="schedule-card__teacher">{item.teacherName}</span>
                                <div className="schedule-card__badge-row">
                                  <span className="schedule-card__info-tag">
                                    <Clock size={10} className="inline mr-1 text-gray-400" />
                                    {item.duration || item.duration_periods} JP ({slotTime.startTime}-{slotTime.endTime})
                                  </span>
                                  <span className="schedule-card__info-tag">
                                    <MapPin size={10} className="inline mr-1 text-gray-400" />
                                    {item.roomName}
                                  </span>
                                  {col.type === 'day' && (
                                    <span className="schedule-card__info-tag">
                                      <GraduationCap size={10} className="inline mr-1 text-gray-400" />
                                      {item.className}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="schedule-cell--empty">
                          <button
                            type="button"
                            className="schedule-cell__empty-btn"
                            disabled={!prerequisiteCheck.isReady}
                            onClick={() =>
                              handleOpenAddModal(
                                slotObj.slot,
                                col.type === 'day' ? col.key : selectedDay,
                                col.type === 'class' ? col.key : null
                              )
                            }
                            title={
                              prerequisiteCheck.isReady
                                ? 'Klik untuk menambah jadwal pada slot ini'
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
            ))}
          </tbody>
        </table>
      </div>

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
              label: `${t.name} ${t.fet_staff_id ? `[FET: ${t.fet_staff_id}]` : ''}`,
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
        }}
        onConfirm={handlePasswordConfirm}
        title={
          pendingAction?.type === 'delete'
            ? 'Konfirmasi Penghapusan Jadwal'
            : 'Konfirmasi Penyimpanan Jadwal'
        }
        description={
          pendingAction?.type === 'delete'
            ? 'Tindakan ini akan menghapus jadwal KBM secara permanen. Jadwal yang telah memiliki jurnal KBM tidak dapat dihapus. Masukkan kata sandi akun Waka untuk konfirmasi.'
            : 'Perubahan jadwal memengaruhi jadwal KBM aktif sekolah. Masukkan kata sandi akun Waka untuk verifikasi otoritas.'
        }
        loading={passwordModalLoading}
        error={passwordModalError}
      />
    </div>
  );
}
