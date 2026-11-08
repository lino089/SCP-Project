import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Eye,
  RotateCw,
  Download,
  X,
} from 'lucide-react';
import leaveApi from '../../services/leaveApi';
import journalApi from '../../services/journalApi';
import { Badge, Button, Modal, Select, Input } from '../../components/shared';
import { SkeletonCard, EmptyState, ErrorState } from '../../components/feedback';
import { getStorageUrl, formatDateIndo } from '../../utils/formatters';
import { todayLocalISO } from '../../utils/dateUtils';

const REASON_CATEGORIES = [
  { value: 'dinas_luar', label: 'Tugas Dinas Luar / MGMP' },
  { value: 'sakit', label: 'Sakit / Rawat Medis' },
  { value: 'keperluan_pribadi', label: 'Keperluan Keluarga / Pribadi' },
  { value: 'lainnya', label: 'Lainnya' },
];

export default function TeacherLeavePage() {
  // Data states
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const todayStr = useMemo(() => todayLocalISO(), []);
  const [targetDate, setTargetDate] = useState(todayStr);
  const [reasonCategory, setReasonCategory] = useState('dinas_luar');
  const [reasonDetail, setReasonDetail] = useState('');
  const [taskInstruction, setTaskInstruction] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [taskAttachmentFile, setTaskAttachmentFile] = useState(null);

  // Affected schedules on selected date
  const [availableSchedules, setAvailableSchedules] = useState([]);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);

  // Detail Modal
  const [selectedDetail, setSelectedDetail] = useState(null);

  // Toast
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success');

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await leaveApi.getTeacherLeaveRequests({ per_page: 50 });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setLeaves(list);
      setFetchError(null);
    } catch (err) {
      setFetchError(err.message || 'Gagal memuat riwayat izin mengajar.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const res = await leaveApi.getTeacherLeaveRequests({ per_page: 50 });
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        if (isMounted) {
          setLeaves(list);
          setFetchError(null);
        }
      } catch (err) {
        if (isMounted) setFetchError(err.message || 'Gagal memuat riwayat izin mengajar.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchLeaves();
  };

  // Fetch teaching schedules for targetDate
  useEffect(() => {
    if (!isModalOpen || !targetDate) return;
    let isMounted = true;

    async function loadSchedulesForDate() {
      setIsLoadingSchedules(true);
      try {
        const d = new Date(targetDate);
        const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
        const res = await journalApi.getTeacherSchedules({ day: dayOfWeek });
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];

        if (!isMounted) return;
        setAvailableSchedules(list);
        setSelectedScheduleIds(list.map((s) => s.id));
      } catch (err) {
        console.warn('Gagal memuat jadwal untuk tanggal izin:', err);
      } finally {
        if (isMounted) setIsLoadingSchedules(false);
      }
    }

    loadSchedulesForDate();
    return () => {
      isMounted = false;
    };
  }, [isModalOpen, targetDate]);

  // Open Create Form
  const handleOpenCreate = () => {
    setTargetDate(todayStr);
    setReasonCategory('dinas_luar');
    setReasonDetail('');
    setTaskInstruction('');
    setAttachmentFile(null);
    setTaskAttachmentFile(null);
    setSelectedScheduleIds([]);
    setFormError('');
    setIsModalOpen(true);
  };

  // Toggle Schedule selection
  const handleToggleSchedule = (id) => {
    setSelectedScheduleIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  // Submit Leave Request
  const handleSubmitLeave = async (e) => {
    if (e) e.preventDefault();
    if (!targetDate) {
      setFormError('Tanggal izin wajib ditentukan.');
      return;
    }
    if (!reasonDetail.trim()) {
      setFormError('Alasan detail izin wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const fullReason = `${reasonCategory}: ${reasonDetail.trim()}`;
      await leaveApi.submitTeacherLeaveRequest({
        date: targetDate,
        reason: fullReason,
        schedule_ids: selectedScheduleIds,
        attachment: attachmentFile,
        task_instruction: taskInstruction.trim(),
        task_attachment: taskAttachmentFile,
      });

      showToast('Permohonan izin mengajar berhasil diajukan.');
      setIsModalOpen(false);
      handleRefresh();
    } catch (err) {
      setFormError(
        err.response?.data?.message || err.message || 'Gagal mengajukan izin mengajar.'
      );
    } finally {
      setIsSubmitting(false);
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

      {/* Header Info */}
      <div className="surface-card p-3.5 shadow-[var(--shadow-card)] flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-[var(--color-text-primary)]">Izin Mengajar Guru</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Pengajuan dispensasi KBM &amp; titipan tugas siswa
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={handleOpenCreate}
          className="gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--color-warning-bg)] text-[var(--color-text-primary)]"
        >
          <Plus size={14} />
          Ajukan Izin
        </Button>
      </div>

      {/* Leave Requests List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="section-label">
            Riwayat Permohonan Izin ({leaves.length})
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
        ) : fetchError ? (
          <ErrorState message={fetchError} onRetry={handleRefresh} />
        ) : leaves.length === 0 ? (
          <EmptyState
            title="Belum Ada Riwayat Izin"
            message="Anda belum pernah mengajukan permohonan izin mengajar."
          />
        ) : (
          <div className="space-y-2">
            {leaves.map((item) => {
              const status = item.status || 'pending';
              const badgeVariant =
                status === 'approved'
                  ? 'success'
                  : status === 'rejected'
                  ? 'danger'
                  : 'warning';
              const statusLabel =
                status === 'approved'
                  ? 'Disetujui'
                  : status === 'rejected'
                  ? 'Ditolak'
                  : 'Menunggu';

              return (
                <div
                  key={item.id}
                  className="surface-card p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={badgeVariant} size="sm">
                          {statusLabel}
                        </Badge>
                        <span className="text-[11px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface-subtle)] px-1.5 py-0.5 rounded-[6px] font-bold">
                          {formatDateIndo(item.date)}
                        </span>
                      </div>

                      <h3 className="text-xs font-bold text-[var(--color-text-primary)] mt-1 truncate">
                        {item.reason}
                      </h3>

                      {item.task_instruction && (
                        <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-1 mt-0.5">
                          Tugas: "{item.task_instruction}"
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedDetail(item)}
                      className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-[10px] hover:bg-[var(--color-surface-subtle)] shrink-0"
                      aria-label="Lihat Detail"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Ajukan Izin Baru */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Ajukan Izin Mengajar Guru"
      >
        <form onSubmit={handleSubmitLeave} className="space-y-3">
          {formError && (
            <div className="p-2.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)] text-xs rounded-[14px]">
              {formError}
            </div>
          )}

          <Input
            type="date"
            label="Tanggal Izin"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            required
          />

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">
              Pilih Jadwal Mengajar Terdampak
            </label>
            {isLoadingSchedules ? (
              <p className="text-xs text-[var(--color-text-muted)]">Memeriksa jadwal mengajar...</p>
            ) : availableSchedules.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)] italic p-2 bg-[var(--color-bg-app)] rounded-[10px]">
                Tidak ada jadwal mengajar pada tanggal ini.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto p-1 surface-card">
                {availableSchedules.map((s) => {
                  const isChecked = selectedScheduleIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2 p-2 rounded-[10px] border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'border-[var(--color-brand)] bg-yellow-50/50 text-[var(--color-text-primary)] font-semibold'
                          : 'border-[var(--color-border-light)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSchedule(s.id)}
                        className="w-4 h-4 text-[var(--color-brand-text)] rounded-[6px] border-[var(--color-border-strong)] focus:ring-yellow-400"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-bold">{s.school_class?.name}</span> - {s.subject?.name} (Jam Ke-{s.period_number})
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">
              Kategori Alasan
            </label>
            <Select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
            >
              {REASON_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">
              Penjelasan Alasan
            </label>
            <textarea
              rows={2}
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              placeholder="Jelaskan keperluan atau agenda izin secara terperinci..."
              className="w-full text-xs p-2.5 field-area focus:outline-hidden focus:border-[var(--color-brand)]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">
              Unggah Bukti Dokumen (Surat Tugas / Surat Dokter)
            </label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-[10px] file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-surface-subtle)] file:text-[var(--color-text-primary)] hover:file:bg-[var(--color-border-subtle)]"
            />
          </div>

          <div className="pt-2 border-t border-[var(--color-border-light)] space-y-2">
            <h4 className="text-xs font-bold text-[var(--color-text-primary)]">Titipan Tugas Pembelajaran Mandiri</h4>
            <textarea
              rows={2}
              value={taskInstruction}
              onChange={(e) => setTaskInstruction(e.target.value)}
              placeholder="Instruksi pengerjaan tugas bagi siswa saat jam kosong..."
              className="w-full text-xs p-2.5 field-area focus:outline-hidden focus:border-[var(--color-brand)]"
            />
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">
                Berkas Lembar Kerja / Modul Tugas (Opsional)
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setTaskAttachmentFile(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-[10px] file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-surface-subtle)] file:text-[var(--color-text-primary)] hover:file:bg-[var(--color-border-subtle)]"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="flex-1 bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] font-bold"
            >
              {isSubmitting ? 'Mengirim...' : 'Kirim Permohonan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Detail Izin */}
      <Modal
        isOpen={Boolean(selectedDetail)}
        onClose={() => setSelectedDetail(null)}
        title="Detail Izin Mengajar"
      >
        {selectedDetail && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[var(--color-bg-app)] rounded-[14px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)]">Tanggal:</span>
                <span className="font-bold">{formatDateIndo(selectedDetail.date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)]">Status:</span>
                <Badge
                  variant={
                    selectedDetail.status === 'approved'
                      ? 'success'
                      : selectedDetail.status === 'rejected'
                      ? 'danger'
                      : 'warning'
                  }
                  size="sm"
                >
                  {selectedDetail.status}
                </Badge>
              </div>
            </div>

            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">Alasan:</p>
              <p className="text-[var(--color-text-primary)] mt-0.5">{selectedDetail.reason}</p>
            </div>

            {selectedDetail.task_instruction && (
              <div className="p-2.5 bg-yellow-50/60 border border-yellow-100 rounded-[14px]">
                <p className="font-semibold text-yellow-900">Instruksi Tugas Siswa:</p>
                <p className="text-[var(--color-text-primary)] mt-0.5 leading-relaxed">
                  {selectedDetail.task_instruction}
                </p>
              </div>
            )}

            {selectedDetail.attachment_url && (
              <a
                href={getStorageUrl(selectedDetail.attachment_url)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[var(--color-info-fg)] font-semibold underline"
              >
                <Download size={14} /> Lihat Berkas Bukti Lampiran
              </a>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={() => setSelectedDetail(null)}
              className="w-full mt-2"
            >
              Tutup
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
