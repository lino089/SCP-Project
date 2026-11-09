import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  X,
  FileText,
  Eye,
  Download,
  AlertCircle,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { leaveApi } from '../../services/leaveApi';
import {
  Badge,
  Button,
  Modal,
  Tabs,
  Table,
} from '../../components/shared';
import { getStorageUrl, getFallbackStorageUrl } from '../../utils/formatters';
import ForbiddenState from '../../components/feedback/ForbiddenState';
import './PermissionVerify.css';

export default function PermissionVerifyPage() {
  const navigate = useNavigate();
  const { user, hasRole, isKesiswaan, isWaliKelas } = useAuth();

  // Wewenang verifikasi resmi: Waka Kurikulum atau Guru Kesiswaan
  const canVerify = useMemo(() => {
    return hasRole('waka') || isKesiswaan();
  }, [hasRole, isKesiswaan]);

  // Hak akses halaman: Waka, Kesiswaan, atau Wali Kelas
  const isAuthorized = useMemo(() => {
    return canVerify || isWaliKelas();
  }, [canVerify, isWaliKelas]);

  // State Perizinan Siswa
  const [permissionList, setPermissionList] = useState([]);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isDocLoading, setIsDocLoading] = useState(false);
  const [docLoadError, setDocLoadError] = useState(false);
  const [docSourceUrl, setDocSourceUrl] = useState('');
  const [triedDocFallback, setTriedDocFallback] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(() => isAuthorized);
  const [studentFetchError, setStudentFetchError] = useState(null);

  // Toast Notifikasi & Processing State
  const [toastMessage, setToastMessage] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const handleOpenDocPreview = useCallback((row) => {
    const rawUrl = row?.document_url || row?.document_path || '';
    const initialUrl = getStorageUrl(rawUrl);
    setPreviewDoc(row);
    setDocSourceUrl(initialUrl);
    setDocLoadError(false);
    setTriedDocFallback(false);
    setIsDocLoading(Boolean(initialUrl));
  }, []);

  const handleCloseDocPreview = useCallback(() => {
    setPreviewDoc(null);
    setDocLoadError(false);
    setIsDocLoading(false);
    setTriedDocFallback(false);
  }, []);

  const docPath = previewDoc?.document_url || previewDoc?.document_path || '';
  const isImageDoc = Boolean(docPath && /\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i.test(docPath));
  const isPdfDoc = Boolean(docPath && /\.pdf(\?.*)?$/i.test(docPath));

  // Load Data Perizinan Siswa (auto-scoped backend berdasarkan kelas walas / kesiswaan)
  const fetchStudentLeaves = useCallback(async () => {
    setIsLoadingStudents(true);
    setStudentFetchError(null);
    try {
      const res = await leaveApi.getLeaveRequests({ per_page: 100 });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setPermissionList(list);
    } catch (err) {
      console.warn('Gagal memuat perizinan siswa:', err);
      setStudentFetchError(err.message || 'Gagal memuat antrean perizinan siswa.');
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    fetchStudentLeaves();
  }, [isAuthorized, fetchStudentLeaves]);

  // Filter Data Siswa
  const filteredStudentData = useMemo(() => {
    if (filterStatus === 'all') return permissionList;
    return permissionList.filter((p) => p.status_approval === filterStatus);
  }, [permissionList, filterStatus]);

  const studentCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    permissionList.forEach((p) => {
      if (p.status_approval === 'pending') pending += 1;
      else if (p.status_approval === 'approved') approved += 1;
      else if (p.status_approval === 'rejected') rejected += 1;
    });

    return { all: permissionList.length, pending, approved, rejected };
  }, [permissionList]);

  const studentTabs = [
    { id: 'pending', label: 'Menunggu Persetujuan', count: studentCounts.pending },
    { id: 'all', label: 'Semua Permohonan', count: studentCounts.all },
    { id: 'approved', label: 'Disetujui', count: studentCounts.approved },
    { id: 'rejected', label: 'Ditolak', count: studentCounts.rejected },
  ];

  const handleUpdateStudentStatus = async (id, newStatus) => {
    if (!canVerify) {
      alert('Akses ditolak. Hanya Tim Kesiswaan atau Waka yang berhak memverifikasi izin siswa.');
      return;
    }
    setIsProcessingAction(true);
    try {
      await leaveApi.updateLeaveRequest(id, { status: newStatus });
      setPermissionList((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status_approval: newStatus } : p))
      );
      if (previewDoc?.id === id) {
        handleCloseDocPreview();
      }
      setToastMessage(
        newStatus === 'approved'
          ? 'Permohonan izin siswa berhasil disetujui (Approved).'
          : 'Permohonan izin siswa telah ditolak (Rejected).'
      );
      setTimeout(() => setToastMessage(''), 3500);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal memproses verifikasi izin siswa.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const studentColumns = [
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
      key: 'student',
      label: 'Nama Siswa & Rombel',
      renderCell: (row) => (
        <div>
          <div className="font-semibold text-gray-900 text-xs">
            {row.student?.name || 'Siswa'}
          </div>
          <div className="text-[11px] font-mono text-gray-500 mt-0.5">
            NIS: {row.student?.nis_nip || '-'} &bull; {row.student?.school_class?.name || row.student?.schoolClass?.name || 'Kelas'}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Jenis & Alasan',
      renderCell: (row) => (
        <div>
          <div className="font-medium text-gray-800 text-xs">
            {row.type === 'tidak_masuk' ? 'Tidak Masuk Sekolah' : 'Dispensasi Keluar'}
          </div>
          <div className="text-[11px] text-gray-500 capitalize mt-0.5">
            Kategori: {row.category === 'sakit' ? 'Sakit' : 'Keperluan Lain'}
          </div>
        </div>
      ),
    },
    {
      key: 'time',
      label: 'Rentang Waktu',
      renderCell: (row) => (
        <div className="text-gray-700 text-xs">
          {row.type === 'tidak_masuk' ? (
            <span className="font-mono text-[11.5px]">
              {row.start_date} s/d {row.end_date}
            </span>
          ) : (
            <span className="font-mono text-[11.5px]">
              {row.start_date || row.date} ({row.departure_time} - {row.expected_return_time})
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'document',
      label: 'Dokumen Bukti',
      renderCell: (row) =>
        row.document_path || row.document_url ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-[11px] font-medium cursor-pointer transition-colors"
            onClick={() => handleOpenDocPreview(row)}
          >
            <Eye size={12} strokeWidth={1.5} className="text-gray-500" />
            <span>Lihat Surat</span>
          </button>
        ) : (
          <span className="text-gray-400 text-[11px] italic">Tanpa surat</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      renderCell: (row) => {
        if (row.status_approval === 'approved') return <Badge variant="success" dot>Disetujui</Badge>;
        if (row.status_approval === 'rejected') return <Badge variant="error" dot>Ditolak</Badge>;
        return <Badge variant="warning" dot>Menunggu</Badge>;
      },
    },
    {
      key: 'actions',
      label: 'Aksi Verifikasi',
      align: 'right',
      renderCell: (row) => {
        if (row.status_approval !== 'pending') {
          return <span className="text-[11px] text-gray-400 font-medium">Telah Diproses</span>;
        }

        // Proteksi Otorisasi: Wali Kelas bersifat READ-ONLY
        if (!canVerify) {
          return (
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
              Menunggu Kesiswaan
            </span>
          );
        }

        return (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              className="permission-verify__action-btn-approve"
              title="Setujui permohonan izin ini"
              disabled={isProcessingAction}
              onClick={() => handleUpdateStudentStatus(row.id, 'approved')}
            >
              <Check size={13} />
              <span>Setujui</span>
            </button>
            <button
              type="button"
              className="permission-verify__action-btn-reject"
              title="Tolak permohonan izin ini"
              disabled={isProcessingAction}
              onClick={() => handleUpdateStudentStatus(row.id, 'rejected')}
            >
              <X size={13} />
              <span>Tolak</span>
            </button>
          </div>
        );
      },
    },
  ];

  // Blokir Akses Ilegal (HTTP 403 Forbidden)
  if (!isAuthorized) {
    return (
      <div className="permission-verify">
        <ForbiddenState
          title="Akses Verifikasi Ditolak (403 Forbidden)"
          message="Hanya Guru Kesiswaan (Piket), Waka Kurikulum, atau Wali Kelas yang memiliki wewenang mengakses halaman verifikasi perizinan siswa."
          actionText="Kembali ke Dashboard"
          onAction={() => navigate('/teacher/dashboard')}
        />
      </div>
    );
  }

  return (
    <div className="permission-verify">
      {/* Header Halaman */}
      <div className="permission-verify__header">
        <div className="permission-verify__title-group">
          <h1>Verifikasi &amp; Pemantauan Perizinan Siswa</h1>
          <p className="permission-verify__subtitle">
            {canVerify
              ? 'Validasi permohonan dispensasi keluar dan surat keterangan sakit/izin siswa secara real-time.'
              : 'Pemantauan status perizinan siswa kelas binaan secara real-time (Mode Wali Kelas).'}
          </p>
        </div>

        <div className="permission-verify__header-badges">
          {canVerify ? (
            <Badge variant="warning" dot>
              Wewenang Kesiswaan &amp; Waka
            </Badge>
          ) : (
            <Badge variant="info" dot>
              Wali Kelas (Monitoring)
            </Badge>
          )}
          <Badge variant="neutral">
            Petugas: {user?.name || 'Bapak/Ibu Guru'}
          </Badge>
        </div>
      </div>

      {/* Banner Khusus Wali Kelas */}
      {!canVerify && isWaliKelas() && (
        <div className="mb-5 p-3.5 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2.5 text-xs text-blue-900">
          <AlertCircle size={16} strokeWidth={1.5} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong>Informasi Wewenang Wali Kelas:</strong> Anda memiliki akses pemantauan terhadap perizinan siswa di rombel binaan Anda. Persetujuan atau penolakan resmi permohonan dispensasi diproses oleh Tim Kesiswaan / Guru Piket.
          </div>
        </div>
      )}

      {/* Toast Notifikasi */}
      {toastMessage && (
        <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-800 animate-fade-in">
          <span className="status-dot status-dot--success" />
          <span>{toastMessage}</span>
        </div>
      )}

      {studentFetchError && (
        <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{studentFetchError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchStudentLeaves}
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            <RotateCw className="w-3 h-3 mr-1" />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Sub-Tabs Filter Status Siswa */}
      <div className="mb-5">
        <Tabs
          tabs={studentTabs}
          activeTab={filterStatus}
          onChange={setFilterStatus}
        />
      </div>

      {/* Tabel Perizinan Siswa */}
      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Daftar Permohonan Siswa ({filteredStudentData.length} Data)
          </h2>
          <span className="text-[11px] text-gray-500">
            {studentCounts.pending} permohonan butuh persetujuan
          </span>
        </div>

        <Table
          columns={studentColumns}
          data={filteredStudentData}
          isLoading={isLoadingStudents}
          emptyMessage="Tidak ada data perizinan siswa pada kategori status ini."
        />
      </div>

      {/* MODAL PRATINJAU DOKUMEN SURAT SISWA */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={handleCloseDocPreview}
        title={`Pratinjau Surat: ${previewDoc?.student?.name || 'Siswa'} (${previewDoc?.student?.school_class?.name || previewDoc?.student?.schoolClass?.name || 'Kelas'})`}
        size="lg"
      >
        <div className="permission-verify__modal-body">
          <div className="permission-verify__modal-meta">
            <div>
              <span className="text-gray-400 block text-[11px]">Jenis Perizinan:</span>
              <span className="font-semibold text-gray-800 text-xs">
                {previewDoc?.type === 'tidak_masuk' ? 'Tidak Masuk Sekolah' : 'Dispensasi Keluar Kampus'}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Kategori &amp; Keterangan:</span>
              <span className="font-semibold text-gray-800 text-xs capitalize">
                {previewDoc?.category || '-'} ({previewDoc?.notes || 'Tidak ada catatan tambahan'})
              </span>
            </div>
          </div>

          <div className="permission-verify__doc-container">
            {docLoadError ? (
              <div className="p-6 text-center text-xs text-gray-500">
                <AlertCircle size={28} className="mx-auto text-amber-500 mb-2" />
                <p className="font-medium text-gray-700">Berkas surat tidak dapat dimuat langsung.</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <a
                    href={docSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800"
                  >
                    <Download size={13} />
                    <span>Unduh Dokumen Asli</span>
                  </a>
                </div>
              </div>
            ) : isImageDoc ? (
              <div className="flex flex-col items-center justify-center p-2">
                <img
                  src={docSourceUrl}
                  alt="Surat Bukti Izin"
                  className="max-h-[500px] w-auto object-contain rounded border border-gray-200"
                  onLoad={() => setIsDocLoading(false)}
                  onError={() => {
                    if (!triedDocFallback) {
                      setTriedDocFallback(true);
                      setDocSourceUrl(getFallbackStorageUrl(docPath));
                    } else {
                      setIsDocLoading(false);
                      setDocLoadError(true);
                    }
                  }}
                />
              </div>
            ) : isPdfDoc ? (
              <iframe
                src={docSourceUrl}
                title="Pratinjau PDF"
                className="w-full h-[500px] border-none rounded"
                onLoad={() => setIsDocLoading(false)}
                onError={() => setDocLoadError(true)}
              />
            ) : (
              <div className="p-8 text-center text-xs text-gray-500">
                <FileText size={32} className="mx-auto text-gray-400 mb-2" />
                <p>Dokumen berformat file eksternal.</p>
                <a
                  href={docSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700"
                >
                  <ExternalLink size={13} />
                  <span>Buka di Tab Baru</span>
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <Button variant="secondary" size="sm" onClick={handleCloseDocPreview}>
              Tutup
            </Button>

            {canVerify && previewDoc?.status_approval === 'pending' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isProcessingAction}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => handleUpdateStudentStatus(previewDoc.id, 'rejected')}
                >
                  <X size={13} className="mr-1" /> Tolak Permohonan
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isProcessingAction}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                  onClick={() => handleUpdateStudentStatus(previewDoc.id, 'approved')}
                >
                  <Check size={13} className="mr-1" /> Setujui Izin
                </Button>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
