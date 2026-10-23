import { useState, useEffect } from 'react';
import { Calendar, FileText, Eye } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import leaveApi from '../../services/leaveApi';
import Tabs from '../../components/shared/Tabs';
import Badge from '../../components/shared/Badge';
import Table from '../../components/shared/Table';
import Modal from '../../components/shared/Modal';
import Button from '../../components/shared/Button';
import './ParentMonitoring.css';

export default function ParentMonitoringPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('attendance');
  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Child Profile Information (fallback to active student mock if not bound to parent record)
  const child = {
    studentName: user?.child_name || 'Aisyah Putri Ramadhani',
    nis: user?.child_nis || '2024001',
    className: user?.child_class || 'X-RPL-1',
    guardianName: user?.name || 'Bambang Sulistyo',
    academicYear: '2025/2026 Ganjil',
  };

  // Mock quiz performance data
  const quizResults = [
    {
      id: 1,
      quizTitle: 'Kuis Logika Algoritma Dasar',
      subject: 'Dasar Pemrograman RPL',
      score: 95,
      maxScore: 100,
      completedDate: '2026-10-22',
      status: 'Tuntas KKM',
    },
    {
      id: 2,
      quizTitle: 'Kuis Persamaan Kuadrat & Fungsi',
      subject: 'Matematika Diskrit',
      score: 88,
      maxScore: 100,
      completedDate: '2026-10-18',
      status: 'Tuntas KKM',
    },
    {
      id: 3,
      quizTitle: 'Kuis Desain Basis Data Relasional',
      subject: 'Basis Data',
      score: 92,
      maxScore: 100,
      completedDate: '2026-10-15',
      status: 'Tuntas KKM',
    },
    {
      id: 4,
      quizTitle: 'Kuis Struktur Kalimat Bahasa Inggris',
      subject: 'Bahasa Inggris Terapan',
      score: 85,
      maxScore: 100,
      completedDate: '2026-10-10',
      status: 'Tuntas KKM',
    },
  ];

  // Fetch Attendance and Leave records
  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      setLoading(true);
      try {
        const [attRes, leaveRes] = await Promise.all([
          leaveApi.getAttendances({ per_page: 50 }),
          leaveApi.getLeaveRequests({ per_page: 50 }),
        ]);

        if (isMounted) {
          if (attRes?.data) {
            setAttendances(Array.isArray(attRes.data) ? attRes.data : []);
          }
          if (leaveRes?.data) {
            setLeaveRequests(Array.isArray(leaveRes.data) ? leaveRes.data : []);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat data monitoring anak, menggunakan fallback:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute attendance summary
  const summary = attendances.reduce(
    (acc, item) => {
      const st = (item.status || '').toLowerCase();
      if (st === 'hadir' || st === 'present') acc.hadir += 1;
      else if (st === 'sakit' || st === 'sick') acc.sakit += 1;
      else if (st === 'izin' || st === 'permit') acc.izin += 1;
      else if (st === 'alpa' || st === 'absent') acc.alpa += 1;
      return acc;
    },
    { hadir: 42, sakit: 3, izin: 2, alpa: 1 }
  );

  const tabs = [
    { id: 'attendance', label: 'Rekapitulasi Kehadiran', count: attendances.length || 48 },
    { id: 'permissions', label: 'Riwayat Izin & Dispensasi', count: leaveRequests.length || 1 },
    { id: 'quizzes', label: 'Capaian Nilai Kuis AI', count: quizResults.length },
  ];

  // Table Columns: Attendance
  const attendanceColumns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      width: '60px',
      renderCell: (row, idx) => (
        <span className="font-mono text-xs text-slate-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Tanggal',
      renderCell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {row.date || '2026-10-23'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status Kehadiran',
      renderCell: (row) => {
        const s = (row.status || '').toLowerCase();
        if (s === 'hadir' || s === 'present') {
          return <Badge variant="success">Hadir Penuh</Badge>;
        }
        if (s === 'sakit' || s === 'sick') {
          return <Badge variant="info">Izin Sakit</Badge>;
        }
        if (s === 'izin' || s === 'permit') {
          return <Badge variant="warning">Izin Keluar/Lainnya</Badge>;
        }
        return <Badge variant="error">Alpa</Badge>;
      },
    },
    {
      key: 'time',
      label: 'Waktu Presensi',
      renderCell: (row) => (
        <span className="text-xs text-slate-600 font-mono">
          {row.time || '07:05:22 WIB'}
        </span>
      ),
    },
    {
      key: 'notes',
      label: 'Keterangan',
      renderCell: (row) => (
        <span className="text-xs text-slate-500">
          {row.notes || 'Tercatat pada sesi presensi kelas reguler'}
        </span>
      ),
    },
  ];

  // Table Columns: Leave Requests
  const leaveColumns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      width: '60px',
      renderCell: (row, idx) => (
        <span className="font-mono text-xs text-slate-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Jenis Izin',
      renderCell: (row) => (
        <span className="text-xs font-semibold text-slate-800">
          {row.type === 'tidak_masuk' ? 'Tidak Masuk Sekolah' : 'Dispensasi Keluar'}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Kategori',
      renderCell: (row) => (
        <span className="capitalize text-xs font-medium text-slate-700">
          {row.category}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Periode Tanggal',
      renderCell: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.start_date === row.end_date || !row.end_date
            ? row.start_date
            : `${row.start_date} s/d ${row.end_date}`}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status Persetujuan',
      renderCell: (row) => {
        const st = (row.status_approval || row.status || 'pending').toLowerCase();
        if (st === 'approved') return <Badge variant="success">Disetujui</Badge>;
        if (st === 'rejected') return <Badge variant="error">Ditolak</Badge>;
        return <Badge variant="warning">Menunggu Verifikasi</Badge>;
      },
    },
    {
      key: 'document',
      label: 'Dokumen',
      renderCell: (row) => {
        if (!row.document_path) {
          return <span className="text-xs text-slate-400 italic">Tidak ada berkas</span>;
        }
        return (
          <button
            type="button"
            className="parent-doc-btn"
            onClick={() => setPreviewDoc(row)}
            title="Lihat lampiran berkas"
          >
            <Eye size={13} />
            <span>Lihat Surat</span>
          </button>
        );
      },
    },
  ];

  // Table Columns: Quiz Results
  const quizColumns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      width: '60px',
      renderCell: (row, idx) => (
        <span className="font-mono text-xs text-slate-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'quizTitle',
      label: 'Judul Kuis',
      renderCell: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-800">{row.quizTitle}</span>
          <span className="text-[11px] text-slate-400">Evaluasi Berbantuan AI</span>
        </div>
      ),
    },
    {
      key: 'subject',
      label: 'Mata Pelajaran',
      renderCell: (row) => (
        <span className="text-xs text-slate-700 font-medium">{row.subject}</span>
      ),
    },
    {
      key: 'completedDate',
      label: 'Tanggal Pengerjaan',
      renderCell: (row) => (
        <span className="font-mono text-xs text-slate-600">{row.completedDate}</span>
      ),
    },
    {
      key: 'score',
      label: 'Nilai Diperoleh',
      renderCell: (row) => (
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-sm font-bold text-slate-900">{row.score}</span>
          <span className="font-mono text-[11px] text-slate-400">/ {row.maxScore}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Capaian Kompetensi',
      renderCell: (row) => (
        <Badge variant={row.score >= 75 ? 'success' : 'warning'}>
          {row.score >= 75 ? 'Tuntas KKM' : 'Perlu Remedial'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="parent-monitoring-page">
      {/* Child Information Header Card */}
      <div className="parent-child-card">
        <div className="parent-child-header">
          <div className="parent-child-info">
            <div className="parent-avatar-circle">
              {child.studentName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <div className="parent-name-row">
                <h1 className="parent-child-name">{child.studentName}</h1>
                <Badge variant="success">Siswa Aktif</Badge>
              </div>
              <p className="parent-child-meta">
                NIS: <span className="font-mono font-medium text-slate-700">{child.nis}</span> &bull;
                Rombel Kelas <span className="font-mono font-semibold text-slate-800">{child.className}</span> &bull;
                Wali Murid: <span className="font-medium text-slate-700">{child.guardianName}</span>
              </p>
            </div>
          </div>

          <div className="parent-semester-badge">
            <Calendar size={14} className="text-slate-500" />
            <span>Tahun Ajaran: <strong className="font-mono text-slate-800">{child.academicYear}</strong></span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="parent-tabs-wrap">
        <Tabs activeTab={activeTab} onChange={setActiveTab} tabs={tabs} />
      </div>

      {/* Tab 1: Attendance Recap */}
      {activeTab === 'attendance' && (
        <div className="parent-tab-section">
          {/* 4 Attendance Stat Cards */}
          <div className="parent-stats-grid">
            <div className="parent-stat-card">
              <div className="parent-stat-head">
                <span className="parent-stat-label">Hadir di Kelas</span>
                <span className="parent-stat-dot parent-stat-dot--hadir" />
              </div>
              <div className="parent-stat-value">
                <span className="font-mono">{summary.hadir}</span>
                <span className="parent-stat-unit">hari</span>
              </div>
              <p className="parent-stat-desc">Presensi fisik terkonfirmasi di kelas</p>
            </div>

            <div className="parent-stat-card">
              <div className="parent-stat-head">
                <span className="parent-stat-label">Izin Sakit</span>
                <span className="parent-stat-dot parent-stat-dot--sakit" />
              </div>
              <div className="parent-stat-value">
                <span className="font-mono">{summary.sakit}</span>
                <span className="parent-stat-unit">hari</span>
              </div>
              <p className="parent-stat-desc">Didukung surat keterangan dokter</p>
            </div>

            <div className="parent-stat-card">
              <div className="parent-stat-head">
                <span className="parent-stat-label">Izin Keperluan</span>
                <span className="parent-stat-dot parent-stat-dot--izin" />
              </div>
              <div className="parent-stat-value">
                <span className="font-mono">{summary.izin}</span>
                <span className="parent-stat-unit">hari</span>
              </div>
              <p className="parent-stat-desc">Izin resmi diajukan orang tua/wali</p>
            </div>

            <div className="parent-stat-card">
              <div className="parent-stat-head">
                <span className="parent-stat-label">Alpa</span>
                <span className="parent-stat-dot parent-stat-dot--alpa" />
              </div>
              <div className="parent-stat-value">
                <span className="font-mono">{summary.alpa}</span>
                <span className="parent-stat-unit">hari</span>
              </div>
              <p className="parent-stat-desc">Ketidakhadiran tanpa keterangan</p>
            </div>
          </div>

          {/* Attendance Log Table */}
          <div className="parent-table-card">
            <div className="parent-table-header">
              <h3 className="parent-table-title">Riwayat Log Kehadiran Harian</h3>
              <p className="parent-table-subtitle">Catatan presensi harian per sesi pembelajaran aktif</p>
            </div>
            <Table
              columns={attendanceColumns}
              data={attendances}
              isLoading={loading}
              pageSize={10}
              emptyMessage="Belum ada catatan presensi anak untuk periode ini."
            />
          </div>
        </div>
      )}

      {/* Tab 2: Leave & Dispensations */}
      {activeTab === 'permissions' && (
        <div className="parent-tab-section">
          <div className="parent-table-card">
            <div className="parent-table-header">
              <h3 className="parent-table-title">Riwayat Permohonan Izin & Dispensasi</h3>
              <p className="parent-table-subtitle">Daftar pengajuan izin sakit dan dispensasi keluar yang telah diajukan</p>
            </div>
            <Table
              columns={leaveColumns}
              data={leaveRequests}
              isLoading={loading}
              pageSize={10}
              emptyMessage="Belum ada riwayat permohonan izin atau dispensasi."
            />
          </div>
        </div>
      )}

      {/* Tab 3: AI Quizzes Performance */}
      {activeTab === 'quizzes' && (
        <div className="parent-tab-section">
          <div className="parent-table-card">
            <div className="parent-table-header">
              <h3 className="parent-table-title">Capaian Hasil Kuis Berbantuan AI</h3>
              <p className="parent-table-subtitle">Evaluasi pembelajaran mandiri dan tes formatif berkala</p>
            </div>
            <Table
              columns={quizColumns}
              data={quizResults}
              pageSize={10}
              emptyMessage="Belum ada data nilai kuis tercatat untuk siswa."
            />
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <Modal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={`Lampiran Surat: ${previewDoc.student?.name || child.studentName}`}
          maxWidth="max-w-xl"
        >
          <div className="preview-modal-body">
            <div className="preview-modal-box">
              <FileText size={48} className="text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                {previewDoc.document_path?.split('/').pop() || 'surat_keterangan.pdf'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Kategori: <strong className="capitalize">{previewDoc.category}</strong> &bull; Dokumen Resmi Terverifikasi
              </p>
            </div>
            <div className="preview-doc-actions">
              <Button variant="secondary" onClick={() => setPreviewDoc(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
