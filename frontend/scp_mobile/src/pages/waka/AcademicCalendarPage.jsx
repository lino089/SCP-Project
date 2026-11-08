import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import academicEventApi from '../../services/academicEventApi';
import {
  Button,
  Badge,
  Modal,
  Input,
  PasswordSheet,
} from '../../components/shared';
import MobileCalendarView from '../../components/calendar/MobileCalendarView';
import { SkeletonCard, ErrorState } from '../../components/feedback';
import { formatDateIndo } from '../../utils/formatters';
import { unwrapList } from '../../utils/responseHelper';
import { todayLocalISO } from '../../utils/dateUtils';

const EVENT_TYPES = [
  { value: 'holiday', label: 'Hari Libur Resmi', defaultDisable: true, badge: 'danger' },
  { value: 'school_event', label: 'Kegiatan Sekolah', defaultDisable: false, badge: 'info' },
  { value: 'class_event', label: 'Kegiatan Khusus Rombel', defaultDisable: true, badge: 'warning' },
  { value: 'exam', label: 'Masa Ujian / Asesmen', defaultDisable: true, badge: 'purple' },
];

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function AcademicCalendarPage() {
  const todayIso = useMemo(() => todayLocalISO(), []);
  const todayParts = useMemo(() => {
    const [y, m] = todayIso.split('-').map(Number);
    return { year: y || new Date().getFullYear(), month: m || (new Date().getMonth() + 1) };
  }, [todayIso]);

  const [currentYear, setCurrentYear] = useState(todayParts.year);
  const [currentMonth, setCurrentMonth] = useState(todayParts.month);
  const [selectedDate, setSelectedDate] = useState(() => todayIso);

  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Toast
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success');

  // Modal State Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('holiday');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formScopeType, setFormScopeType] = useState('all');
  const [formGrades, setFormGrades] = useState(['10']);
  const [formClassIds, setFormClassIds] = useState([]);
  const [formDisablesTeaching, setFormDisablesTeaching] = useState(true);

  // Password confirmation for destructive / high-impact actions
  const [isPasswordSheetOpen, setIsPasswordSheetOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchEvents = useCallback(async (signal) => {
    try {
      const res = await academicEventApi.getAll({
        year: currentYear,
        month: currentMonth,
      }, { signal });
      const list = unwrapList(res);
      setEvents(list);
      setLoadError(null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setLoadError(err.message || 'Gagal memuat agenda kalender akademik.');
    } finally {
      setIsLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    const controller = new AbortController();
    fetchEvents(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchEvents]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchEvents();
  };

  const handlePrevMonth = () => {
    setIsLoading(true);
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setIsLoading(true);
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingEvent(null);
    setFormTitle('');
    setFormDesc('');
    setFormType('holiday');
    setFormStartDate(selectedDate || todayLocalISO());
    setFormEndDate(selectedDate || todayLocalISO());
    setFormScopeType('all');
    setFormGrades(['10']);
    setFormClassIds([]);
    setFormDisablesTeaching(true);
    setFormError('');
    setIsFormOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (ev) => {
    setEditingEvent(ev);
    setFormTitle(ev.title || '');
    setFormDesc(ev.description || '');
    setFormType(ev.type || 'holiday');
    setFormStartDate(ev.start_date || '');
    setFormEndDate(ev.end_date || ev.start_date || '');
    setFormScopeType(ev.scope_type || 'all');
    setFormGrades(Array.isArray(ev.scope_targets) ? ev.scope_targets.map(String) : ['10']);
    setFormClassIds(Array.isArray(ev.scope_targets) ? ev.scope_targets.map(Number) : []);
    setFormDisablesTeaching(Boolean(ev.disables_teaching ?? true));
    setFormError('');
    setIsFormOpen(true);
  };

  const handleTypeChange = (typeVal) => {
    setFormType(typeVal);
    const target = EVENT_TYPES.find((t) => t.value === typeVal);
    if (target) setFormDisablesTeaching(target.defaultDisable);
  };

  // Submit Form
  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Judul agenda wajib diisi.');
      return;
    }
    if (!formStartDate) {
      setFormError('Tanggal mulai wajib ditentukan.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim(),
        type: formType,
        start_date: formStartDate,
        end_date: formEndDate || formStartDate,
        scope_type: formScopeType,
        scope_targets:
          formScopeType === 'grade'
            ? formGrades
            : formScopeType === 'class'
            ? formClassIds
            : [],
        disables_teaching: formDisablesTeaching,
      };

      if (editingEvent) {
        await academicEventApi.update(editingEvent.id, payload);
        showToast('Agenda akademik berhasil diperbarui.');
      } else {
        await academicEventApi.create(payload);
        showToast('Agenda akademik baru berhasil ditambahkan.');
      }
      setIsFormOpen(false);
      handleRefresh();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Gagal menyimpan agenda.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Trigger Delete
  const handleTriggerDelete = (id) => {
    setPendingDeleteId(id);
    setPasswordError('');
    setIsPasswordSheetOpen(true);
  };

  const handlePasswordConfirmDelete = async (_password) => {
    setPasswordLoading(true);
    setPasswordError('');
    try {
      await academicEventApi.delete(pendingDeleteId);
      setIsPasswordSheetOpen(false);
      showToast('Agenda berhasil dihapus.');
      handleRefresh();
    } catch (err) {
      setPasswordError(
        err.response?.data?.message || err.message || 'Kata sandi tidak valid atau agenda gagal dihapus.'
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((ev) => {
      const s = ev.start_date;
      const e = ev.end_date || ev.start_date;
      return selectedDate >= s && selectedDate <= e;
    });
  }, [events, selectedDate]);

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

      {/* Header Month Navigator */}
      <div className="surface-card p-3 shadow-[var(--shadow-card)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePrevMonth}
            className="p-1.5 h-8 w-8 min-h-0"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft size={16} />
          </Button>
          <div>
            <h1 className="text-sm font-bold text-[var(--color-text-primary)]">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </h1>
            <p className="text-[11px] text-[var(--color-text-muted)]">Kalender Akademik Waka</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleNextMonth}
            className="p-1.5 h-8 w-8 min-h-0"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight size={16} />
          </Button>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={handleOpenCreate}
          className="gap-1.5 px-3 py-1.5 text-xs font-semibold"
        >
          <Plus size={14} />
          Tambah Agenda
        </Button>
      </div>

      {/* Calendar View Component */}
      <MobileCalendarView
        year={currentYear}
        month={currentMonth}
        events={events}
        selectedDate={selectedDate}
        onSelectDate={(d) => setSelectedDate(d)}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={() => {
          const now = new Date();
          setCurrentYear(now.getFullYear());
          setCurrentMonth(now.getMonth() + 1);
          setSelectedDate(
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
              now.getDate()
            ).padStart(2, '0')}`
          );
        }}
        isLoading={isLoading}
        userRole="vice_principal"
      />

      {/* Agenda pada Tanggal Terpilih */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="section-label">
            Agenda Tanggal {formatDateIndo(selectedDate)}
          </h2>
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            {selectedDayEvents.length} Agenda
          </span>
        </div>

        {isLoading ? (
          <SkeletonCard count={2} />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={handleRefresh} />
        ) : selectedDayEvents.length === 0 ? (
          <div className="p-4 bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)]/80 rounded-[14px] text-center">
            <p className="text-xs text-[var(--color-text-secondary)]">Tidak ada agenda khusus pada tanggal ini.</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">KBM berjalan sesuai jadwal reguler.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedDayEvents.map((ev) => {
              const typeCfg = EVENT_TYPES.find((t) => t.value === ev.type) || EVENT_TYPES[0];
              return (
                <div
                  key={ev.id}
                  className="surface-card p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={typeCfg.badge} size="sm">
                          {typeCfg.label}
                        </Badge>
                        {ev.disables_teaching && (
                          <Badge variant="danger" size="sm">
                            KBM Ditiadakan
                          </Badge>
                        )}
                        <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                          {ev.start_date === ev.end_date || !ev.end_date
                            ? ev.start_date
                            : `${ev.start_date} s/d ${ev.end_date}`}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-[var(--color-text-primary)] mt-1">{ev.title}</h3>
                      {ev.description && (
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                          {ev.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(ev)}
                        className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-[10px] hover:bg-[var(--color-surface-subtle)]"
                        aria-label="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTriggerDelete(ev.id)}
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

      {/* Modal Tambah / Edit Agenda */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingEvent ? 'Ubah Agenda Akademik' : 'Tambah Agenda Akademik'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-3">
          {formError && (
            <div className="p-2.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)] text-xs rounded-[14px]">
              {formError}
            </div>
          )}

          <Input
            label="Judul Agenda"
            placeholder="Contoh: Ujian Tengah Semester Genap"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">
              Kategori Agenda
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTypeChange(t.value)}
                  className={`p-2 text-left rounded-[14px] border text-xs font-medium transition-all ${
                    formType === t.value
                      ? 'border-[var(--color-brand)] bg-yellow-50 text-[var(--color-text-primary)] font-bold'
                      : 'border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              label="Tanggal Mulai"
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
              required
            />
            <Input
              type="date"
              label="Tanggal Selesai"
              value={formEndDate}
              onChange={(e) => setFormEndDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">
              Dampak terhadap Kegiatan KBM
            </label>
            <label className="flex items-center gap-2 p-2.5 surface-card cursor-pointer hover:bg-[var(--color-bg-app)]">
              <input
                type="checkbox"
                checked={formDisablesTeaching}
                onChange={(e) => setFormDisablesTeaching(e.target.checked)}
                className="w-4 h-4 text-[var(--color-brand-text)] rounded-[6px] border-[var(--color-border-strong)] focus:ring-yellow-400"
              />
              <span className="text-xs text-[var(--color-text-primary)]">
                Tandai KBM Ditiadakan (Otomatis membebaskan presensi guru &amp; siswa)
              </span>
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">
              Deskripsi / Keterangan
            </label>
            <textarea
              rows={2}
              className="w-full text-xs p-2.5 field-area focus:outline-hidden focus:border-[var(--color-brand)]"
              placeholder="Catatan tambahan agenda..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
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
              {formSubmitting ? 'Menyimpan...' : editingEvent ? 'Simpan Perubahan' : 'Buat Agenda'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Password Confirmation Sheet */}
      <PasswordSheet
        isOpen={isPasswordSheetOpen}
        onClose={() => setIsPasswordSheetOpen(false)}
        onConfirm={handlePasswordConfirmDelete}
        title="Konfirmasi Hapus Agenda"
        description="Masukkan kata sandi Waka Kurikulum untuk menghapus agenda akademik ini."
        isLoading={passwordLoading}
        errorMessage={passwordError}
      />
    </div>
  );
}
