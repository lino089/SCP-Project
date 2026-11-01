import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  X,
  FileText,
  Eye,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Users,
  GraduationCap,
  Download,
  AlertCircle,
  Briefcase,
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
import { getStorageUrl } from '../../utils/formatters';
import ForbiddenState from '../../components/feedback/ForbiddenState';
import './PermissionVerify.css';

export default function PermissionVerifyPage() {
  const navigate = useNavigate();
  const { user, hasRole, isKesiswaan, isWaliKelas } = useAuth();

  // Wewenang verifikasi: Waka Kurikulum atau Guru Kesiswaan
  const canVerify = useMemo(() => {
    return hasRole('waka') || isKesiswaan();
  }, [hasRole, isKesiswaan]);

  // Hak akses halaman: Waka, Kesiswaan, atau Wali Kelas
  const isAuthorized = useMemo(() => {
    return canVerify || isWaliKelas();
  }, [canVerify, isWaliKelas]);

  // Tab Kategori Utama (Hanya aktif untuk Kesiswaan / Waka)
  const [activeCategory, setActiveCategory] = useState('students'); // 'students' | 'teachers'

  // State Perizinan Siswa
  const [permissionList, setPermissionList] = useState([]);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  // State Perizinan Guru
  const [teacherLeaveList, setTeacherLeaveList] = useState([]);
  const [teacherFilterStatus, setTeacherFilterStatus] = useState('pending');
  const [previewTeacherDoc, setPreviewTeacherDoc] = useState(null);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);

  // Toast Notifikasi & Processing State
  const [toastMessage, setToastMessage] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Load Data Perizinan Siswa
  const fetchStudentLeaves = useCallback(async () => {
    setIsLoadingStudents(true);
    try {
      const res = await leaveApi.getLeaveRequests({ per_page: 100 });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setPermissionList(list);
    } catch {
      // Fallback ditangani di service layer
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  // Load Data Perizinan Guru (Khusus Kesiswaan / Waka)
  const fetchTeacherLeaves = useCallback(async () => {
    if (!canVerify) return;
    setIsLoadingTeachers(true);
    try {
      const res = await leaveApi.getTeacherLeaveRequests({ per_page: 100 });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setTeacherLeaveList(list);
    } catch {
      // Fallback
    } finally {
      setIsLoadingTeachers(false);
    }
  }, [canVerify]);

  useEffect(() => {
    let isMounted = true;
    const loadLeaves = async () => {
      if (!isMounted) return;
      await fetchStudentLeaves();
      if (canVerify && isMounted) {
        await fetchTeacherLeaves();
      }
    };
    Promise.resolve().then(loadLeaves);
    return () => {
      isMounted = false;
    };
  }, [fetchStudentLeaves, fetchTeacherLeaves, canVerify]);

  // ==========================================
  // LOGIKA TAB SISWA
  // ==========================================
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
        setPreviewDoc(null);
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
            NIS: {row.student?.nis_nip || '-'} &bull; {row.student?.schoolClass?.name || 'Kelas'}
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
      label: 'Dokumen Bukti',
      renderCell: (row) =>
        row.document_path ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-[11px] font-medium cursor-pointer transition-colors"
            onClick={() => setPreviewDoc(row)}
          >
            <Eye size={12} className="text-gray-500" />
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
        if (row.status_approval === 'approved') return <Badge variant="success">Disetujui</Badge>;
        if (row.status_approval === 'rejected') return <Badge variant="error">Ditolak</Badge>;
        return <Badge variant="warning">Menunggu</Badge>;
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

  // ==========================================
  // LOGIKA TAB GURU (Khusus Kesiswaan & Waka)
  // ==========================================
  const filteredTeacherData = useMemo(() => {
    if (teacherFilterStatus === 'all') return teacherLeaveList;
    return teacherLeaveList.filter((t) => t.status === teacherFilterStatus);
  }, [teacherLeaveList, teacherFilterStatus]);

  const teacherCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    teacherLeaveList.forEach((t) => {
      if (t.status === 'pending') pending += 1;
      else if (t.status === 'approved') approved += 1;
      else if (t.status === 'rejected') rejected += 1;
    });

    return { all: teacherLeaveList.length, pending, approved, rejected };
  }, [teacherLeaveList]);

  const teacherTabs = [
    { id: 'pending', label: 'Menunggu Persetujuan', count: teacherCounts.pending },
    { id: 'all', label: 'Semua Izin Guru', count: teacherCounts.all },
    { id: 'approved', label: 'Disetujui', count: teacherCounts.approved },
    { id: 'rejected', label: 'Ditolak', count: teacherCounts.rejected },
  ];

  const handleApproveTeacherLeave = async (id) => {
    setIsProcessingAction(true);
    try {
      await leaveApi.approveTeacherLeaveRequest(id);
      setTeacherLeaveList((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'approved' } : t))
      );
      if (previewTeacherDoc?.id === id) {
        setPreviewTeacherDoc(null);
      }
      setToastMessage('Pengajuan izin mengajar guru berhasil disetujui (Approved).');
      setTimeout(() => setToastMessage(''), 3500);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal menyetujui izin mengajar guru.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRejectTeacherLeave = async (id) => {
    setIsProcessingAction(true);
    try {
      await leaveApi.rejectTeacherLeaveRequest(id);
      setTeacherLeaveList((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'rejected' } : t))
      );
      if (previewTeacherDoc?.id === id) {
        setPreviewTeacherDoc(null);
      }
      setToastMessage('Pengajuan izin mengajar guru telah ditolak (Rejected).');
      setTimeout(() => setToastMessage(''), 3500);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal menolak izin mengajar guru.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const teacherColumns = [
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
      key: 'teacher',
      label: 'Guru Pemohon',
      renderCell: (row) => (
        <div>
          <div className="font-semibold text-gray-900 text-xs">
            {row.teacher?.name || 'Guru'}
          </div>
          <div className="text-[11px] font-mono text-gray-500 mt-0.5">
            NIP: {row.teacher?.nis_nip || '-'}
          </div>
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Tanggal Izin',
      renderCell: (row) => (
        <div className="flex items-center gap-1.5 text-gray-700 text-xs">
          <Calendar size={13} className="text-gray-400" />
          <span className="font-mono text-[11.5px] font-medium">{row.date}</span>
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Alasan / Keperluan',
      renderCell: (row) => (
        <div className="max-w-xs truncate text-xs text-gray-800" title={row.reason}>
          {row.reason}
        </div>
      ),
    },
    {
      key: 'details',
      label: 'Surat & Berkas Tugas',
      renderCell: (row) => (
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-[11px] font-medium cursor-pointer transition-colors"
          onClick={() => setPreviewTeacherDoc(row)}
        >
          <FileText size={12} className="text-gray-500" />
          <span>Lihat Berkas &amp; Tugas</span>
        </button>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      renderCell: (row) => {
        if (row.status === 'approved') return <Badge variant="success">Disetujui</Badge>;
        if (row.status === 'rejected') return <Badge variant="error">Ditolak</Badge>;
        return <Badge variant="warning">Menunggu</Badge>;
      },
    },
    {
      key: 'actions',
      label: 'Aksi Verifikasi',
      align: 'right',
      renderCell: (row) => {
        if (row.status !== 'pending') {
          return (
            <span className="text-[11px] text-gray-400 font-medium">
              Telah Diproses {row.approvedBy?.name ? `(${row.approvedBy.name})` : ''}
            </span>
          );
        }

        return (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              className="permission-verify__action-btn-approve"
              title="Setujui perizinan mengajar guru ini"
              disabled={isProcessingAction}
              onClick={() => handleApproveTeacherLeave(row.id)}
            >
              <Check size={13} />
              <span>Setujui</span>
            </button>
            <button
              type="button"
              className="permission-verify__action-btn-reject"
              title="Tolak perizinan mengajar guru ini"
              disabled={isProcessingAction}
              onClick={() => handleRejectTeacherLeave(row.id)}
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
          message="Hanya Guru Kesiswaan (Piket), Waka Kurikulum, atau Wali Kelas yang memiliki wewenang mengakses halaman verifikasi perizinan."
          actionText="Kembali ke Beranda"
          onAction={() => navigate('/teacher/schedule')}
        />
      </div>
    );
  }

  return (
    <div className="permission-verify">
      {/* Header Halaman */}
      <div className="permission-verify__header">
        <div className="permission-verify__title-group">
          <h1>Pusat Verifikasi &amp; Monitoring Perizinan</h1>
          <p className="permission-verify__subtitle">
            {canVerify
              ? 'Kelola permohonan dispensasi siswa, validasi surat izin mengajar guru, dan delegasikan tugas pengganti KBM.'
              : 'Pemantauan status perizinan siswa kelas binaan secara real-time (Read-Only Wali Kelas).'}
          </p>
        </div>

        <div className="permission-verify__header-badges">
          {canVerify ? (
            <Badge variant="warning">
              <ShieldCheck size={13} className="inline mr-1" />
              Wewenang Kesiswaan &amp; Waka
            </Badge>
          ) : (
            <Badge variant="info">
              <GraduationCap size={13} className="inline mr-1" />
              Mode Wali Kelas (Monitoring)
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
          <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong>Informasi Wewenang Wali Kelas:</strong> Anda memiliki akses pemantauan (Read-Only) terhadap perizinan siswa di rombel binaan Anda. Persetujuan atau penolakan resmi permohonan dispensasi dilakukan oleh Tim Kesiswaan / Guru Piket.
          </div>
        </div>
      )}

      {/* Toast Notifikasi */}
      {toastMessage && (
        <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-800 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigasi Kategori Utama (Hanya untuk Kesiswaan & Waka) */}
      {canVerify && (
        <div className="flex border-b border-gray-200 mb-5 gap-2">
          <button
            type="button"
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeCategory === 'students'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveCategory('students')}
          >
            <Users size={15} />
            <span>Perizinan Siswa</span>
            {studentCounts.pending > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
                {studentCounts.pending}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeCategory === 'teachers'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveCategory('teachers')}
          >
            <Briefcase size={15} />
            <span>Perizinan Mengajar Guru</span>
            {teacherCounts.pending > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-red-100 text-red-800 font-bold">
                {teacherCounts.pending}
              </span>
            )}
          </button>
        </div>
      )}

      {/* KONTEN TAB 1: PERIZINAN SISWA */}
      {(activeCategory === 'students' || !canVerify) && (
        <>
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
              loading={isLoadingStudents}
              emptyMessage="Tidak ada data perizinan siswa pada kategori status ini."
            />
          </div>
        </>
      )}

      {/* KONTEN TAB 2: PERIZINAN GURU (Hanya untuk Kesiswaan & Waka) */}
      {canVerify && activeCategory === 'teachers' && (
        <>
          {/* Sub-Tabs Filter Status Guru */}
          <div className="mb-5">
            <Tabs
              tabs={teacherTabs}
              activeTab={teacherFilterStatus}
              onChange={setTeacherFilterStatus}
            />
          </div>

          {/* Tabel Perizinan Guru */}
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Daftar Izin Mengajar Guru ({filteredTeacherData.length} Data)
              </h2>
              <span className="text-[11px] text-gray-500">
                {teacherCounts.pending} permohonan butuh persetujuan
              </span>
            </div>

            <Table
              columns={teacherColumns}
              data={filteredTeacherData}
              loading={isLoadingTeachers}
              emptyMessage="Tidak ada data perizinan mengajar guru pada kategori status ini."
            />
          </div>
        </>
      )}

      {/* MODAL PRATINJAU SURAT SISWA */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title="Verifikasi Berkas Surat Keterangan Siswa"
        size="md"
      >
        <div className="permission-verify__preview-box">
          <FileText size={48} className="mx-auto text-gray-400 mb-2" />
          <div className="text-sm font-bold text-gray-900 font-mono break-all">
            {previewDoc?.document_path || 'surat_keterangan_resmi.pdf'}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Lampiran resmi yang diunggah oleh siswa/wali murid.
          </p>

          <div className="permission-verify__preview-meta">
            <div>
              <strong>Nama Siswa:</strong> {previewDoc?.student?.name}
            </div>
            <div className="mt-1">
              <strong>Kelas:</strong> {previewDoc?.student?.schoolClass?.name}
            </div>
            <div className="mt-1">
              <strong>Jenis Izin:</strong>{' '}
              {previewDoc?.type === 'tidak_masuk' ? 'Tidak Masuk Sekolah' : 'Dispensasi Keluar'} (
              {previewDoc?.category})
            </div>
            <div className="mt-1">
              <strong>Waktu:</strong>{' '}
              {previewDoc?.type === 'tidak_masuk'
                ? `${previewDoc?.start_date} s/d ${previewDoc?.end_date}`
                : `${previewDoc?.start_date || previewDoc?.date} (${previewDoc?.departure_time} - ${previewDoc?.expected_return_time})`}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-gray-200">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPreviewDoc(null)}
            >
              Tutup
            </Button>
            {canVerify && previewDoc?.status_approval === 'pending' && (
              <>
                <button
                  type="button"
                  className="permission-verify__action-btn-reject"
                  disabled={isProcessingAction}
                  onClick={() => handleUpdateStudentStatus(previewDoc.id, 'rejected')}
                >
                  <X size={13} />
                  <span>Tolak Permohonan</span>
                </button>
                <button
                  type="button"
                  className="permission-verify__action-btn-approve"
                  disabled={isProcessingAction}
                  onClick={() => handleUpdateStudentStatus(previewDoc.id, 'approved')}
                >
                  <Check size={13} />
                  <span>Setujui Permohonan</span>
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* MODAL PRATINJAU BERKAS & TUGAS GURU */}
      <Modal
        isOpen={Boolean(previewTeacherDoc)}
        onClose={() => setPreviewTeacherDoc(null)}
        title="Detail Izin Mengajar &amp; Delegasi Tugas Guru"
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-500 block">Guru Pengajar:</span>
              <strong className="text-gray-900 font-semibold">{previewTeacherDoc?.teacher?.name}</strong>
              <div className="text-[11px] font-mono text-gray-500">NIP: {previewTeacherDoc?.teacher?.nis_nip}</div>
            </div>
            <div>
              <span className="text-gray-500 block">Tanggal Izin:</span>
              <strong className="text-gray-900 font-semibold font-mono">{previewTeacherDoc?.date}</strong>
              <div className="mt-1">
                <Badge variant={previewTeacherDoc?.status === 'approved' ? 'success' : previewTeacherDoc?.status === 'rejected' ? 'error' : 'warning'}>
                  {previewTeacherDoc?.status === 'approved' ? 'Disetujui' : previewTeacherDoc?.status === 'rejected' ? 'Ditolak' : 'Menunggu Verifikasi'}
                </Badge>
              </div>
            </div>
            <div className="col-span-2 border-t border-gray-200 pt-2 mt-1">
              <span className="text-gray-500 block mb-0.5">Alasan / Keterangan:</span>
              <div className="text-gray-800 bg-white p-2.5 rounded border border-gray-200 font-sans">
                {previewTeacherDoc?.reason || '-'}
              </div>
            </div>
          </div>

          {/* Bagian Instruksi Tugas Pengganti */}
          <div className="p-3.5 bg-amber-50/70 rounded-lg border border-amber-200 text-xs">
            <h3 className="font-semibold text-amber-900 mb-1 flex items-center gap-1.5">
              <Briefcase size={14} className="text-amber-700" />
              Instruksi Tugas Mandiri untuk Kelas / Guru Piket
            </h3>
            <p className="text-gray-800 bg-white p-2.5 rounded border border-amber-200 whitespace-pre-wrap font-sans mt-1">
              {previewTeacherDoc?.task_instruction || 'Tidak ada instruksi khusus yang dicantumkan.'}
            </p>
          </div>

          {/* Berkas Lampiran */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText size={18} className="text-blue-600 shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold text-gray-900">Surat Keterangan / Dinas</div>
                  <div className="text-[10px] text-gray-500 truncate">{previewTeacherDoc?.attachment_path || 'Tidak ada surat'}</div>
                </div>
              </div>
              {previewTeacherDoc?.attachment_path && (
                <a
                  href={getStorageUrl(previewTeacherDoc.attachment_path)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded text-[11px] font-medium shrink-0 flex items-center gap-1"
                >
                  <Download size={11} />
                  <span>Unduh</span>
                </a>
              )}
            </div>

            <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText size={18} className="text-emerald-600 shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold text-gray-900">Lampiran Modul / Soal Tugas</div>
                  <div className="text-[10px] text-gray-500 truncate">{previewTeacherDoc?.task_attachment_path || 'Tidak ada berkas tugas'}</div>
                </div>
              </div>
              {previewTeacherDoc?.task_attachment_path && (
                <a
                  href={getStorageUrl(previewTeacherDoc.task_attachment_path)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded text-[11px] font-medium shrink-0 flex items-center gap-1"
                >
                  <Download size={11} />
                  <span>Unduh</span>
                </a>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-200">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPreviewTeacherDoc(null)}
            >
              Tutup
            </Button>
            {previewTeacherDoc?.status === 'pending' && (
              <>
                <button
                  type="button"
                  className="permission-verify__action-btn-reject"
                  disabled={isProcessingAction}
                  onClick={() => handleRejectTeacherLeave(previewTeacherDoc.id)}
                >
                  <X size={13} />
                  <span>Tolak Pengajuan</span>
                </button>
                <button
                  type="button"
                  className="permission-verify__action-btn-approve"
                  disabled={isProcessingAction}
                  onClick={() => handleApproveTeacherLeave(previewTeacherDoc.id)}
                >
                  <Check size={13} />
                  <span>Setujui Pengajuan</span>
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
