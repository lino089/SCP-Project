import { useState, useEffect, useMemo } from 'react';
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
import ForbiddenState from '../../components/feedback/ForbiddenState';
import './PermissionVerify.css';

export default function PermissionVerifyPage() {
  const navigate = useNavigate();
  const { user, hasRole, isKesiswaan, isWaliKelas } = useAuth();

  const [permissionList, setPermissionList] = useState([]);
  const [filterStatus, setFilterStatus] = useState('pending'); // default focus to pending
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Otorisasi: Khusus Kesiswaan, Waka, atau Wali Kelas
  const isAuthorized = useMemo(() => {
    return hasRole('waka') || isKesiswaan() || isWaliKelas();
  }, [hasRole, isKesiswaan, isWaliKelas]);

  // Load Data Perizinan
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const res = await leaveApi.getLeaveRequests({ per_page: 100 });
        if (!isMounted) return;
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setPermissionList(list);
      } catch {
        // Fallback otomatis tertangani di service layer
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter Data Berdasarkan Tab Status Aktif
  const filteredData = useMemo(() => {
    if (filterStatus === 'all') return permissionList;
    return permissionList.filter((p) => p.status_approval === filterStatus);
  }, [permissionList, filterStatus]);

  // Hitung Jumlah per Kategori Status
  const counts = useMemo(() => {
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

  // Tabs Filter
  const tabs = [
    { id: 'pending', label: 'Menunggu Persetujuan', count: counts.pending },
    { id: 'all', label: 'Semua Permohonan', count: counts.all },
    { id: 'approved', label: 'Disetujui', count: counts.approved },
    { id: 'rejected', label: 'Ditolak', count: counts.rejected },
  ];

  // Aksi Verifikasi: Setujui / Tolak
  const handleUpdateStatus = async (id, newStatus) => {
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
          ? 'Permohonan izin berhasil disetujui (Approved).'
          : 'Permohonan izin telah ditolak (Rejected).'
      );
      setTimeout(() => setToastMessage(''), 3500);
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal memproses verifikasi izin.');
    }
  };

  // Kolom Tabel Verifikasi
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
      renderCell: (row) =>
        row.status_approval === 'pending' ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              className="permission-verify__action-btn-approve"
              title="Setujui permohonan izin ini"
              onClick={() => handleUpdateStatus(row.id, 'approved')}
            >
              <Check size={13} />
              <span>Setujui</span>
            </button>
            <button
              type="button"
              className="permission-verify__action-btn-reject"
              title="Tolak permohonan izin ini"
              onClick={() => handleUpdateStatus(row.id, 'rejected')}
            >
              <X size={13} />
              <span>Tolak</span>
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-gray-400 font-medium">Telah Diproses</span>
        ),
    },
  ];

  // Blokir Akses Ilegal (HTTP 403 Forbidden)
  if (!isAuthorized) {
    return (
      <div className="permission-verify">
        <ForbiddenState
          title="Akses Verifikasi Ditolak (403 Forbidden)"
          message="Hanya Guru Kesiswaan (Piket), Waka Kurikulum, atau Wali Kelas yang memiliki wewenang memverifikasi perizinan siswa."
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
          <h1>Pusat Verifikasi Perizinan Siswa</h1>
          <p className="permission-verify__subtitle">
            Tinjau permohonan izin siswa, periksa keaslian surat keterangan dokter, dan lakukan validasi kehadiran resmi.
          </p>
        </div>

        <div className="permission-verify__header-badges">
          <Badge variant="warning">
            <ShieldCheck size={13} className="inline mr-1" />
            Wewenang Kesiswaan &amp; Piket
          </Badge>
          <Badge variant="neutral">
            Petugas: {user?.name || 'Guru Piket'}
          </Badge>
        </div>
      </div>

      {/* Toast Notifikasi */}
      {toastMessage && (
        <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Tabs Filter Status */}
      <div className="mb-5">
        <Tabs
          tabs={tabs}
          activeTab={filterStatus}
          onChange={setFilterStatus}
        />
      </div>

      {/* Tabel Data Verifikasi Perizinan */}
      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Daftar Antrean Permohonan ({filteredData.length} Data)
          </h2>
          <span className="text-[11px] text-gray-500">
            {counts.pending} permohonan butuh persetujuan
          </span>
        </div>

        <Table
          columns={columns}
          data={filteredData}
          loading={isLoading}
          emptyMessage="Tidak ada data perizinan pada kategori status ini."
        />
      </div>

      {/* Modal Pratinjau Surat Lampiran */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title="Verifikasi Berkas Surat Keterangan"
        size="md"
      >
        <div className="permission-verify__preview-box">
          <FileText size={48} className="mx-auto text-gray-400 mb-2" />
          <div className="text-sm font-bold text-gray-900 font-mono">
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
            {previewDoc?.status_approval === 'pending' && (
              <>
                <button
                  type="button"
                  className="permission-verify__action-btn-reject"
                  onClick={() => handleUpdateStatus(previewDoc.id, 'rejected')}
                >
                  <X size={13} />
                  <span>Tolak Permohonan</span>
                </button>
                <button
                  type="button"
                  className="permission-verify__action-btn-approve"
                  onClick={() => handleUpdateStatus(previewDoc.id, 'approved')}
                >
                  <Check size={13} />
                  <span>Setujui Permohonan</span>
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
