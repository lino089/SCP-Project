import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  RotateCw,
  X,
} from 'lucide-react';
import {
  Button,
  Badge,
  Modal,
  Input,
  Select,
  PasswordSheet,
  SearchInput,
} from '../../components/shared';
import { scheduleApi, academicSettingApi } from '../../services/scheduleApi';
import { classApi, roomApi, subjectApi, teacherApi } from '../../services/masterDataApi';
import {
  DAYS_LIST,
  DAY_TO_NUMBER,
  NUMBER_TO_DAY,
  resolveSlotTime,
  detectScheduleConflicts,
} from '../../utils/timetableHelper';
import { SkeletonCard, EmptyState, ErrorState } from '../../components/feedback';

export default function ScheduleManagementPage() {
  const [activeCycle, setActiveCycle] = useState(1);
  const [mondayIsUpacara, setMondayIsUpacara] = useState(true);
  const [periodTemplates, setPeriodTemplates] = useState([]);

  const [classList, setClassList] = useState([]);
  const [roomList, setRoomList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [teacherList, setTeacherList] = useState([]);

  // Schedules
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Filters
  const [selectedCycle, setSelectedCycle] = useState(1);
  const [selectedDay, setSelectedDay] = useState('Senin');
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success');

  // Form Modal (Tambah / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    day: 'Senin',
    slot: 1,
    duration: 2,
    class_id: '',
    subject_id: '',
    teacher_id: '',
    room_id: '',
    cycle: 1,
    password: '',
  });

  // Password confirmation for Delete / Reset
  const [isPasswordSheetOpen, setIsPasswordSheetOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    let isMounted = true;
    async function loadMasterData() {
      try {
        const [settingsRes, cRes, rRes, sRes, tRes] = await Promise.allSettled([
          academicSettingApi.getSettings(),
          classApi.getClasses({ per_page: 100 }),
          roomApi.getRooms({ per_page: 100 }),
          subjectApi.getSubjects({ per_page: 100 }),
          teacherApi.getTeachers({ per_page: 100 }),
        ]);

        if (!isMounted) return;

        if (settingsRes.status === 'fulfilled' && settingsRes.value?.data) {
          const s = settingsRes.value.data;
          setActiveCycle(Number(s.cycle_type || s.active_cycle || 1));
          setSelectedCycle(Number(s.cycle_type || s.active_cycle || 1));
          setMondayIsUpacara(Boolean(s.is_upacara ?? s.monday_is_upacara ?? true));
          if (Array.isArray(s.period_templates)) {
            setPeriodTemplates(s.period_templates);
          }
        }

        if (cRes.status === 'fulfilled') {
          const list = Array.isArray(cRes.value) ? cRes.value : cRes.value?.data || [];
          setClassList(Array.isArray(list) ? list : list?.data || []);
        }
        if (rRes.status === 'fulfilled') {
          const list = Array.isArray(rRes.value) ? rRes.value : rRes.value?.data || [];
          setRoomList(Array.isArray(list) ? list : list?.data || []);
        }
        if (sRes.status === 'fulfilled') {
          const list = Array.isArray(sRes.value) ? sRes.value : sRes.value?.data || [];
          setSubjectList(Array.isArray(list) ? list : list?.data || []);
        }
        if (tRes.status === 'fulfilled') {
          const list = Array.isArray(tRes.value) ? tRes.value : tRes.value?.data || [];
          setTeacherList(Array.isArray(list) ? list : list?.data || []);
        }
      } catch (err) {
        console.warn('Gagal memuat master data jadwal:', err);
      }
    }
    loadMasterData();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await scheduleApi.getAll({ cycle_type: selectedCycle });
      const raw = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setSchedules(raw);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message || 'Gagal memuat jadwal pelajaran.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCycle]);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const res = await scheduleApi.getAll({ cycle_type: selectedCycle });
        const raw = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        if (isMounted) {
          setSchedules(raw);
          setLoadError(null);
        }
      } catch (err) {
        if (isMounted) setLoadError(err.message || 'Gagal memuat jadwal pelajaran.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [selectedCycle]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchSchedules();
  };

  // Conflict detection
  const conflicts = useMemo(() => {
    return detectScheduleConflicts(schedules);
  }, [schedules]);

  // Filtered schedules for view
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const dayNum = s.day_of_week;
      const expectedDayNum = DAY_TO_NUMBER[selectedDay];
      if (expectedDayNum && dayNum !== expectedDayNum) return false;

      if (selectedClassId !== 'all' && Number(s.class_id) !== Number(selectedClassId)) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const subjectName = s.subject?.name?.toLowerCase() || '';
        const teacherName = s.teacher?.name?.toLowerCase() || '';
        const className = s.school_class?.name?.toLowerCase() || '';
        const roomName = s.room?.name?.toLowerCase() || '';
        return (
          subjectName.includes(q) ||
          teacherName.includes(q) ||
          className.includes(q) ||
          roomName.includes(q)
        );
      }

      return true;
    });
  }, [schedules, selectedDay, selectedClassId, searchQuery]);

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setFormData({
      day: selectedDay,
      slot: 1,
      duration: 2,
      class_id: classList[0]?.id || '',
      subject_id: subjectList[0]?.id || '',
      teacher_id: teacherList[0]?.id || '',
      room_id: roomList[0]?.id || '',
      cycle: selectedCycle,
      password: '',
    });
    setFormError('');
    setIsFormOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (s) => {
    setEditingSchedule(s);
    setFormData({
      day: NUMBER_TO_DAY[s.day_of_week] || 'Senin',
      slot: s.period_number || 1,
      duration: s.duration_periods || 2,
      class_id: s.class_id || '',
      subject_id: s.subject_id || '',
      teacher_id: s.teacher_id || '',
      room_id: s.room_id || '',
      cycle: s.cycle_type || selectedCycle,
      password: '',
    });
    setFormError('');
    setIsFormOpen(true);
  };

  // Handle Form Submit
  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.password) {
      setFormError('Kata sandi Waka Kurikulum wajib diisi untuk konfirmasi.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    const payload = {
      day_of_week: DAY_TO_NUMBER[formData.day] || 1,
      period_number: Number(formData.slot),
      duration_periods: Number(formData.duration),
      class_id: Number(formData.class_id),
      subject_id: Number(formData.subject_id),
      teacher_id: Number(formData.teacher_id),
      room_id: Number(formData.room_id),
      cycle_type: Number(formData.cycle),
      password: formData.password,
    };

    try {
      if (editingSchedule) {
        await scheduleApi.update(editingSchedule.id, payload);
        showToast('Jadwal pelajaran berhasil diperbarui.');
      } else {
        await scheduleApi.create(payload);
        showToast('Jadwal pelajaran baru berhasil ditambahkan.');
      }
      setIsFormOpen(false);
      handleRefresh();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Gagal menyimpan jadwal.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Trigger Delete
  const handleTriggerDelete = (id) => {
    setPendingAction({ type: 'delete', id });
    setPasswordError('');
    setIsPasswordSheetOpen(true);
  };

  const handlePasswordConfirmAction = async (password) => {
    setPasswordLoading(true);
    setPasswordError('');
    try {
      if (pendingAction?.type === 'delete') {
        await scheduleApi.delete(pendingAction.id, { password });
        showToast('Jadwal pelajaran berhasil dihapus.');
      } else if (pendingAction?.type === 'reset') {
        await scheduleApi.resetSchedules({ password, cycle_type: selectedCycle });
        showToast(`Seluruh jadwal Siklus ${selectedCycle} berhasil direset.`);
      }
      setIsPasswordSheetOpen(false);
      handleRefresh();
    } catch (err) {
      setPasswordError(
        err.response?.data?.message || err.message || 'Kata sandi tidak valid atau jadwal gagal diproses.'
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`p-3 rounded-[14px] text-xs flex items-center justify-between animate-fade-in ${
            toastType === 'success'
              ? 'bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success-fg)]'
              : 'bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)]'
          }`}
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Info & Cycle Toggle */}
      <div className="surface-card p-3.5 shadow-[var(--shadow-card)] flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-[var(--color-text-primary)]">Manajemen Jadwal Pelajaran</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Siklus Aktif Sistem: <span className="font-bold text-[var(--color-brand-text)]">Siklus {activeCycle}</span>
          </p>
        </div>

        <div className="flex bg-[var(--color-surface-subtle)] p-1 rounded-[14px]">
          <button
            type="button"
            onClick={() => setSelectedCycle(1)}
            className={`px-3 py-1 rounded-[10px] text-xs font-bold transition-all ${
              selectedCycle === 1
                ? 'bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Siklus 1
          </button>
          <button
            type="button"
            onClick={() => setSelectedCycle(2)}
            className={`px-3 py-1 rounded-[10px] text-xs font-bold transition-all ${
              selectedCycle === 2
                ? 'bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Siklus 2
          </button>
        </div>
      </div>

      {/* Conflict Alert Banner */}
      {conflicts.length > 0 && (
        <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[14px] flex items-start gap-2.5">
          <AlertTriangle className="text-[var(--color-danger-fg)] shrink-0 mt-0.5" size={16} />
          <div className="text-xs text-[var(--color-danger-fg)]">
            <span className="font-bold">Terdeteksi {conflicts.length} Konflik Jadwal:</span>
            <p className="text-[11px] text-[var(--color-danger-fg)] mt-0.5">
              Terdapat guru atau ruangan yang dijadwalkan pada jam yang bersamaan.
            </p>
          </div>
        </div>
      )}

      {/* Horizontal Day Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {DAYS_LIST.slice(0, 6).map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => setSelectedDay(day)}
            className={`px-3.5 py-1.5 rounded-[14px] text-xs font-bold shrink-0 transition-all ${
              selectedDay === day
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] font-semibold shadow-[var(--shadow-pill)]'
                : 'bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Filter Rombel & Search Input */}
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="text-xs"
        >
          <option value="all">Semua Rombel</option>
          {classList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <SearchInput
          placeholder="Cari guru / mapel..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Add Schedule Button */}
      <Button
        variant="primary"
        onClick={handleOpenCreate}
        className="w-full gap-2 text-xs font-bold py-2.5"
      >
        <Plus size={16} />
        Tambah Slot Jadwal Baru
      </Button>

      {/* Schedule Items List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="section-label">
            Jadwal Hari {selectedDay} ({filteredSchedules.length} Slot)
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            className="p-1 h-7 w-7 min-h-0"
            aria-label="Segarkan"
          >
            <RotateCw size={14} />
          </Button>
        </div>

        {isLoading ? (
          <SkeletonCard count={3} />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={handleRefresh} />
        ) : filteredSchedules.length === 0 ? (
          <EmptyState
            title="Tidak Ada Jadwal"
            message={`Belum ada jadwal yang terdaftar untuk hari ${selectedDay} pada Siklus ${selectedCycle}.`}
          />
        ) : (
          <div className="space-y-2">
            {filteredSchedules.map((s) => {
              const timeSlot = resolveSlotTime(
                s.day_of_week,
                s.period_number,
                s.duration_periods,
                mondayIsUpacara,
                periodTemplates
              );

              return (
                <div
                  key={s.id}
                  className="surface-card p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="warning" size="sm">
                          Jam Ke-{s.period_number} ({s.duration_periods} JP)
                        </Badge>
                        <span className="text-[11px] font-mono text-[var(--color-text-secondary)] font-bold bg-[var(--color-surface-subtle)] px-1.5 py-0.5 rounded-[6px]">
                          {timeSlot.timeText}
                        </span>
                        <Badge variant="neutral" size="sm">
                          {s.school_class?.name || 'Rombel'}
                        </Badge>
                      </div>

                      <h3 className="text-xs font-bold text-[var(--color-text-primary)] mt-1 truncate">
                        {s.subject?.name || 'Mata Pelajaran'}
                      </h3>
                      <p className="text-[11px] text-[var(--color-text-secondary)] truncate mt-0.5">
                        {s.teacher?.name || 'Guru Pengampu'}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        Ruang: <span className="font-semibold text-[var(--color-text-secondary)]">{s.room?.name || '-'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(s)}
                        className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-[10px] hover:bg-[var(--color-surface-subtle)]"
                        aria-label="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTriggerDelete(s.id)}
                        className="p-1.5 text-rose-500 hover:text-[var(--color-danger-fg)] rounded-[10px] hover:bg-[var(--color-danger-bg)]"
                        aria-label="Hapus"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Tambah / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingSchedule ? 'Ubah Slot Jadwal Pelajaran' : 'Tambah Slot Jadwal Pelajaran'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-3">
          {formError && (
            <div className="p-2.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)] text-xs rounded-[14px]">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">Hari</label>
              <Select
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: e.target.value })}
              >
                {DAYS_LIST.slice(0, 6).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">Siklus</label>
              <Select
                value={formData.cycle}
                onChange={(e) => setFormData({ ...formData, cycle: Number(e.target.value) })}
              >
                <option value={1}>Siklus 1</option>
                <option value={2}>Siklus 2</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">Jam Ke (Slot)</label>
              <Input
                type="number"
                min="1"
                max="12"
                value={formData.slot}
                onChange={(e) => setFormData({ ...formData, slot: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">Durasi (JP)</label>
              <Input
                type="number"
                min="1"
                max="5"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">Kelas / Rombel</label>
            <Select
              value={formData.class_id}
              onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
              required
            >
              <option value="">Pilih Rombel...</option>
              {classList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">Mata Pelajaran</label>
            <Select
              value={formData.subject_id}
              onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
              required
            >
              <option value="">Pilih Mapel...</option>
              {subjectList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">Guru Pengampu</label>
            <Select
              value={formData.teacher_id}
              onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
              required
            >
              <option value="">Pilih Guru...</option>
              {teacherList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">Ruangan / Lab</label>
            <Select
              value={formData.room_id}
              onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
              required
            >
              <option value="">Pilih Ruang...</option>
              {roomList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="pt-2 border-t border-[var(--color-border-light)]">
            <Input
              type="password"
              label="Kata Sandi Waka (Konfirmasi)"
              placeholder="Masukkan kata sandi akun Anda..."
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsFormOpen(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={formSubmitting}
              className="flex-1"
            >
              {formSubmitting ? 'Menyimpan...' : editingSchedule ? 'Simpan Perubahan' : 'Buat Jadwal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Password Confirmation Sheet */}
      <PasswordSheet
        isOpen={isPasswordSheetOpen}
        onClose={() => setIsPasswordSheetOpen(false)}
        onConfirm={handlePasswordConfirmAction}
        title={pendingAction?.type === 'reset' ? 'Reset Jadwal Pelajaran' : 'Hapus Slot Jadwal'}
        description="Masukkan kata sandi Waka Kurikulum untuk memverifikasi tindakan ini."
        isLoading={passwordLoading}
        errorMessage={passwordError}
      />
    </div>
  );
}
