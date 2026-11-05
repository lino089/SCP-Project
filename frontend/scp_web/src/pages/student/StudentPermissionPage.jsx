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
  Download,
  RotateCw,
  ExternalLink,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { leaveApi } from '../../services/leaveApi';
import academicEventApi from '../../services/academicEventApi';
import { getStorageUrl, getFallbackStorageUrl } from '../../utils/formatters';
import {
  Button,
  Input,
  Select,
  Badge,
  Modal,
  Table,
  FileUpload,
  StatCard,
} from '../../components/shared';
import './StudentPermission.css';

export default function StudentPermissionPage() {
  const { user } = useAuth();

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isDocLoading, setIsDocLoading] = useState(false);
  const [docLoadError, setDocLoadError] = useState(false);
  const [docSourceUrl, setDocSourceUrl] = useState('');
  const [triedDocFallback, setTriedDocFallback] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const handleOpenDocPreview = (row) => {
    setPreviewDoc(row);
    setDocLoadError(false);
    setIsDocLoading(true);
    setTriedDocFallback(false);
    setDocSourceUrl(getStorageUrl(row.document_url || row.document_path));
  };

  const isImageDoc = useMemo(() => {
    if (!previewDoc?.document_path) return false;
    const ext = previewDoc.document_path.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
  }, [previewDoc]);

  const isPdfDoc = useMemo(() => {
    if (!previewDoc?.document_path) return false;
    const ext = previewDoc.document_path.split('.').pop()?.toLowerCase();
    return ext === 'pdf';
  }, [previewDoc]);

  // Form Fields State
  const [type, setType] = useState('tidak_masuk'); // 'tidak_masuk' | 'keluar_sekolah'
  const [category, setCategory] = useState('sakit'); // 'sakit' | 'lainnya'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [departureTime, setDepartureTime] = useState('10:00');
  const [expectedReturnTime, setExpectedReturnTime] = useState('12:00');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [formError, setFormError] = useState('');
  const [dateWarning, setDateWarning] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deteksi dini apakah tanggal yang dipilih bertepatan dengan libur / KBM ditiadakan
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
        if (res?.data?.data?.disabling_event) {
          const dev = res.data.data.disabling_event;
          setDateWarning(
            `Perhatian: Tanggal ${targetDate} bertepatan dengan agenda "${dev.title}" di mana KBM ditiadakan. Pengajuan izin tidak diperlukan untuk hari tersebut.`
          );
        } else {
          setDateWarning(null);
        }
      } catch {
        if (!cancel) setDateWarning(null);
      }
    };
    checkSelectedDate();
    return () => {
      cancel = true;
    };
  }, [type, startDate, date]);

  // Load Data Perizinan dari Database Riil
  const loadPermissions = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await leaveApi.getLeaveRequests({ per_page: 50 });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setLeaveRequests(list);
    } catch (err) {
      console.warn('Gagal memuat data perizinan:', err);
      setFetchError(err.message || err.response?.data?.message || 'Gagal memuat data riwayat perizinan.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Metrik Ringkasan
  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    leaveRequests.forEach((item) => {
      if (item.status_approval === 'pending') pending += 1;
      else if (item.status_approval === 'approved') approved += 1;
      else if (item.status_approval === 'rejected') rejected += 1;
    });

    return { total: leaveRequests.length, pending, approved, rejected };
  }, [leaveRequests]);

  // Handle Submit Form Pengajuan Izin Baru
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Validasi kondisional (Kategori sakit wajib unggah surat dokter)
    if (category === 'sakit' && !uploadedFile) {
      setFormError('Kategori sakit mewajibkan unggah berkas surat dokter / surat keterangan sakit.');
      return;
    }

    if (type === 'tidak_masuk' && (!startDate || !endDate)) {
      setFormError('Tanggal mulai dan tanggal selesai wajib diisi.');
      return;
    }

    if (type === 'tidak_masuk' && endDate < startDate) {
      setFormError('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }

    if (type === 'keluar_sekolah' && expectedReturnTime <= departureTime) {
      setFormError('Perkiraan jam kembali harus lebih akhir daripada jam keluar.');
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
      if (res.success && res.data) {
        setLeaveRequests((prev) => [res.data, ...prev]);
        setIsCreateModalOpen(false);
        resetForm();
        setToastMessage('Permohonan perizinan berhasil dikirim dan menunggu verifikasi.');
        setTimeout(() => setToastMessage(''), 4000);
      }
    } catch (err) {
      setFormError(err.message || err.response?.data?.message || 'Gagal mengirim permohonan perizinan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Pengajuan (Hanya jika status pending)
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setType(item.type);
    setCategory(item.category);
    setStartDate(item.start_date || '');
    setEndDate(item.end_date || '');
    setDate(item.start_date || new Date().toISOString().split('T')[0]);
    setDepartureTime(item.departure_time || '10:00');
    setExpectedReturnTime(item.expected_return_time || '12:00');
    setUploadedFile(null);
    setFormError('');
    setIsEditModalOpen(true);
  };

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
      if (res.success) {
        setLeaveRequests((prev) =>
          prev.map((r) =>
            r.id === editingItem.id
              ? {
                  ...r,
                  type,
                  category,
                  start_date: type === 'tidak_masuk' ? startDate : date,
                  end_date: type === 'tidak_masuk' ? endDate : date,
                  departure_time: type === 'keluar_sekolah' ? departureTime : null,
                  expected_return_time: type === 'keluar_sekolah' ? expectedReturnTime : null,
                  document_path: uploadedFile ? 'leaves/' + uploadedFile.name : r.document_path,
                }
              : r
          )
        );
        setIsEditModalOpen(false);
        setEditingItem(null);
        resetForm();
        setToastMessage('Permohonan perizinan berhasil diperbarui.');
        setTimeout(() => setToastMessage(''), 4000);
      }
    } catch (err) {
      setFormError(err.message || err.response?.data?.message || 'Gagal memperbarui permohonan perizinan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Batalkan Izin (DELETE jika pending)
  const handleDelete = async (id) => {
    const confirm = window.confirm(
      'Apakah Anda yakin ingin membatalkan permohonan izin ini? Berkas lampiran dan data pengajuan akan dihapus.'
    );
    if (!confirm) return;

    try {
      await leaveApi.deleteLeaveRequest(id);
      setLeaveRequests((prev) => prev.filter((r) => r.id !== id));
      setToastMessage('Permohonan izin berhasil dibatalkan.');
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      alert(err.message || err.response?.data?.message || 'Gagal membatalkan permohonan izin.');
    }
  };

  const resetForm = () => {
    setType('tidak_masuk');
    setCategory('sakit');
    setStartDate('');
    setEndDate('');
    setDate(new Date().toISOString().split('T')[0]);
    setDepartureTime('10:00');
    setExpectedReturnTime('12:00');
    setUploadedFile(null);
    setFormError('');
  };

  // Definisi Kolom Tabel Riwayat Perizinan
  const columns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      width: '60px',
      renderCell: (_row, idx) => (
        <span className="font-mono text-xs text-gray-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Jenis & Kategori',
      renderCell: (row) => (
        <div>
          <div className="font-semibold text-gray-900 text-xs">
            {row.type === 'tidak_masuk' ? 'Tidak Masuk Sekolah' : 'Izin Keluar Sekolah'}
          </div>
          <div className="text-[11px] text-gray-500 capitalize mt-0.5">
            Alasan: {row.category === 'sakit' ? 'Sakit' : 'Keperluan Lain'}
          </div>
        </div>
      ),
    },
    {
      key: 'time',
      label: 'Tanggal & Waktu',
      renderCell: (row) => (
        <div className="text-gray-700 text-xs">
          {row.type === 'tidak_masuk' ? (
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-gray-400" />
              <span className="font-mono text-[11.5px]">
                {row.start_date} s/d {row.end_date}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-gray-400" />
              <span className="font-mono text-[11.5px]">
                {row.start_date || row.date} ({row.departure_time} - {row.expected_return_time})
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'document',
      label: 'Surat Bukti',
      renderCell: (row) =>
        row.document_path ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-[11px] cursor-pointer transition-colors"
            onClick={() => handleOpenDocPreview(row)}
          >
            <Eye size={12} className="text-gray-500" />
            <span>Lihat Lampiran</span>
          </button>
        ) : (
          <span className="text-gray-400 text-[11px] italic">Tanpa surat</span>
        ),
    },
    {
      key: 'status',
      label: 'Status Persetujuan',
      renderCell: (row) => {
        if (row.status_approval === 'approved') {
          return <Badge variant="success" dot>Disetujui Kesiswaan</Badge>;
        }
        if (row.status_approval === 'rejected') {
          return <Badge variant="error" dot>Ditolak</Badge>;
        }
        return <Badge variant="warning" dot>Menunggu Verifikasi</Badge>;
      },
    },
    {
      key: 'actions',
      label: 'Aksi',
      align: 'right',
      renderCell: (row) =>
        row.status_approval === 'pending' ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
              title="Edit Permohonan"
              onClick={() => handleOpenEdit(row)}
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
              title="Batalkan Permohonan"
              onClick={() => handleDelete(row.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-gray-400 font-medium">Telah Diproses</span>
        ),
    },
  ];

  return (
    <div className="student-permission">
      {/* Page Header */}
      <div className="student-permission__header">
        <div className="student-permission__title-group">
          <h1>Pengajuan Perizinan Siswa</h1>
          <p className="student-permission__subtitle">
            Kirim surat permohonan izin tidak masuk sekolah atau dispensasi keluar di jam KBM dengan lampiran resmi.
          </p>
        </div>

        <div>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
          >
            Ajukan Izin Baru
          </Button>
        </div>
      </div>

      {/* Success Toast */}
      {toastMessage && (
        <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-800">
          <span className="status-dot status-dot--success" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Error Alert with Retry */}
      {fetchError && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <Button size="sm" variant="outline" onClick={loadPermissions} className="border-red-300 text-red-700 hover:bg-red-100">
            <RotateCw className="w-3 h-3 mr-1" />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="student-permission__stats">
        <StatCard title="Total Pengajuan" value={stats.total} accentBorder variant="default" statusDot="neutral" />
        <StatCard title="Menunggu Verifikasi" value={stats.pending} accentBorder variant="warning" statusDot="warning" />
        <StatCard title="Izin Disetujui" value={stats.approved} accentBorder variant="success" statusDot="success" />
        <StatCard title="Izin Ditolak" value={stats.rejected} accentBorder variant="danger" statusDot="danger" />
      </div>

      {/* Tabel Riwayat Pengajuan Izin */}
      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Riwayat Permohonan Izin ({user?.name || 'Siswa'})
          </h2>
          <span className="text-[11px] text-gray-500">
            {leaveRequests.length} permohonan terdaftar
          </span>
        </div>

        <Table
          columns={columns}
          data={leaveRequests}
          isLoading={isLoading}
          emptyMessage="Belum ada riwayat perizinan yang diajukan."
        />
      </div>

      {/* MODAL 1: FORM PENGAJUAN IZIN BARU */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Form Pengajuan Perizinan Siswa"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-center gap-2">
              <AlertCircle size={15} className="text-red-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Pemilihan Tipe Izin */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Pilih Jenis Perizinan:
            </label>
            <div className="student-permission__type-grid">
              <button
                type="button"
                className={`student-permission__type-card ${type === 'tidak_masuk' ? 'student-permission__type-card--active' : ''}`}
                onClick={() => setType('tidak_masuk')}
              >
                <div className="student-permission__type-card-radio">
                  {type === 'tidak_masuk' && <div className="student-permission__type-card-dot" />}
                </div>
                <div>
                  <span className="student-permission__type-card-title">Tidak Masuk Sekolah</span>
                  <span className="student-permission__type-card-desc">
                    Izin seharian penuh atau multi-hari karena sakit / ada keperluan resmi.
                  </span>
                </div>
              </button>

              <button
                type="button"
                className={`student-permission__type-card ${type === 'keluar_sekolah' ? 'student-permission__type-card--active' : ''}`}
                onClick={() => setType('keluar_sekolah')}
              >
                <div className="student-permission__type-card-radio">
                  {type === 'keluar_sekolah' && <div className="student-permission__type-card-dot" />}
                </div>
                <div>
                  <span className="student-permission__type-card-title">Dispensasi Keluar Sekolah</span>
                  <span className="student-permission__type-card-desc">
                    Izin meninggalkan sekolah sementara di jam KBM dan kembali lagi.
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Kategori Alasan */}
          <Select
            label="Kategori Alasan Izin"
            options={[
              { value: 'sakit', label: 'Sakit (Wajib Melampirkan Surat Dokter)' },
              { value: 'lainnya', label: 'Keperluan Keluarga / Acara Resmi (Surat Bukti Opsional)' },
            ]}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          {/* Input Tanggal / Jam Sesuai Tipe */}
          {type === 'tidak_masuk' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Tanggal Mulai Izin"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                label="Tanggal Selesai Izin"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Input
                label="Tanggal Izin"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Jam Keluar Sekolah"
                  type="time"
                  required
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                />
                <Input
                  label="Perkiraan Jam Kembali"
                  type="time"
                  required
                  value={expectedReturnTime}
                  onChange={(e) => setExpectedReturnTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {dateWarning && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              <span>{dateWarning}</span>
            </div>
          )}

          {/* Upload Berkas Dokumen */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Lampiran Surat Keterangan / Bukti{' '}
              {category === 'sakit' ? (
                <span className="text-red-500">* (Wajib untuk Sakit)</span>
              ) : (
                <span className="text-gray-400 font-normal">(Opsional)</span>
              )}
            </label>
            <FileUpload
              accept="image/jpeg,image/png,application/pdf"
              maxSizeMB={2}
              file={uploadedFile}
              onChange={setUploadedFile}
              hint="Format PDF, JPG, atau PNG (Maksimal ukuran 2MB)"
            />
          </div>

          {/* Tombol Aksi */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon={Send}
              loading={isSubmitting}
            >
              Kirim Permohonan Izin
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT PERMOHONAN PENDING */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Permohonan Izin (Status: Pending)"
        size="md"
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-center gap-2">
              <AlertCircle size={15} className="text-red-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Select
            label="Kategori Alasan Izin"
            options={[
              { value: 'sakit', label: 'Sakit (Wajib Surat Dokter)' },
              { value: 'lainnya', label: 'Keperluan Keluarga / Acara Resmi' },
            ]}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          {type === 'tidak_masuk' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Tanggal Mulai Izin"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                label="Tanggal Selesai Izin"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Jam Keluar"
                type="time"
                required
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
              />
              <Input
                label="Perkiraan Kembali"
                type="time"
                required
                value={expectedReturnTime}
                onChange={(e) => setExpectedReturnTime(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Ganti Berkas Dokumen (Opsional)
            </label>
            <FileUpload
              accept="image/jpeg,image/png,application/pdf"
              maxSizeMB={2}
              file={uploadedFile}
              onChange={setUploadedFile}
              hint="Unggah berkas baru jika ingin mengganti dokumen sebelumnya"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsEditModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={isSubmitting}
            >
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: PRATINJAU DOKUMEN SURAT */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={() => {
          setPreviewDoc(null);
          setDocLoadError(false);
          setIsDocLoading(false);
          setTriedDocFallback(false);
        }}
        title="Pratinjau Surat Lampiran Perizinan"
        size="lg"
      >
        <div className="student-permission__doc-preview">
          {!previewDoc?.document_path && !previewDoc?.document_url ? (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center bg-gray-50">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3 border border-gray-200">
                <FileText size={24} />
              </div>
              <h4 className="text-sm font-bold text-gray-800">Tidak Ada Dokumen Lampiran</h4>
              <p className="text-xs text-gray-500 max-w-sm mt-1">
                Pengajuan perizinan ini tidak menyertakan berkas surat atau dokumen bukti.
              </p>
            </div>
          ) : isImageDoc ? (
            <div className="student-permission__doc-container">
              {isDocLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 text-white gap-2.5">
                  <RotateCw size={26} className="animate-spin text-[#FFDE00]" />
                  <span className="text-xs text-slate-300 font-medium">
                    Memuat surat lampiran dari Supabase Storage...
                  </span>
                </div>
              )}

              {docLoadError ? (
                <div className="py-12 px-6 flex flex-col items-center justify-center text-center text-slate-200">
                  <div className="w-12 h-12 rounded-full bg-red-950/70 border border-red-700/60 text-red-400 flex items-center justify-center mb-3">
                    <AlertTriangle size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-white">Gambar Surat Gagal Dimuat</h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Berkas surat di Supabase Storage tidak dapat diakses atau terjadi kendala koneksi.
                  </p>
                  <div className="flex items-center gap-2.5 mt-4">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-white border border-slate-600 font-semibold transition cursor-pointer flex items-center gap-1.5"
                      onClick={() => {
                        setDocLoadError(false);
                        setIsDocLoading(true);
                        const separator = docSourceUrl.includes('?') ? '&' : '?';
                        setDocSourceUrl(`${docSourceUrl.split('?')[0]}${separator}_t=${Date.now()}`);
                      }}
                    >
                      <RotateCw size={12} /> Muat Ulang
                    </button>
                    {!triedDocFallback && (
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded bg-[#FFDE00] hover:bg-[#FFE63B] text-xs text-slate-900 font-bold transition cursor-pointer"
                        onClick={() => {
                          setTriedDocFallback(true);
                          setDocLoadError(false);
                          setIsDocLoading(true);
                          setDocSourceUrl(getFallbackStorageUrl(previewDoc?.document_path));
                        }}
                      >
                        Coba Cadangan Server Lokal
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <img
                  src={docSourceUrl}
                  alt="Surat Lampiran Perizinan"
                  className={`student-permission__doc-img transition-opacity duration-300 ${
                    isDocLoading ? 'opacity-0' : 'opacity-100'
                  }`}
                  onLoad={() => setIsDocLoading(false)}
                  onError={() => {
                    setIsDocLoading(false);
                    if (!triedDocFallback) {
                      setTriedDocFallback(true);
                      const fallback = getFallbackStorageUrl(previewDoc?.document_path);
                      if (fallback && fallback !== docSourceUrl) {
                        setIsDocLoading(true);
                        setDocSourceUrl(fallback);
                        return;
                      }
                    }
                    setDocLoadError(true);
                  }}
                />
              )}
            </div>
          ) : isPdfDoc ? (
            /* Tampilan jika Berkas bertipe PDF */
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center bg-gray-50/80">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-3.5 shadow-xs">
                <FileText size={36} />
              </div>
              <Badge variant="info">Dokumen Lampiran PDF</Badge>
              <div className="student-permission__doc-name mt-2 text-xs text-gray-700 max-w-sm truncate font-mono">
                {previewDoc?.document_path?.split('/').pop() || 'dokumen_lampiran.pdf'}
              </div>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Berkas ini berupa dokumen PDF resmi untuk verifikasi Tim Kesiswaan / Piket Sekolah.
              </p>
              {docSourceUrl && (
                <div className="mt-4 flex items-center gap-2">
                  <a
                    href={docSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition"
                  >
                    <ExternalLink size={13} />
                    <span>Buka PDF di Tab Baru</span>
                  </a>
                  <a
                    href={docSourceUrl}
                    download
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded text-xs font-medium transition"
                  >
                    <Download size={13} />
                    <span>Unduh</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            /* Fallback format berkas lainnya */
            <div className="py-10 px-6 flex flex-col items-center justify-center text-center bg-gray-50">
              <FileText size={48} className="student-permission__doc-icon text-gray-400 mb-2" />
              <div className="student-permission__doc-name font-mono text-xs text-gray-700">
                {previewDoc?.document_path?.split('/').pop()}
              </div>
              {docSourceUrl && (
                <div className="mt-3">
                  <a
                    href={docSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-xs font-medium transition"
                  >
                    <Download size={13} />
                    <span>Buka / Unduh Berkas</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Meta Informasi Dokumen */}
          <div className="student-permission__doc-meta">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {previewDoc?.type === 'tidak_masuk' ? 'Tidak Masuk Sekolah' : 'Izin Keluar Sekolah'}
                  <span className="text-gray-400 font-normal mx-1.5">&bull;</span>
                  <span className="capitalize text-gray-700 font-medium">{previewDoc?.category}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Waktu:{' '}
                  <span className="font-mono text-gray-700">
                    {previewDoc?.type === 'tidak_masuk'
                      ? `${previewDoc?.start_date} s/d ${previewDoc?.end_date}`
                      : `${previewDoc?.start_date || previewDoc?.date} (${previewDoc?.departure_time} - ${previewDoc?.expected_return_time})`}
                  </span>
                </div>
              </div>

              {docSourceUrl && isImageDoc && !docLoadError && (
                <a
                  href={docSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 flex items-center gap-1 shrink-0 transition"
                  title="Buka gambar resolusi penuh di tab baru"
                >
                  <ExternalLink size={12} /> Buka Gambar Penuh
                </a>
              )}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-[11px] text-gray-400 font-mono truncate max-w-xs">
                {previewDoc?.document_path || '-'}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPreviewDoc(null)}
              >
                Tutup Pratinjau
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
