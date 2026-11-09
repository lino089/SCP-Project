import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  RefreshCw,
  ExternalLink,
  BookOpen,
  Check,
  X,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { leaveApi } from '../../services/leaveApi';
import { getStorageUrl, formatDate } from '../../utils/formatters';
import { Badge, Button, Modal, Table, SearchInput } from '../../components/shared';
import { EmptyState, ErrorState } from '../../components/feedback';
import ForbiddenState from '../../components/feedback/ForbiddenState';
import './TeacherLeaveApproval.css';

export default function TeacherLeaveApprovalPage() {
  const { user, isKesiswaan } = useAuth();

  // Wewenang Akses Halaman: Khusus Anggota Tim Kesiswaan
  const canAccess = useMemo(() => {
    return isKesiswaan();
  }, [isKesiswaan]);

  // State Data Izin Guru Antrean
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // State Filter & Search
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' | 'all' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // State Modal Detail & Pratinjau Dokumen
  const [selectedDetail, setSelectedDetail] = useState(null);

  // State Modal Aksi Konfirmasi Persetujuan & Penolakan
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: null, // 'approve' | 'reject'
    item: null,
  });
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // Fetch daftar antrean verifikasi izin guru
  const fetchLeaveQueue = useCallback(async () => {
    if (!canAccess) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await leaveApi.getTeacherLeaveRequests({ scope: 'verification', per_page: 100 });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setLeaves(list);
    } catch (err) {
      console.warn('Gagal memuat antrean izin guru:', err);
      setFetchError(err.message || 'Gagal memuat antrean verifikasi izin guru.');
      setLeaves([]);
    } finally {
      setIsLoading(false);
    }
  }, [canAccess]);

  useEffect(() => {
    fetchLeaveQueue();
  }, [fetchLeaveQueue]);

  // Statistik Ringkasan Antrean
  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    leaves.forEach((l) => {
      if (l.status === 'pending') pending += 1;
      else if (l.status === 'approved') approved += 1;
      else if (l.status === 'rejected') rejected += 1;
    });

    return {
      total: leaves.length,
      pending,
      approved,
      rejected,
    };
  }, [leaves]);

  // Eksekusi Persetujuan Permohonan Izin
  const handleConfirmApprove = async () => {
    const item = actionModal.item;
    if (!item) return;

    setIsProcessingAction(true);
    try {
      await leaveApi.approveTeacherLeaveRequest(item.id);
      setSuccessToast(
        `Permohonan izin ${item.teacher?.name || 'guru'} berhasil disetujui. Sesi KBM pengganti telah dibebankan ke Jurnal Mengajar Anda.`
      );
      setActionModal({ isOpen: false, type: null, item: null });
      fetchLeaveQueue();
      setTimeout(() => setSuccessToast(''), 6000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal menyetujui izin mengajar guru.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Eksekusi Penolakan Permohonan Izin
  const handleConfirmReject = async () => {
    const item = actionModal.item;
    if (!item) return;

    setIsProcessingAction(true);
    try {
      await leaveApi.rejectTeacherLeaveRequest(item.id);
      setSuccessToast(`Permohonan izin ${item.teacher?.name || 'guru'} telah ditolak.`);
      setActionModal({ isOpen: false, type: null, item: null });
      fetchLeaveQueue();
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal menolak izin mengajar guru.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Data terfilter berdasarkan Tab Status, Pencarian, & Filter Tanggal
  const filteredLeaves = useMemo(() => {
    return leaves.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      if (dateFilter && item.date !== dateFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const teacherName = (item.teacher?.name || '').toLowerCase();
        const teacherNip = (item.teacher?.nis_nip || '').toLowerCase();
        const reason = (item.reason || '').toLowerCase();
        const instruction = (item.task_instruction || '').toLowerCase();

        return (
          teacherName.includes(query) ||
          teacherNip.includes(query) ||
          reason.includes(query) ||
          instruction.includes(query)
        );
      }

      return true;
    });
  }, [leaves, statusFilter, dateFilter, searchQuery]);

  // Definisi Kolom Tabel Antrean Verifikasi
  const columns = useMemo(
    () => [
      {
        key: 'no',
        label: 'NO',
        align: 'center',
        width: '50px',
        renderCell: (_row, idx) => (
          <span className="font-mono text-xs text-gray-400">
            {String(idx + 1).padStart(2, '0')}
          </span>
        ),
      },
      {
        key: 'teacher',
        label: 'GURU PEMOHON',
        renderCell: (row) => {
          const isSelf = Number(row.teacher_id) === Number(user?.id);
          return (
            <div>
              <div className="font-semibold text-gray-900 text-xs flex items-center gap-1.5">
                <span>{row.teacher?.name || 'Guru Pengampu'}</span>
                {isSelf && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-medium">
                    Anda Sendiri
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-gray-500 mt-0.5">
                NIP: {row.teacher?.nis_nip || '-'}
              </div>
            </div>
          );
        },
      },
      {
        key: 'date',
        label: 'TANGGAL & JADWAL',
        renderCell: (row) => {
          const scheduleCount = Array.isArray(row.schedule_ids) ? row.schedule_ids.length : 0;
          return (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-800 font-medium">
                <Calendar size={13} className="text-gray-400 shrink-0" />
                <span>{formatDate(row.date)}</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {scheduleCount > 0
                  ? `${scheduleCount} Sesi KBM Ditinggalkan`
                  : 'Izin Seharian Penuh'}
              </div>
            </div>
          );
        },
      },
      {
        key: 'reason',
        label: 'ALASAN & SURAT',
        renderCell: (row) => (
          <div>
            <div className="text-xs text-gray-800 line-clamp-1 max-w-xs" title={row.reason}>
              {row.reason}
            </div>
            {row.attachment_path ? (
              <a
                href={getStorageUrl(row.attachment_path)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium mt-0.5"
              >
                <ExternalLink size={11} />
                <span>Lihat Surat Bukti</span>
              </a>
            ) : (
              <span className="text-[11px] text-gray-400 italic">Tanpa lampiran surat</span>
            )}
          </div>
        ),
      },
      {
        key: 'task',
        label: 'TUGAS TITIPAN SISWA',
        renderCell: (row) => (
          <button
            type="button"
            className="teacher-approval__task-chip"
            onClick={() => setSelectedDetail(row)}
            title="Klik untuk meninjau instruksi tugas mandiri siswa"
          >
            <BookOpen size={12} className="text-indigo-600" />
            <span>
              {row.task_instruction ? 'Tinjau Tugas & Berkas' : 'Lihat Detail'}
            </span>
          </button>
        ),
      },
      {
        key: 'status',
        label: 'STATUS',
        renderCell: (row) => {
          if (row.status === 'approved') {
            return (
              <Badge variant="success" dot>
                Disetujui
              </Badge>
            );
          }
          if (row.status === 'rejected') {
            return (
              <Badge variant="error" dot>
                Ditolak
              </Badge>
            );
          }
          return (
            <Badge variant="warning" dot>
              Menunggu
            </Badge>
          );
        },
      },
      {
        key: 'actions',
        label: 'AKSI VERIFIKASI',
        align: 'right',
        renderCell: (row) => {
          const isSelf = Number(row.teacher_id) === Number(user?.id);

          if (row.status !== 'pending') {
            return (
              <div className="text-right">
                <span className="text-[11px] text-gray-500 font-medium block">
                  {row.status === 'approved' ? 'Telah Disetujui' : 'Telah Ditolak'}
                </span>
                {row.approvedBy?.name && (
                  <span className="text-[10px] text-gray-400 block">
                    oleh {row.approvedBy.name}
                  </span>
                )}
              </div>
            );
          }

          // Anti-Self-Approval: Pemohon tidak dapat menyetujui izinnya sendiri
          if (isSelf) {
            return (
              <span className="inline-block text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                Menunggu Rekan Kesiswaan
              </span>
            );
          }

          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                className="teacher-approval__btn-approve"
                title="Setujui izin ini dan ambil alih sebagai guru pengganti (inval)"
                onClick={() => setActionModal({ isOpen: true, type: 'approve', item: row })}
              >
                <Check size={13} />
                <span>Setujui</span>
              </button>
              <button
                type="button"
                className="teacher-approval__btn-reject"
                title="Tolak permohonan izin mengajar ini"
                onClick={() => setActionModal({ isOpen: true, type: 'reject', item: row })}
              >
                <X size={13} />
                <span>Tolak</span>
              </button>
            </div>
          );
        },
      },
    ],
    [user]
  );

  // Blokir jika pengguna bukan anggota Tim Kesiswaan
  if (!canAccess) {
    return (
      <div className="teacher-approval">
        <ForbiddenState
          title="Akses Terbatas Tim Kesiswaan"
          message="Halaman Konfirmasi Izin Guru hanya dapat diakses oleh Guru yang memiliki penugasan aktif sebagai Tim Kesiswaan / BK."
        />
      </div>
    );
  }

  return (
    <div className="teacher-approval">
      {/* 1. Header Halaman */}
      <div className="teacher-approval-header">
        <div>
          <h1 className="teacher-approval-header__title">Konfirmasi Izin Guru</h1>
          <p className="teacher-approval-header__subtitle">
            Verifikasi permohonan izin rekan guru. Menyetujui izin akan otomatis membebankan sesi ke Jurnal KBM Anda sebagai Guru Pengganti (Inval).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchLeaveQueue}
            disabled={isLoading}
          >
            <RefreshCw size={13} className={`mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Segarkan Antrean
          </Button>
        </div>
      </div>

      {/* Banner Notifikasi Keberhasilan */}
      {successToast && (
        <div className="teacher-approval-banner teacher-approval-banner--success">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span className="font-medium text-emerald-900">{successToast}</span>
        </div>
      )}

      {/* Banner Penjelasan Pembebanan Jurnal */}
      <div className="teacher-approval-banner teacher-approval-banner--info">
        <UserCheck size={18} className="shrink-0 text-blue-600" />
        <div>
          <span className="font-semibold block text-blue-900">
            Mekanisme Guru Pengganti Otomatis (Inval):
          </span>
          <span className="text-blue-800 text-xs">
            Saat Anda menyetujui permohonan izin seorang guru, sesi jam mengajar yang ditinggalkan pada hari tersebut akan <strong>langsung dibebankan dan muncul di halaman Jurnal KBM &amp; Presensi Anda</strong>. Anda bertindak sebagai guru pengganti yang mendampingi siswa mengerjakan tugas titipan dan melakukan presensi absensi kelas.
          </span>
        </div>
      </div>

      {/* 2. Kartu Metrik Ringkasan Antrean */}
      <div className="teacher-approval-metrics">
        <div className="teacher-approval-card">
          <div>
            <div className="teacher-approval-card__title">Menunggu Verifikasi</div>
            <div className="teacher-approval-card__value text-amber-600">{stats.pending}</div>
            <div className="teacher-approval-card__desc">Perlu respon kesiswaan</div>
          </div>
          <div className="teacher-approval-card__icon bg-amber-50 text-amber-600">
            <Clock size={20} />
          </div>
        </div>

        <div className="teacher-approval-card">
          <div>
            <div className="teacher-approval-card__title">Izin Disetujui</div>
            <div className="teacher-approval-card__value text-emerald-600">{stats.approved}</div>
            <div className="teacher-approval-card__desc">Telah didelegasikan</div>
          </div>
          <div className="teacher-approval-card__icon bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="teacher-approval-card">
          <div>
            <div className="teacher-approval-card__title">Izin Ditolak</div>
            <div className="teacher-approval-card__value text-rose-600">{stats.rejected}</div>
            <div className="teacher-approval-card__desc">Tidak disetujui</div>
          </div>
          <div className="teacher-approval-card__icon bg-rose-50 text-rose-600">
            <XCircle size={20} />
          </div>
        </div>

        <div className="teacher-approval-card">
          <div>
            <div className="teacher-approval-card__title">Total Antrean</div>
            <div className="teacher-approval-card__value text-gray-900">{stats.total}</div>
            <div className="teacher-approval-card__desc">Semua permohonan masuk</div>
          </div>
          <div className="teacher-approval-card__icon bg-gray-50 text-gray-600">
            <FileText size={20} />
          </div>
        </div>
      </div>

      {/* 3. Toolbar Filter & Pencarian */}
      <div className="teacher-approval-filter-bar">
        <div className="teacher-approval-tabs">
          <button
            type="button"
            className={`teacher-approval-tab ${statusFilter === 'pending' ? 'teacher-approval-tab--active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Menunggu ({stats.pending})
          </button>
          <button
            type="button"
            className={`teacher-approval-tab ${statusFilter === 'all' ? 'teacher-approval-tab--active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Semua ({stats.total})
          </button>
          <button
            type="button"
            className={`teacher-approval-tab ${statusFilter === 'approved' ? 'teacher-approval-tab--active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            Disetujui ({stats.approved})
          </button>
          <button
            type="button"
            className={`teacher-approval-tab ${statusFilter === 'rejected' ? 'teacher-approval-tab--active' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            Ditolak ({stats.rejected})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="date"
            className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            title="Filter tanggal permohonan izin"
          />
          {dateFilter && (
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700 underline"
              onClick={() => setDateFilter('')}
            >
              Reset Tanggal
            </button>
          )}
          <div className="w-full sm:w-64">
            <SearchInput
              placeholder="Cari guru, NIP, mapel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
            />
          </div>
        </div>
      </div>

      {/* 4. Tabel Antrean Verifikasi */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
            <span>Memuat antrean verifikasi izin guru...</span>
          </div>
        ) : fetchError ? (
          <div className="p-8">
            <ErrorState message={fetchError} onRetry={fetchLeaveQueue} />
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title={
                statusFilter === 'pending'
                  ? 'Tidak Ada Antrean Izin yang Menunggu'
                  : 'Tidak Ada Data Permohonan Izin'
              }
              description={
                statusFilter === 'pending'
                  ? 'Seluruh permohonan izin mengajar rekan guru telah selesai diverifikasi.'
                  : 'Tidak ditemukan permohonan izin guru yang sesuai dengan kriteria filter.'
              }
            />
          </div>
        ) : (
          <Table columns={columns} data={filteredLeaves} />
        )}
      </div>

      {/* 5. Modal Konfirmasi Persetujuan (Approve) */}
      <Modal
        isOpen={actionModal.isOpen && actionModal.type === 'approve'}
        onClose={() => setActionModal({ isOpen: false, type: null, item: null })}
        title="Konfirmasi Persetujuan Izin & Penugasan Pengganti"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <p className="font-semibold mb-1">
                Anda akan menyetujui izin mengajar untuk:
              </p>
              <p className="font-medium text-emerald-950">
                {actionModal.item?.teacher?.name} ({actionModal.item?.teacher?.nis_nip || '-'})
              </p>
              <p className="mt-1 text-[11.5px] text-emerald-800">
                Tanggal: <strong>{formatDate(actionModal.item?.date)}</strong>
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
            <div className="flex items-center gap-1.5 font-semibold text-amber-950 mb-1">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              <span>Penting: Pembebanan Otomatis Jadwal Inval</span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-amber-800">
              Dengan menyetujui izin ini, seluruh sesi jadwal KBM yang ditinggalkan guru bersangkutan pada hari tersebut <strong>akan otomatis dibebankan ke akun Anda sebagai Guru Pengganti (Inval)</strong> dan muncul di halaman Jurnal Mengajar Anda untuk didampingi dan diisi presensinya.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button
              variant="secondary"
              size="sm"
              disabled={isProcessingAction}
              onClick={() => setActionModal({ isOpen: false, type: null, item: null })}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isProcessingAction}
              onClick={handleConfirmApprove}
            >
              {isProcessingAction ? (
                <>
                  <RefreshCw size={13} className="animate-spin mr-1.5" />
                  Memproses...
                </>
              ) : (
                <>
                  <Check size={14} className="mr-1" />
                  Setujui &amp; Bebankan ke Jurnal Saya
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 6. Modal Konfirmasi Penolakan (Reject) */}
      <Modal
        isOpen={actionModal.isOpen && actionModal.type === 'reject'}
        onClose={() => setActionModal({ isOpen: false, type: null, item: null })}
        title="Konfirmasi Penolakan Permohonan Izin"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900 leading-relaxed">
              <p className="font-semibold mb-1">
                Apakah Anda yakin ingin menolak permohonan izin ini?
              </p>
              <p className="font-medium text-rose-950">
                {actionModal.item?.teacher?.name} ({actionModal.item?.teacher?.nis_nip || '-'})
              </p>
              <p className="mt-1 text-[11.5px] text-rose-800">
                Tanggal: <strong>{formatDate(actionModal.item?.date)}</strong>
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Permohonan izin akan berstatus Ditolak dan guru yang bersangkutan tetap diwajibkan mengajar sesuai jadwal normal.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button
              variant="secondary"
              size="sm"
              disabled={isProcessingAction}
              onClick={() => setActionModal({ isOpen: false, type: null, item: null })}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isProcessingAction}
              onClick={handleConfirmReject}
            >
              {isProcessingAction ? (
                <>
                  <RefreshCw size={13} className="animate-spin mr-1.5" />
                  Memproses...
                </>
              ) : (
                <>
                  <X size={14} className="mr-1" />
                  Tolak Permohonan
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 7. Modal Detail Berkas & Tugas Titipan Siswa */}
      <Modal
        isOpen={Boolean(selectedDetail)}
        onClose={() => setSelectedDetail(null)}
        title="Detail Berkas & Tugas Titipan Siswa"
        size="lg"
      >
        {selectedDetail && (
          <div className="space-y-4 text-xs">
            {/* Info Guru & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <span className="text-gray-400 block text-[11px]">Guru Pemohon:</span>
                <span className="font-semibold text-gray-900">
                  {selectedDetail.teacher?.name}
                </span>
                <span className="text-gray-500 block font-mono text-[11px]">
                  NIP: {selectedDetail.teacher?.nis_nip || '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Tanggal Izin:</span>
                <span className="font-semibold text-gray-900">
                  {formatDate(selectedDetail.date)}
                </span>
                <div className="mt-1">
                  {selectedDetail.status === 'approved' && (
                    <Badge variant="success" dot>Disetujui</Badge>
                  )}
                  {selectedDetail.status === 'rejected' && (
                    <Badge variant="error" dot>Ditolak</Badge>
                  )}
                  {selectedDetail.status === 'pending' && (
                    <Badge variant="warning" dot>Menunggu Verifikasi</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Alasan */}
            <div>
              <span className="font-semibold text-gray-800 block mb-1">
                Alasan / Keperluan Ketidakhadiran:
              </span>
              <div className="p-3 bg-white border border-gray-200 rounded-lg text-gray-700 leading-relaxed whitespace-pre-line">
                {selectedDetail.reason}
              </div>
            </div>

            {/* Dokumen Surat Lampiran */}
            <div>
              <span className="font-semibold text-gray-800 block mb-1">
                Dokumen Surat / Bukti Lampiran:
              </span>
              {selectedDetail.attachment_path ? (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-indigo-600" />
                    <span className="font-medium text-indigo-900 text-xs">
                      Surat Keterangan / Dispensasi Resmi
                    </span>
                  </div>
                  <a
                    href={getStorageUrl(selectedDetail.attachment_path)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 bg-white text-indigo-700 border border-indigo-300 rounded font-medium text-xs hover:bg-indigo-50 transition-colors"
                  >
                    <ExternalLink size={12} />
                    <span>Buka Berkas</span>
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 italic">
                  Tidak ada dokumen surat yang dilampirkan.
                </div>
              )}
            </div>

            {/* Tugas Titipan Siswa */}
            <div>
              <span className="font-semibold text-gray-800 block mb-1">
                Instruksi Tugas Mandiri untuk Siswa:
              </span>
              {selectedDetail.task_instruction ? (
                <div className="p-3 bg-white border border-gray-200 rounded-lg text-gray-700 leading-relaxed whitespace-pre-line">
                  {selectedDetail.task_instruction}
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 italic">
                  Tidak ada instruksi teks tugas titipan.
                </div>
              )}
            </div>

            {/* Berkas Materi / Soal Titipan */}
            {selectedDetail.task_attachment_path && (
              <div>
                <span className="font-semibold text-gray-800 block mb-1">
                  Lampiran Berkas Soal / Modul Siswa:
                </span>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-emerald-600" />
                    <span className="font-medium text-emerald-900 text-xs">
                      File Materi / Soal Mandiri Siswa
                    </span>
                  </div>
                  <a
                    href={getStorageUrl(selectedDetail.task_attachment_path)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 bg-white text-emerald-700 border border-emerald-300 rounded font-medium text-xs hover:bg-emerald-50 transition-colors"
                  >
                    <ExternalLink size={12} />
                    <span>Unduh Materi</span>
                  </a>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-gray-100">
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
