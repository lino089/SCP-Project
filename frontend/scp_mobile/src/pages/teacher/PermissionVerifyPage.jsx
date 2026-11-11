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
  Users,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import leaveApi from '../../services/leaveApi';
import { Button, Modal, DataTable, PaginationBar } from '../../components/shared';
import { SkeletonCard, EmptyState, ErrorState, ForbiddenState } from '../../components/feedback';
import { getStorageUrl, formatDateIndo } from '../../utils/formatters';

export default function PermissionVerifyPage() {
  const navigate = useNavigate();
  const { isKesiswaan, isWaliKelas } = useAuth();

  // Wewenang verifikasi (Khusus Tim Kesiswaan, Waka dilarang)
  const canVerify = useMemo(() => {
    return isKesiswaan?.();
  }, [isKesiswaan]);

  const isAuthorized = useMemo(() => {
    return canVerify || isWaliKelas?.();
  }, [canVerify, isWaliKelas]);

  // Main Category Tab: 'students' | 'teachers'
  const [activeCategory, setActiveCategory] = useState('students');

  // Pagination tabel
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Kembali ke halaman 1 saat filter berubah (dipasang sebelum early-return agar urutan hook stabil)
  useEffect(() => {
    setPage(1);
  }, [statusFilter, activeCategory, perPage]);

  // Status Filter: 'pending' | 'approved' | 'rejected'
  const [statusFilter, setStatusFilter] = useState('pending');

  // Data states
  const [studentLeaves, setStudentLeaves] = useState([]);
  const [teacherLeaves, setTeacherLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Action states
  const [processingId, setProcessingId] = useState(null);
  const [previewDocUrl, setPreviewDocUrl] = useState(null);
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success');

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchItems = useCallback(async () => {
    if (!isAuthorized) return;
    try {
      if (activeCategory === 'students') {
        const res = await leaveApi.getLeaveRequests({ status: statusFilter });
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setStudentLeaves(list);
      } else if (activeCategory === 'teachers' && canVerify) {
        const res = await leaveApi.getTeacherLeaveRequests({ status: statusFilter });
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setTeacherLeaves(list);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message || 'Gagal memuat data perizinan.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, activeCategory, statusFilter, canVerify]);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      if (!isAuthorized) {
        if (isMounted) setIsLoading(false);
        return;
      }
      try {
        if (activeCategory === 'students') {
          const res = await leaveApi.getLeaveRequests({ status: statusFilter });
          const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
          if (isMounted) setStudentLeaves(list);
        } else if (activeCategory === 'teachers' && canVerify) {
          const res = await leaveApi.getTeacherLeaveRequests({ status: statusFilter });
          const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
          if (isMounted) setTeacherLeaves(list);
        }
        if (isMounted) setLoadError(null);
      } catch (err) {
        if (isMounted) setLoadError(err.message || 'Gagal memuat data perizinan.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [isAuthorized, activeCategory, statusFilter, canVerify]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchItems();
  };

  // Approve student leave
  const handleApproveStudent = async (id) => {
    setProcessingId(id);
    try {
      await leaveApi.updateLeaveRequest(id, { status_approval: 'approved' });
      showToast('Izin siswa berhasil disetujui.');
      fetchItems();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Gagal menyetujui izin.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Reject student leave
  const handleRejectStudent = async () => {
    if (!rejectModalItem) return;
    setProcessingId(rejectModalItem.id);
    try {
      await leaveApi.updateLeaveRequest(rejectModalItem.id, {
        status_approval: 'rejected',
        notes: rejectReason.trim(),
      });
      showToast('Izin siswa telah ditolak.');
      setRejectModalItem(null);
      setRejectReason('');
      fetchItems();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Gagal menolak izin.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Approve teacher leave (Kesiswaan / Waka)
  const handleApproveTeacher = async (id) => {
    setProcessingId(id);
    try {
      await leaveApi.approveTeacherLeaveRequest(id);
      showToast('Izin mengajar guru berhasil disetujui.');
      fetchItems();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Gagal menyetujui izin.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Reject teacher leave
  const handleRejectTeacher = async (id) => {
    if (!window.confirm('Tolak permohonan izin mengajar guru ini?')) return;
    setProcessingId(id);
    try {
      await leaveApi.rejectTeacherLeaveRequest(id);
      showToast('Izin mengajar guru telah ditolak.');
      fetchItems();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Gagal menolak izin.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="space-y-4">
        <ForbiddenState
          message="Halaman ini hanya dapat diakses oleh Wali Kelas atau Tim Kesiswaan."
          onBack={() => navigate('/teacher/dashboard')}
        />
      </div>
    );
  }

  const currentList = activeCategory === 'students' ? studentLeaves : teacherLeaves;

  const totalItems = currentList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedList = currentList.slice((safePage - 1) * perPage, safePage * perPage);


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
          <h1 className="text-sm font-bold text-[var(--color-text-primary)]">Verifikasi Perizinan</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {canVerify
              ? 'Persetujuan dispensasi kehadiran siswa & guru'
              : 'Monitoring perizinan siswa kelas binaan'}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          className="p-1.5 h-8 w-8 min-h-0"
          aria-label="Segarkan"
        >
          <RotateCw size={14} />
        </Button>
      </div>

      {/* Top Category Tabs (Siswa vs Guru) */}
      {canVerify && (
        <div className="flex bg-[var(--color-surface-subtle)] p-1 rounded-[16px]">
          <button
            type="button"
            onClick={() => setActiveCategory('students')}
            className={`flex-1 py-1.5 rounded-[14px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeCategory === 'students'
                ? 'bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Users size={14} />
            <span>Izin Siswa</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('teachers')}
            className={`flex-1 py-1.5 rounded-[14px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeCategory === 'teachers'
                ? 'bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Briefcase size={14} />
            <span>Izin Guru</span>
          </button>
        </div>
      )}

      {/* Status Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'pending', label: 'Menunggu' },
          { id: 'approved', label: 'Disetujui' },
          { id: 'rejected', label: 'Ditolak' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`chip ${statusFilter === tab.id ? 'chip--active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Daftar permohonan — tabel + pagination */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="section-label">Daftar Permohonan ({totalItems})</span>
        </div>

        {loadError ? (
          <ErrorState message={loadError} onRetry={handleRefresh} />
        ) : (
          <DataTable
            columns={[
              { key: 'no', label: '#', width: 30, align: 'center' },
              { key: 'name', label: 'Pemohon / Izin' },
              { key: 'actions', label: 'Aksi', width: 96, align: 'right' },
            ]}
            rows={pagedList}
            isLoading={isLoading}
            skeletonRows={Math.min(perPage, 8)}
            ariaLabel="Daftar permohonan izin"
            empty={
              <EmptyState
                title="Tidak Ada Data"
                message={`Tidak ada perizinan berstatus ${statusFilter} saat ini.`}
              />
            }
            renderRow={(item, index) => {
              const isStudent = activeCategory === 'students';
              const name = isStudent ? item.student?.name || 'Siswa' : item.teacher?.name || 'Guru';
              const roleInfo = isStudent
                ? item.student?.school_class?.name || 'Rombel'
                : item.teacher?.nis_nip || 'Guru Pengampu';
              const docUrl = item.document_url || item.document_path || item.attachment_url;
              const isActionable = canVerify && statusFilter === 'pending';
              const isBusy = processingId === item.id;

              return (
                <tr key={item.id}>
                  <td className="data-table__no">
                    {String((page - 1) * perPage + index + 1).padStart(2, '0')}
                  </td>
                  <td>
                    <span className="data-table__cell-title">{name}</span>
                    <span className="data-table__cell-meta">
                      {roleInfo} · {item.type || 'Izin'} ·{' '}
                      {formatDateIndo(item.date || item.start_date)}
                    </span>
                    <span className="data-table__cell-sub">
                      {item.reason || item.description || '-'}
                    </span>
                  </td>
                  <td>
                    <div className="data-table__actions">
                      {docUrl && (
                        <button
                          type="button"
                          className="data-table__action"
                          onClick={() => setPreviewDocUrl(getStorageUrl(docUrl))}
                          aria-label="Lihat bukti"
                        >
                          <Eye size={13} />
                        </button>
                      )}
                      {isActionable && (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              isStudent ? setRejectModalItem(item) : handleRejectTeacher(item.id)
                            }
                            className="data-table__action data-table__action--danger"
                            aria-label="Tolak"
                          >
                            <X size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              isStudent
                                ? handleApproveStudent(item.id)
                                : handleApproveTeacher(item.id)
                            }
                            className="data-table__action"
                            style={{
                              backgroundColor: 'var(--color-success-bg)',
                              borderColor: 'var(--color-success-border)',
                              color: 'var(--color-success-fg)',
                            }}
                            aria-label="Setujui"
                          >
                            <Check size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }}
            footer={
              <PaginationBar
                currentPage={safePage}
                totalPages={totalPages}
                totalItems={totalItems}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
                disabled={isLoading}
              />
            }
          />
        )}
      </div>

      {/* Modal Pratinjau Dokumen */}
      <Modal
        isOpen={Boolean(previewDocUrl)}
        onClose={() => setPreviewDocUrl(null)}
        title="Pratinjau Dokumen Bukti"
      >
        <div className="space-y-3">
          <div className="rounded-[14px] overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-text-primary)] flex items-center justify-center max-h-[70vh]">
            {previewDocUrl && (
              <img
                src={previewDocUrl}
                alt="Bukti Izin"
                className="max-h-[65vh] w-auto object-contain"
              />
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPreviewDocUrl(null)}
            className="w-full"
          >
            Tutup
          </Button>
        </div>
      </Modal>

      {/* Modal Tolak Izin dengan Catatan */}
      <Modal
        isOpen={Boolean(rejectModalItem)}
        onClose={() => setRejectModalItem(null)}
        title="Alasan Penolakan Izin"
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Berikan alasan penolakan untuk disampaikan kepada pemohon:
          </p>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Contoh: Bukti surat tidak valid atau tidak terbaca..."
            className="w-full text-xs p-2.5 field-area focus:outline-hidden focus:border-[var(--color-brand)]"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRejectModalItem(null)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleRejectStudent}
              className="flex-1 font-bold"
            >
              Konfirmasi Tolak
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
