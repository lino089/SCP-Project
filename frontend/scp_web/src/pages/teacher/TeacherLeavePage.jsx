import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Plus,
  Download,
  Eye,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { leaveApi } from '../../services/leaveApi';
import { journalApi } from '../../services/journalApi';
import { getStorageUrl, formatDate } from '../../utils/formatters';
import { unwrapList } from '../../utils/responseHelper';
import { todayLocalISO } from '../../utils/dateUtils';
import { Badge, Button, Modal, Select, Table, SearchInput } from '../../components/shared';
import { EmptyState, ErrorState } from '../../components/feedback';
import './TeacherLeave.css';

export default function TeacherLeavePage() {
  const { user } = useAuth();

  // State Data Izin Guru
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // State Filter & Search
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');

  // State Modal Pengajuan Izin Baru
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [successToast, setSuccessToast] = useState('');

  // Form Fields
  const todayStr = useMemo(() => todayLocalISO(), []);
  const [targetDate, setTargetDate] = useState(todayStr);
  const [reasonCategory, setReasonCategory] = useState('dinas_luar');
  const [reasonDetail, setReasonDetail] = useState('');
  const [taskInstruction, setTaskInstruction] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [taskAttachmentFile, setTaskAttachmentFile] = useState(null);

  // Jadwal Mengajar Guru pada tanggal izin terpilih
  const [availableSchedules, setAvailableSchedules] = useState([]);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);

  // State Modal Detail & Pratinjau Dokumen
  const [selectedDetail, setSelectedDetail] = useState(null);

  // Fetch daftar izin guru dari backend (auto-scoped untuk guru yang login)
  const fetchLeaves = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await leaveApi.getTeacherLeaveRequests({ per_page: 50 });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setLeaves(list);
    } catch (err) {
      console.warn('Gagal memuat riwayat izin guru:', err);
      setFetchError(err.message || 'Gagal memuat data riwayat izin mengajar.');
      setLeaves([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  // Ambil jadwal mengajar pada hari targetDate untuk dipilih saat mengajukan izin
  const fetchSchedulesForDate = useCallback(async (dateString) => {
    if (!dateString) return;
    setIsLoadingSchedules(true);
    try {
      const dateObj = new Date(dateString);
      const dayIndex = dateObj.getDay(); // 0: Minggu, 1: Senin, dst.
      if (dayIndex === 0 || dayIndex === 6) {
        setAvailableSchedules([]);
        setSelectedScheduleIds([]);
        return;
      }

      const res = await journalApi.getTeacherSchedules({
        day: dayIndex,
        all: 1,
        per_page: 50,
      });

      const raw = unwrapList(res);

      setAvailableSchedules(raw);
      // Default: pilih semua jadwal di hari tersebut
      setSelectedScheduleIds(raw.map((s) => s.id));
    } catch (err) {
      console.warn('Gagal memuat jadwal untuk tanggal terpilih:', err);
      setAvailableSchedules([]);
      setSelectedScheduleIds([]);
    } finally {
      setIsLoadingSchedules(false);
    }
  }, []);

  // Saat targetDate berubah di form, muat jadwal terkait
  useEffect(() => {
    if (isCreateModalOpen) {
      fetchSchedulesForDate(targetDate);
    }
  }, [isCreateModalOpen, targetDate, fetchSchedulesForDate]);

  // Izin mengajar aktif hari ini
  const todayActiveLeave = useMemo(() => {
    return leaves.find(
      (l) => l.date === todayStr && (l.status === 'pending' || l.status === 'approved')
    );
  }, [leaves, todayStr]);

  // Metrik Statistik
  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    leaves.forEach((item) => {
      if (item.status === 'pending') pending += 1;
      else if (item.status === 'approved') approved += 1;
      else if (item.status === 'rejected') rejected += 1;
    });

    return {
      total: leaves.length,
      pending,
      approved,
      rejected,
    };
  }, [leaves]);

  // Data Terfilter berdasarkan status dan query pencarian
  const filteredLeaves = useMemo(() => {
    return leaves.filter((item) => {
      // 1. Status Filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchReason = item.reason?.toLowerCase().includes(q);
        const matchDate = item.date?.toLowerCase().includes(q);
        const matchTask = item.task_instruction?.toLowerCase().includes(q);
        return matchReason || matchDate || matchTask;
      }
      return true;
    });
  }, [leaves, statusFilter, searchQuery]);

  // Toggle pilihan jadwal pada form
  const toggleScheduleSelection = (id) => {
    setSelectedScheduleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Reset form pengajuan
  const resetForm = () => {
    setTargetDate(todayStr);
    setReasonCategory('dinas_luar');
    setReasonDetail('');
    setTaskInstruction('');
    setAttachmentFile(null);
    setTaskAttachmentFile(null);
    setSelectedScheduleIds([]);
    setFormError('');
    setFieldErrors({});
  };

  // Handle Submit Pengajuan Izin
  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});

    const categoryLabel =
      reasonCategory === 'sakit'
        ? 'Sakit'
        : reasonCategory === 'dinas_luar'
          ? 'Tugas Dinas Luar / Pelatihan'
          : 'Keperluan Mendesak Pribadi';

    const fullReason = reasonDetail.trim()
      ? `${categoryLabel}: ${reasonDetail.trim()}`
      : categoryLabel;

    setIsSubmitting(true);
    try {
      const res = await leaveApi.submitTeacherLeaveRequest({
        date: targetDate,
        reason: fullReason,
        schedule_ids: selectedScheduleIds,
        attachment: attachmentFile,
        task_instruction: taskInstruction.trim() || undefined,
        task_attachment: taskAttachmentFile,
      });

      if (res?.success) {
        setIsCreateModalOpen(false);
        resetForm();
        setSuccessToast('Pengajuan izin mengajar berhasil dikirim ke Kesiswaan / Tim Piket.');
        setTimeout(() => setSuccessToast(''), 5000);
        await fetchLeaves();
      }
    } catch (err) {
      const errorMsg =
        err.message ||
        err.raw?.response?.data?.message ||
        err.response?.data?.message ||
        'Gagal mengajukan izin mengajar.';
      setFormError(errorMsg);
      setFieldErrors(
        err.errors || err.raw?.response?.data?.errors || err.response?.data?.errors || {}
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Definisi Kolom Tabel Riwayat Izin
  const columns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      width: '50px',
      renderCell: (_row, idx) => (
        <span className="font-mono text-xs text-gray-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Tanggal Izin',
      width: '130px',
      renderCell: (row) => (
        <div className="flex items-center gap-1.5">
          <Calendar size={13} className="text-gray-400 shrink-0" />
          <span className="font-mono text-xs font-semibold text-gray-800">
            {formatDate(row.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Alasan & Keterangan',
      renderCell: (row) => (
        <div className="space-y-1">
          <span className="text-xs font-semibold text-gray-900 block">
            {row.reason}
          </span>
          {row.task_instruction && (
            <span className="text-[11px] text-gray-500 line-clamp-1 italic">
              Tugas: {row.task_instruction}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'documents',
      label: 'Dokumen Lampiran',
      width: '180px',
      renderCell: (row) => (
        <div className="flex items-center gap-2">
          {row.attachment_path && (
            <a
              href={getStorageUrl(row.attachment_path)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
              title="Unduh / Buka Surat Izin"
            >
              <Download size={12} />
              <span>Surat</span>
            </a>
          )}
          {row.task_attachment_path && (
            <a
              href={getStorageUrl(row.task_attachment_path)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-800 hover:underline"
              title="Unduh / Buka Modul Tugas Titipan"
            >
              <BookOpen size={12} />
              <span>Bahan/Modul</span>
            </a>
          )}
          {!row.attachment_path && !row.task_attachment_path && (
            <span className="text-[11px] text-gray-400 italic">Tanpa berkas</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '140px',
      renderCell: (row) => {
        if (row.status === 'approved') return <Badge variant="success" dot>Disetujui</Badge>;
        if (row.status === 'rejected') return <Badge variant="error" dot>Ditolak</Badge>;
        return <Badge variant="warning" dot>Menunggu</Badge>;
      },
    },
    {
      key: 'actions',
      label: 'Aksi',
      align: 'right',
      width: '100px',
      renderCell: (row) => (
        <Button
          variant="secondary"
          size="xs"
          onClick={() => setSelectedDetail(row)}
        >
          <Eye size={12} className="mr-1" /> Detail
        </Button>
      ),
    },
  ];

  return (
    <div className="teacher-leave-page">
      {/* 1. Header Halaman */}
      <div className="teacher-leave-header">
        <div>
          <h1 className="teacher-leave-header__title">Pengajuan Izin</h1>
          <p className="teacher-leave-header__subtitle">
            Kelola pengajuan dispensasi berhalangan hadir, titipan materi tugas siswa, serta pantau status verifikasi kesiswaan.
          </p>
        </div>

        <div className="teacher-leave-header__actions">
          <Button
            variant="secondary"
            size="md"
            icon={RefreshCw}
            loading={isLoading}
            onClick={fetchLeaves}
          >
            Segarkan
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
          >
            Ajukan Izin Mengajar
          </Button>
        </div>
      </div>

      {/* 2. Banner Izin Hari Ini (Jika ada) */}
      {todayActiveLeave && (
        <div
          className={`teacher-leave-banner ${
            todayActiveLeave.status === 'approved'
              ? 'teacher-leave-banner--warning'
              : 'teacher-leave-banner--info'
          }`}
        >
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-xs">
              {todayActiveLeave.status === 'approved'
                ? 'Izin Mengajar Hari Ini Telah Disetujui'
                : 'Izin Mengajar Hari Ini Sedang Menunggu Verifikasi Kesiswaan'}
            </div>
            <p className="text-xs mt-0.5 opacity-90">
              {todayActiveLeave.reason}. Sesi mengajar Anda didelegasikan ke guru piket dengan tugas mandiri.
            </p>
          </div>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => setSelectedDetail(todayActiveLeave)}
          >
            Lihat Berkas
          </Button>
        </div>
      )}

      {/* Alert Sukses */}
      {successToast && (
        <div className="teacher-leave-banner teacher-leave-banner--success">
          <CheckCircle2 size={18} className="shrink-0" />
          <span className="text-xs font-medium">{successToast}</span>
        </div>
      )}

      {/* 3. Kartu Statistik Ringkasan */}
      <div className="teacher-leave-metrics">
        <div className="teacher-leave-metric-card">
          <div>
            <div className="teacher-leave-metric-card__title">Total Pengajuan</div>
            <div className="teacher-leave-metric-card__value">{stats.total}</div>
            <div className="teacher-leave-metric-card__desc">Semua permohonan</div>
          </div>
          <div className="teacher-leave-metric-card__icon bg-slate-50 text-slate-600">
            <FileText size={18} />
          </div>
        </div>

        <div className="teacher-leave-metric-card">
          <div>
            <div className="teacher-leave-metric-card__title">Izin Disetujui</div>
            <div className="teacher-leave-metric-card__value text-emerald-600">{stats.approved}</div>
            <div className="teacher-leave-metric-card__desc">Terverifikasi sekolah</div>
          </div>
          <div className="teacher-leave-metric-card__icon bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="teacher-leave-metric-card">
          <div>
            <div className="teacher-leave-metric-card__title">Menunggu Verifikasi</div>
            <div className="teacher-leave-metric-card__value text-amber-600">{stats.pending}</div>
            <div className="teacher-leave-metric-card__desc">Diproses kesiswaan</div>
          </div>
          <div className="teacher-leave-metric-card__icon bg-amber-50 text-amber-600">
            <Clock size={18} />
          </div>
        </div>

        <div className="teacher-leave-metric-card">
          <div>
            <div className="teacher-leave-metric-card__title">Izin Ditolak</div>
            <div className="teacher-leave-metric-card__value text-rose-600">{stats.rejected}</div>
            <div className="teacher-leave-metric-card__desc">Perlu klarifikasi</div>
          </div>
          <div className="teacher-leave-metric-card__icon bg-rose-50 text-rose-600">
            <XCircle size={18} />
          </div>
        </div>
      </div>

      {/* 4. Toolbar Filter & Pencarian */}
      <div className="teacher-leave-filter-bar">
        <div className="teacher-leave-status-tabs">
          <button
            type="button"
            className={`teacher-leave-status-tab ${statusFilter === 'all' ? 'teacher-leave-status-tab--active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Semua ({stats.total})
          </button>
          <button
            type="button"
            className={`teacher-leave-status-tab ${statusFilter === 'pending' ? 'teacher-leave-status-tab--active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Menunggu ({stats.pending})
          </button>
          <button
            type="button"
            className={`teacher-leave-status-tab ${statusFilter === 'approved' ? 'teacher-leave-status-tab--active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            Disetujui ({stats.approved})
          </button>
          <button
            type="button"
            className={`teacher-leave-status-tab ${statusFilter === 'rejected' ? 'teacher-leave-status-tab--active' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            Ditolak ({stats.rejected})
          </button>
        </div>

        <div className="w-full sm:w-72">
          <SearchInput
            placeholder="Cari alasan izin atau tugas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 5. Tabel Riwayat Izin Mengajar */}
      <div className="teacher-leave-table-card">
        {fetchError ? (
          <div className="p-8">
            <ErrorState message={fetchError} onRetry={fetchLeaves} />
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-xs text-gray-500">
            <RefreshCw size={24} className="animate-spin mx-auto text-amber-500 mb-2" />
            Memuat riwayat pengajuan izin mengajar...
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Tidak Ada Riwayat Izin"
              description={
                searchQuery || statusFilter !== 'all'
                  ? 'Tidak ada data izin yang cocok dengan filter atau pencarian Anda.'
                  : 'Anda belum pernah mengajukan izin mengajar.'
              }
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  <Plus size={14} className="mr-1" /> Ajukan Izin Sekarang
                </Button>
              }
            />
          </div>
        ) : (
          <Table columns={columns} data={filteredLeaves} />
        )}
      </div>

      {/* =========================================================================
          6. MODAL PENGAJUAN IZIN MENGAJAR BARU
          ========================================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Ajukan Izin Mengajar & Titipan Tugas KBM"
        size="lg"
      >
        <form onSubmit={handleSubmitLeave} className="teacher-leave-form-grid">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={15} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="teacher-leave-form-label">
                Tanggal Izin *
              </label>
              <input
                type="date"
                className={`w-full p-2.5 text-xs border rounded-lg focus:outline-none focus:ring-1 ${
                  fieldErrors.date
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-gray-300 focus:ring-gray-400'
                }`}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
              />
              {fieldErrors.date && (
                <span className="text-[11px] text-red-600 mt-1 block">
                  {fieldErrors.date[0]}
                </span>
              )}
            </div>

            <div>
              <label className="teacher-leave-form-label">
                Kategori Alasan Izin *
              </label>
              <Select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                options={[
                  { value: 'dinas_luar', label: 'Tugas Dinas Luar / Pelatihan' },
                  { value: 'sakit', label: 'Izin Sakit (Surat Dokter)' },
                  { value: 'pribadi', label: 'Keperluan Mendesak Pribadi' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="teacher-leave-form-label">
              Detail Alasan Izin *
            </label>
            <textarea
              className={`w-full p-2.5 text-xs border rounded-lg focus:outline-none focus:ring-1 ${
                fieldErrors.reason
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-gray-300 focus:ring-gray-400'
              }`}
              rows={3}
              placeholder="Contoh: Mengikuti Bimtek Implementasi Kurikulum Merdeka di Dinas Pendidikan..."
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              required
            />
            {fieldErrors.reason && (
              <span className="text-[11px] text-red-600 mt-1 block">
                {fieldErrors.reason[0]}
              </span>
            )}
          </div>

          <div>
            <label className="teacher-leave-form-label">
              Instruksi Penugasan Siswa untuk Guru Piket (Opsional)
            </label>
            <textarea
              className={`w-full p-2.5 text-xs border rounded-lg focus:outline-none focus:ring-1 ${
                fieldErrors.task_instruction
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-gray-300 focus:ring-gray-400'
              }`}
              rows={3}
              placeholder="Jelaskan modul tugas atau latihan yang harus dikerjakan siswa selama Anda berhalangan hadir..."
              value={taskInstruction}
              onChange={(e) => setTaskInstruction(e.target.value)}
            />
            <div className="teacher-leave-form-hint">
              Instruksi ini akan dibaca oleh Guru Piket untuk mengkondisikan kelas.
            </div>
          </div>

          {/* Pemilihan Jadwal Terdampak */}
          <div>
            <label className="teacher-leave-form-label">
              Jadwal Mengajar yang Terdampak pada Tanggal Ini:
            </label>
            {isLoadingSchedules ? (
              <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                Memeriksa jadwal mengajar Anda...
              </div>
            ) : availableSchedules.length === 0 ? (
              <div className="p-3 text-xs text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                Tidak ada jadwal mengajar tetap yang terdaftar pada hari tersebut. Pengajuan izin akan dicatat sebagai dispensasi institusi umum.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                {availableSchedules.map((sched) => {
                  const isChecked = selectedScheduleIds.includes(sched.id);
                  const className = sched.school_class?.name || sched.schoolClass?.name || sched.class_name || 'Kelas';
                  const subjectName = sched.subject?.name || sched.subjectName || 'Mata Pelajaran';
                  return (
                    <label
                      key={sched.id}
                      className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer transition-colors ${
                        isChecked ? 'bg-amber-50 border border-amber-200 text-amber-900 font-medium' : 'bg-white border border-gray-200 text-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleScheduleSelection(sched.id)}
                        className="rounded text-amber-500 focus:ring-amber-400"
                      />
                      <span className="flex-1 truncate">
                        Jam ke-{sched.period_number || sched.slot} ({sched.duration_periods || sched.duration || 1} JP) — <strong>{subjectName}</strong> di <strong>{className}</strong>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upload Berkas Lampiran */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="teacher-leave-file-card">
              <label className="teacher-leave-form-label">
                Surat Dispensasi / Tugas (PDF/JPG)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setAttachmentFile(e.target.files[0] || null)}
                className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
              />
              <div className="teacher-leave-form-hint">Maksimal 5MB (PDF/Gambar).</div>
            </div>

            <div className="teacher-leave-file-card">
              <label className="teacher-leave-form-label">
                Modul / Bahan Tugas Titipan
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.docx,.zip"
                onChange={(e) => setTaskAttachmentFile(e.target.files[0] || null)}
                className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
              />
              <div className="teacher-leave-form-hint">Maksimal 5MB (PDF/DOCX/Gambar).</div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Kirim Pengajuan Izin
            </Button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          7. MODAL DETAIL & PRATINJAU DOKUMEN IZIN
          ========================================================================= */}
      <Modal
        isOpen={Boolean(selectedDetail)}
        onClose={() => setSelectedDetail(null)}
        title="Detail Pengajuan Izin Mengajar"
        size="lg"
      >
        {selectedDetail && (
          <div className="space-y-4">
            <div className="teacher-leave-preview-grid">
              <div className="teacher-leave-preview-meta">
                <span className="text-gray-500 block mb-0.5">Tanggal Izin:</span>
                <strong>{formatDate(selectedDetail.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>

              <div className="teacher-leave-preview-meta">
                <span className="text-gray-500 block mb-0.5">Status Verifikasi:</span>
                <div>
                  {selectedDetail.status === 'approved' && <Badge variant="success" dot>Disetujui oleh Kesiswaan</Badge>}
                  {selectedDetail.status === 'rejected' && <Badge variant="error" dot>Ditolak</Badge>}
                  {selectedDetail.status === 'pending' && <Badge variant="warning" dot>Menunggu Verifikasi</Badge>}
                </div>
              </div>
            </div>

            <div className="teacher-leave-preview-meta">
              <span className="text-gray-500 block mb-1">Alasan Lengkap:</span>
              <p className="text-gray-900 bg-white p-3 rounded border border-gray-200 text-xs leading-relaxed m-0">
                {selectedDetail.reason}
              </p>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs">
              <span className="font-semibold text-amber-900 block mb-1">
                Instruksi Penugasan untuk Siswa / Guru Piket:
              </span>
              <p className="text-gray-800 bg-white p-2.5 rounded border border-amber-200 whitespace-pre-wrap font-sans m-0">
                {selectedDetail.task_instruction || 'Tidak ada instruksi khusus yang dicantumkan.'}
              </p>
            </div>

            {/* Lampiran File */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText size={18} className="text-blue-600 shrink-0" />
                  <div className="truncate">
                    <div className="text-xs font-semibold text-gray-900">Surat Keterangan</div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {selectedDetail.attachment_path ? 'Berkas tersedia' : 'Tidak dilampirkan'}
                    </div>
                  </div>
                </div>
                {selectedDetail.attachment_path && (
                  <a
                    href={getStorageUrl(selectedDetail.attachment_path)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-white hover:bg-gray-100 text-blue-600 border border-gray-200 rounded text-[11px] font-semibold shrink-0 flex items-center gap-1 shadow-xs"
                  >
                    <ExternalLink size={12} /> Buka
                  </a>
                )}
              </div>

              <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <BookOpen size={18} className="text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <div className="text-xs font-semibold text-gray-900">Bahan / Modul Tugas</div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {selectedDetail.task_attachment_path ? 'Berkas tersedia' : 'Tidak dilampirkan'}
                    </div>
                  </div>
                </div>
                {selectedDetail.task_attachment_path && (
                  <a
                    href={getStorageUrl(selectedDetail.task_attachment_path)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-white hover:bg-gray-100 text-emerald-600 border border-gray-200 rounded text-[11px] font-semibold shrink-0 flex items-center gap-1 shadow-xs"
                  >
                    <ExternalLink size={12} /> Buka
                  </a>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedDetail(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
