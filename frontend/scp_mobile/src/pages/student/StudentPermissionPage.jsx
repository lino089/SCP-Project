import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  FileText,
  Trash2,
  Edit2,
  Eye,
  AlertCircle,
  Send,
  RotateCw,
  Plus,
  ExternalLink,
  Upload,
  CheckCircle2,
} from 'lucide-react';
import { leaveApi } from '../../services/leaveApi';
import academicEventApi from '../../services/academicEventApi';
import { getStorageUrl, getFallbackStorageUrl } from '../../utils/formatters';
import { unwrap } from '../../utils/responseHelper';
import { todayLocalISO } from '../../utils/dateUtils';
import {
  Button,
  Input,
  Select,
  Badge,
  BottomSheetModal,
  Card,
  ConfirmSheet,
} from '../../components/shared';

/**
 * LeaveFormFields — satu sumber markup untuk form pengajuan & edit izin (D-5).
 * Murni presentasional: seluruh state tetap dikelola oleh halaman.
 */
function LeaveFormFields({
  type,
  onTypeChange,
  category,
  onCategoryChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  date,
  onDateChange,
  departureTime,
  onDepartureTimeChange,
  expectedReturnTime,
  onExpectedReturnTimeChange,
  fileInputId,
  uploadTitle,
  uploadHint,
  uploadedFile,
  onFileChange,
}) {
  return (
    <>
      <div className="space-y-1">
        <label className="field-label" htmlFor={`${fileInputId}-type`}>
          Tipe Perizinan
        </label>
        <Select
          id={`${fileInputId}-type`}
          value={type}
          onChange={(e) => onTypeChange(e.target.value)}
        >
          <option value="tidak_masuk">Tidak Masuk Sekolah (Seharian / Berhari-hari)</option>
          <option value="keluar_sekolah">Keluar Sekolah (Dispensasi Waktu Tertentu)</option>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="field-label" htmlFor={`${fileInputId}-category`}>
          Kategori Alasan
        </label>
        <Select
          id={`${fileInputId}-category`}
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="sakit">Sakit (Wajib Surat Dokter/Pemberitahuan)</option>
          <option value="lainnya">Lainnya (Keperluan Keluarga, Lomba, dll)</option>
        </Select>
      </div>

      {type === 'tidak_masuk' ? (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="field-label" htmlFor={`${fileInputId}-start`}>
              Tanggal Mulai
            </label>
            <Input
              id={`${fileInputId}-start`}
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="field-label" htmlFor={`${fileInputId}-end`}>
              Tanggal Selesai
            </label>
            <Input
              id={`${fileInputId}-end`}
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              required
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="space-y-1">
            <label className="field-label" htmlFor={`${fileInputId}-date`}>
              Tanggal Izin
            </label>
            <Input
              id={`${fileInputId}-date`}
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="field-label" htmlFor={`${fileInputId}-depart`}>
                Jam Keluar
              </label>
              <Input
                id={`${fileInputId}-depart`}
                type="time"
                value={departureTime}
                onChange={(e) => onDepartureTimeChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="field-label" htmlFor={`${fileInputId}-return`}>
                Jam Kembali
              </label>
              <Input
                id={`${fileInputId}-return`}
                type="time"
                value={expectedReturnTime}
                onChange={(e) => onExpectedReturnTimeChange(e.target.value)}
                required
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1 pt-1">
        <div className="flex items-center justify-between gap-2">
          <span className="field-label mb-0">{uploadTitle}</span>
          {category === 'sakit' ? (
            <span className="text-[11px] font-semibold text-[var(--color-danger-fg)]">
              *Wajib diunggah
            </span>
          ) : (
            <span className="text-[11px] text-[var(--color-text-muted)]">Opsional</span>
          )}
        </div>

        <div className="flex items-center gap-3 p-3 border border-dashed border-[var(--color-border-strong)] rounded-[10px] bg-[var(--color-surface)]">
          <span className="icon-tile icon-tile--sm">
            <Upload size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-[var(--color-text-primary)] truncate">
              {uploadedFile ? uploadedFile.name : 'Belum ada berkas dipilih'}
            </p>
            <p className="text-[10.5px] text-[var(--color-text-muted)]">{uploadHint}</p>
          </div>
          <input
            type="file"
            id={fileInputId}
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            className="hidden"
          />
          <label htmlFor={fileInputId} className="chip shrink-0 cursor-pointer">
            Pilih
          </label>
        </div>
      </div>
    </>
  );
}

export default function StudentPermissionPage() {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);

  // Form Fields State
  const [type, setType] = useState('tidak_masuk'); // 'tidak_masuk' | 'keluar_sekolah'
  const [category, setCategory] = useState('sakit'); // 'sakit' | 'lainnya'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [date, setDate] = useState(() => todayLocalISO());
  const [departureTime, setDepartureTime] = useState('10:00');
  const [expectedReturnTime, setExpectedReturnTime] = useState('12:00');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [formError, setFormError] = useState('');
  const [dateWarning, setDateWarning] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Doc preview fallback state
  const [docLoadError, setDocLoadError] = useState(false);
  const [docSourceUrl, setDocSourceUrl] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Fetch Leave Requests
  const fetchLeaveRequests = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await leaveApi.getLeaveRequests({ per_page: 50 });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setLeaveRequests(list);
    } catch (err) {
      console.warn('Gagal memuat daftar perizinan:', err);
      setFetchError(err.message || 'Gagal memuat data perizinan dari server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancel = false;
    async function init() {
      try {
        await fetchLeaveRequests();
      } catch {
        if (!cancel) setFetchError('Gagal menghubungkan ke server.');
      }
    }
    init();
    return () => {
      cancel = true;
    };
  }, [fetchLeaveRequests]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchLeaveRequests();
  };

  // Check Calendar Exemption on target date
  useEffect(() => {
    let cancel = false;
    const checkSelectedDate = async () => {
      const targetDate = type === 'tidak_masuk' ? startDate : date;
      if (!targetDate) {
        setDateWarning(null);
        return;
      }
      try {
        const res = await academicEventApi.checkExemption({
          for_my_class: 1,
          date: targetDate,
        });
        if (cancel) return;
        const data = unwrap(res);
        if (data?.disabling_event) {
          const dev = data.disabling_event;
          setDateWarning(
            `Perhatian: Tanggal ${targetDate} bertepatan dengan "${dev.title}" yang meniadakan KBM.`
          );
        } else {
          setDateWarning(null);
        }
      } catch {
        // Abaikan kegagalan cek kalender non-kritis
      }
    };
    checkSelectedDate();
    return () => {
      cancel = true;
    };
  }, [type, startDate, date]);

  // Statistik Izin
  const stats = useMemo(() => {
    return leaveRequests.reduce(
      (acc, item) => {
        acc.total += 1;
        const st = (item.status_approval || item.status || '').toLowerCase();
        if (st === 'pending') acc.pending += 1;
        else if (st === 'approved' || st === 'disetujui') acc.approved += 1;
        else if (st === 'rejected' || st === 'ditolak') acc.rejected += 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, rejected: 0 }
    );
  }, [leaveRequests]);

  const resetForm = () => {
    setType('tidak_masuk');
    setCategory('sakit');
    setStartDate('');
    setEndDate('');
    setDate(todayLocalISO());
    setDepartureTime('10:00');
    setExpectedReturnTime('12:00');
    setUploadedFile(null);
    setFormError('');
    setDateWarning(null);
  };

  // Handle Create Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (type === 'tidak_masuk') {
      if (!startDate || !endDate) {
        setFormError('Tanggal mulai dan selesai wajib diisi.');
        return;
      }
      if (endDate < startDate) {
        setFormError('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
        return;
      }
    } else {
      if (!date || !departureTime || !expectedReturnTime) {
        setFormError('Tanggal dan jam keluar/kembali wajib diisi.');
        return;
      }
      if (expectedReturnTime <= departureTime) {
        setFormError('Jam kembali harus lebih akhir dari jam keluar.');
        return;
      }
    }

    if (category === 'sakit' && !uploadedFile) {
      setFormError('Surat keterangan dokter/orang tua wajib diunggah untuk kategori sakit.');
      return;
    }

    if (uploadedFile && uploadedFile.size > 2 * 1024 * 1024) {
      setFormError('Ukuran berkas lampiran melebihi batas maksimal 2 MB.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('category', category);

      if (type === 'tidak_masuk') {
        formData.append('start_date', startDate);
        formData.append('end_date', endDate);
      } else {
        formData.append('date', date);
        formData.append('departure_time', departureTime);
        formData.append('expected_return_time', expectedReturnTime);
      }

      if (uploadedFile) {
        formData.append('document', uploadedFile);
      }

      const res = await leaveApi.createLeaveRequest(formData);
      if (res?.data || res?.success) {
        const newItem = unwrap(res);
        setLeaveRequests((prev) => [newItem, ...prev]);
        setIsCreateModalOpen(false);
        resetForm();
        showToast('Permohonan perizinan berhasil diajukan dan menunggu verifikasi.');
      }
    } catch (err) {
      setFormError(
        err.response?.data?.message || err.message || 'Gagal mengirim permohonan perizinan.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Open Edit
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setType(item.type);
    setCategory(item.category);
    setStartDate(item.start_date || '');
    setEndDate(item.end_date || '');
    setDate(item.start_date || todayLocalISO());
    setDepartureTime(item.departure_time ? item.departure_time.slice(0, 5) : '10:00');
    setExpectedReturnTime(
      item.expected_return_time ? item.expected_return_time.slice(0, 5) : '12:00'
    );
    setUploadedFile(null);
    setFormError('');
    setIsEditModalOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    setFormError('');

    if (type === 'tidak_masuk' && endDate < startDate) {
      setFormError('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('category', category);

      if (type === 'tidak_masuk') {
        formData.append('start_date', startDate);
        formData.append('end_date', endDate);
      } else {
        formData.append('date', date);
        formData.append('departure_time', departureTime);
        formData.append('expected_return_time', expectedReturnTime);
      }

      if (uploadedFile) {
        formData.append('document', uploadedFile);
      }

      const res = await leaveApi.updateLeaveRequest(editingItem.id, formData);
      if (res?.data || res?.success) {
        const updated = unwrap(res);
        setLeaveRequests((prev) =>
          prev.map((r) => (r.id === editingItem.id ? { ...r, ...updated } : r))
        );
        setIsEditModalOpen(false);
        setEditingItem(null);
        resetForm();
        showToast('Permohonan perizinan berhasil diperbarui.');
      }
    } catch (err) {
      setFormError(
        err.response?.data?.message || err.message || 'Gagal memperbarui permohonan izin.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete (Batalkan)
  const handleExecuteDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      await leaveApi.deleteLeaveRequest(deleteConfirmItem.id);
      setLeaveRequests((prev) => prev.filter((r) => r.id !== deleteConfirmItem.id));
      setDeleteConfirmItem(null);
      showToast('Permohonan izin berhasil dibatalkan.');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal membatalkan permohonan izin.');
    }
  };

  // Handle Document Preview
  const handleOpenDocPreview = (item) => {
    setPreviewDoc(item);
    setDocLoadError(false);
    const targetPath = item.document_url || item.document_path;
    setDocSourceUrl(getStorageUrl(targetPath));
  };

  const isImageDoc = useMemo(() => {
    if (!previewDoc?.document_path && !previewDoc?.document_url) return false;
    const path = previewDoc.document_path || previewDoc.document_url;
    const ext = path.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
  }, [previewDoc]);

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="mb-4 p-3.5 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-[14px] flex items-center gap-2.5 text-[var(--color-success-fg)] text-xs shadow-[var(--shadow-card)] animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-[var(--color-success-fg)] shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header & Ajukan Izin CTA */}
      <div className="surface-card p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-[var(--color-text-primary)] text-sm">Perizinan Siswa</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Ajukan surat izin ketidakhadiran atau dispensasi
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              aria-label="Refresh perizinan"
              className="p-2 rounded-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[var(--color-warning-fg)]' : ''}`} />
            </button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              className="font-semibold text-xs flex items-center gap-1 shadow-[var(--shadow-card)]"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajukan Izin
            </Button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-[var(--color-border-light)] text-center">
          <div className="bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)]/80 rounded-[10px] p-2">
            <span className="block text-[11px] text-[var(--color-text-secondary)] font-semibold mb-0.5">Total</span>
            <span className="font-mono text-base font-bold text-[var(--color-text-primary)]">
              {isLoading ? '…' : stats.total}
            </span>
          </div>
          <div className="bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[10px] p-2">
            <span className="block text-[11px] text-[var(--color-warning-fg)] font-semibold mb-0.5">Pending</span>
            <span className="font-mono text-base font-bold text-[var(--color-warning-fg)]">
              {isLoading ? '…' : stats.pending}
            </span>
          </div>
          <div className="bg-[var(--color-success-bg)] border border-[var(--color-success-border)]/80 rounded-[10px] p-2">
            <span className="block text-[11px] text-[var(--color-success-fg)] font-semibold mb-0.5">Disetujui</span>
            <span className="font-mono text-base font-bold text-[var(--color-success-fg)]">
              {isLoading ? '…' : stats.approved}
            </span>
          </div>
          <div className="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)]/80 rounded-[10px] p-2">
            <span className="block text-[11px] text-[var(--color-danger-fg)] font-semibold mb-0.5">Ditolak</span>
            <span className="font-mono text-base font-bold text-[var(--color-danger-fg)]">
              {isLoading ? '…' : stats.rejected}
            </span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {fetchError && (
        <div className="mb-4 p-3.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] flex items-center justify-between gap-3 text-[var(--color-danger-fg)] text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-danger-fg)]" />
            <span>{fetchError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            className="shrink-0 text-[var(--color-danger-fg)] border-[var(--color-danger-border)] hover:bg-[var(--color-danger-bg)]"
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Riwayat Pengajuan Izin List */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider px-0.5">
          Riwayat Pengajuan Perizinan
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-[var(--color-surface-subtle)] rounded-[14px] animate-pulse border border-[var(--color-border-subtle)]/60"
              />
            ))}
          </div>
        ) : leaveRequests.length === 0 ? (
          <Card className="p-8 text-center bg-[var(--color-surface)] border border-dashed border-[var(--color-border-subtle)]">
            <Calendar className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">Belum ada riwayat perizinan</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Klik tombol &ldquo;Ajukan Izin&rdquo; di atas untuk mengajukan izin ketidakhadiran baru.
            </p>
          </Card>
        ) : (
          leaveRequests.map((item) => {
            const statusKey = (item.status_approval || item.status || '').toLowerCase();
            const isPending = statusKey === 'pending';
            const isApproved = statusKey === 'approved' || statusKey === 'disetujui';

            return (
              <div
                key={item.id}
                className="surface-card p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-[var(--color-text-primary)]">
                        {item.type === 'tidak_masuk'
                          ? 'Tidak Masuk Sekolah'
                          : 'Dispensasi Keluar Sekolah'}
                      </span>
                      <Badge
                        variant={item.category === 'sakit' ? 'info' : 'outline'}
                        className="text-[11px] capitalize px-1.5 py-0"
                      >
                        {item.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)] mt-1 font-mono">
                      <Calendar className="w-3 h-3 text-[var(--color-text-muted)]" />
                      <span>
                        {item.type === 'tidak_masuk'
                          ? item.start_date === item.end_date
                            ? item.start_date
                            : `${item.start_date} s/d ${item.end_date}`
                          : item.start_date || item.date}
                      </span>
                      {item.type === 'keluar_sekolah' && item.departure_time && (
                        <>
                          <span>•</span>
                          <Clock className="w-3 h-3 text-[var(--color-text-muted)]" />
                          <span>
                            {item.departure_time?.slice(0, 5)} - {item.expected_return_time?.slice(0, 5)} WIB
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <Badge
                    variant={isApproved ? 'success' : isPending ? 'warning' : 'error'}
                    className="shrink-0 text-[11px]"
                  >
                    {isApproved ? 'Disetujui' : isPending ? 'Menunggu' : 'Ditolak'}
                  </Badge>
                </div>

                {/* Notes or Verification Remarks */}
                {item.notes && (
                  <p className="text-[11px] text-[var(--color-text-secondary)] bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)]/60 rounded-[10px] p-2">
                    <span className="font-semibold text-[var(--color-text-primary)]">Catatan:</span> {item.notes}
                  </p>
                )}

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-light)] text-xs">
                  <div>
                    {(item.document_path || item.document_url) && (
                      <button
                        onClick={() => handleOpenDocPreview(item)}
                        className="text-[11px] font-semibold text-[var(--color-info-fg)] hover:text-[var(--color-info-fg)] flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Lihat Berkas Bukti
                      </button>
                    )}
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(item)}
                        className="text-[11px] px-2 py-1 h-7 border-[var(--color-border-subtle)]"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirmItem(item)}
                        className="text-[11px] px-2 py-1 h-7 text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)]"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Batalkan
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Ajukan Izin Baru */}
      <BottomSheetModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetForm();
        }}
        title="Form Pengajuan Perizinan"
        subtitle="Isi data ketidakhadiran dengan lengkap dan benar"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-3.5 pb-2 text-xs">
          {formError && (
            <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] text-[var(--color-danger-fg)] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-danger-fg)]" />
              <span>{formError}</span>
            </div>
          )}

          {dateWarning && (
            <div className="p-3 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[10px] text-[var(--color-warning-fg)] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-warning-fg)]" />
              <span>{dateWarning}</span>
            </div>
          )}

          <LeaveFormFields
            type={type}
            onTypeChange={setType}
            category={category}
            onCategoryChange={setCategory}
            startDate={startDate}
            onStartDateChange={setStartDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
            date={date}
            onDateChange={setDate}
            departureTime={departureTime}
            onDepartureTimeChange={setDepartureTime}
            expectedReturnTime={expectedReturnTime}
            onExpectedReturnTimeChange={setExpectedReturnTime}
            fileInputId="student-leave-file"
            uploadTitle="Lampiran Dokumen Bukti"
            uploadHint="JPG, PNG, atau PDF · maks. 2 MB"
            uploadedFile={uploadedFile}
            onFileChange={setUploadedFile}
          />

          <div className="flex gap-2 pt-3 border-t border-[var(--color-border-light)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                resetForm();
              }}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="flex-1 font-semibold flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Kirim Izin
            </Button>
          </div>
        </form>
      </BottomSheetModal>

      {/* Modal Edit Izin */}
      <BottomSheetModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
          resetForm();
        }}
        title="Edit Permohonan Izin"
        subtitle="Ubah detail perizinan sebelum disetujui pihak sekolah"
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-3.5 pb-2 text-xs">
          {formError && (
            <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] text-[var(--color-danger-fg)] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-danger-fg)]" />
              <span>{formError}</span>
            </div>
          )}

          <LeaveFormFields
            type={type}
            onTypeChange={setType}
            category={category}
            onCategoryChange={setCategory}
            startDate={startDate}
            onStartDateChange={setStartDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
            date={date}
            onDateChange={setDate}
            departureTime={departureTime}
            onDepartureTimeChange={setDepartureTime}
            expectedReturnTime={expectedReturnTime}
            onExpectedReturnTimeChange={setExpectedReturnTime}
            fileInputId="edit-student-leave-file"
            uploadTitle="Ganti Lampiran Dokumen"
            uploadHint="Kosongkan bila tidak diubah · JPG, PNG, PDF · maks. 2 MB"
            uploadedFile={uploadedFile}
            onFileChange={setUploadedFile}
          />

          <div className="flex gap-2 pt-3 border-t border-[var(--color-border-light)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingItem(null);
                resetForm();
              }}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="flex-1 font-semibold flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </BottomSheetModal>

      {/* Modal Preview Bukti Berkas */}
      <BottomSheetModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title="Dokumen Bukti Perizinan"
        subtitle={`Pengajuan ${previewDoc?.category || ''}`}
        size="lg"
      >
        {previewDoc && (
          <div className="space-y-3 pb-2 text-center">
            {isImageDoc ? (
              <div className="rounded-[10px] overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-text-primary)] flex items-center justify-center min-h-48 max-h-96">
                <img
                  src={docSourceUrl}
                  alt="Dokumen Bukti"
                  className="max-h-96 max-w-full object-contain"
                  onError={() => {
                    if (!docLoadError) {
                      setDocLoadError(true);
                      setDocSourceUrl(
                        getFallbackStorageUrl(
                          previewDoc.document_url || previewDoc.document_path
                        )
                      );
                    }
                  }}
                />
              </div>
            ) : (
              <div className="p-6 bg-[var(--color-bg-app)] surface-card space-y-2">
                <FileText className="w-10 h-10 text-[var(--color-text-muted)] mx-auto" />
                <p className="text-xs font-semibold text-[var(--color-text-primary)]">Dokumen Format PDF</p>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  Dokumen lampiran tersimpan dalam format berkas digital.
                </p>
                <div className="pt-2">
                  <a
                    href={docSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--color-info-fg)] font-semibold hover:underline"
                  >
                    Buka Berkas di Tab Baru
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => setPreviewDoc(null)}
              className="w-full mt-2"
            >
              Tutup Pratinjau
            </Button>
          </div>
        )}
      </BottomSheetModal>

      {/* Dialog Konfirmasi Pembatalan Izin */}
      <ConfirmSheet
        isOpen={Boolean(deleteConfirmItem)}
        onClose={() => setDeleteConfirmItem(null)}
        onConfirm={handleExecuteDelete}
        title="Batalkan Pengajuan Izin?"
        message="Permohonan izin ini akan dihapus permanen beserta dokumen lampiran yang sudah diunggah."
        confirmText="Ya, Batalkan Izin"
        confirmVariant="danger"
      />
    </div>
  );
}
