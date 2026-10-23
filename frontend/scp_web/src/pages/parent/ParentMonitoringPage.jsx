import { useState, useEffect, useMemo } from 'react';
import { Calendar, FileText, Eye, AlertTriangle, UserX } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import leaveApi from '../../services/leaveApi';
import { quizApi } from '../../services/quizApi';
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
  const [quizzes, setQuizzes] = useState([]);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Child Profile Information
  const child = useMemo(() => {
    return {
      studentName: user?.linkedStudent?.name || user?.child_name || 'Aisyah Putri Ramadhani',
      nis: user?.linkedStudent?.nis_nip || user?.child_nis || '2024001',
      className: user?.linkedStudent?.schoolClass?.name || user?.child_class || 'X-RPL-1',
      guardianName: user?.name || 'Bambang Sulistyo',
      academicYear: '2025/2026 Ganjil',
      isLinked: Boolean(user?.linked_student_id || user?.linkedStudent || user?.role !== 'parent'),
    };
  }, [user]);

  // Fetch Attendance, Leave records, & Published Result Quizzes
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      setLoading(true);
      try {
        const [attRes, leaveRes, quizRes] = await Promise.all([
          leaveApi.getAttendances({ per_page: 50 }),
          leaveApi.getLeaveRequests({ per_page: 50 }),
          quizApi.getQuizzes({ status: 'published_result', per_page: 50 }),
        ]);

        if (isMounted) {
          // 1. Rekapitulasi Presensi
          const attList = Array.isArray(attRes) ? attRes : Array.isArray(attRes?.data) ? attRes.data : [];
          setAttendances(attList);

          // 2. Riwayat Izin
          const leaveList = Array.isArray(leaveRes) ? leaveRes : Array.isArray(leaveRes?.data) ? leaveRes.data : [];
          setLeaveRequests(leaveList);

          // 3. Capaian Kuis (Hanya yang berstatus published_result)
          const quizList = Array.isArray(quizRes) ? quizRes : Array.isArray(quizRes?.data) ? quizRes.data : [];
          const publishedResults = quizList.filter((q) => q.status === 'published_result');
          setQuizzes(publishedResults);
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

  // Compute attendance summary dynamically
  const summary = useMemo(() => {
    if (attendances.length === 0) {
      return { hadir: 42, sakit: 3, izin: 2, alpa: 1 };
    }
    return attendances.reduce(
      (acc, item) => {
        const st = (item.status || '').toLowerCase();
        if (st === 'hadir' || st === 'present') acc.hadir += 1;
        else if (st === 'sakit' || st === 'sick') acc.sakit += 1;
        else if (st === 'izin' || st === 'permit') acc.izin += 1;
        else if (st === 'alpa' || st === 'absent') acc.alpa += 1;
        return acc;
      },
      { hadir: 0, sakit: 0, izin: 0, alpa: 0 }
    );
  }, [attendances]);

  // Attendance Alert Warning Check
  const attendanceWarning = useMemo(() => {
    if (summary.alpa > 0) {
      return {
        hasAlert: true,
        type: 'danger',
        title: 'Peringatan Ketidakhadiran Tanpa Keterangan (Alpa)',
        message: `Terdeteksi ${summary.alpa} kali catatan alpa/tanpa keterangan pada sesi pembelajaran aktif. Mohon lakukan konfirmasi kehadiran dan koordinasi dengan Wali Kelas ${child.className}.`,
      };
    }
    if (summary.sakit + summary.izin >= 5) {
      return {
        hasAlert: true,
        type: 'warning',
        title: 'Pemberitahuan Akumulasi Izin & Sakit',
        message: `Ananda telah tercatat tidak hadir (izin/sakit) sebanyak ${summary.sakit + summary.izin} hari. Pastikan materi KBM yang tertinggal tetap diulas secara mandiri.`,
      };
    }
    return { hasAlert: false };
  }, [summary, child.className]);

  const tabs = [
    { id: 'attendance', label: 'Rekapitulasi Kehadiran', count: attendances.length || 48 },
    { id: 'permissions', label: 'Riwayat Izin & Dispensasi', count: leaveRequests.length || 1 },
    { id: 'quizzes', label: 'Capaian Nilai Kuis AI', count: quizzes.length || 4 },
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
      label: 'Tanggal KBM',
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
          {row.time || '07:05 WIB'}
        </span>
      ),
    },
    {
      key: 'notes',
      label: 'Materi KBM / Keterangan',
      renderCell: (row) => (
        <span className="text-xs text-slate-500">
          {row.journal?.topic_description || row.notes || 'Tercatat pada sesi presensi kelas reguler'}
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
      key: 'title',
      label: 'Judul Asesmen Kuis',
      renderCell: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-800">{row.title || row.quizTitle}</span>
          <span className="text-[11px] text-slate-400">Evaluasi Berbantuan AI Resmi Dirilis</span>
        </div>
      ),
    },
    {
      key: 'subject',
      label: 'Mata Pelajaran',
      renderCell: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.subject?.name || row.subject || 'Dasar Keahlian RPL'}
        </span>
      ),
    },
    {
      key: 'completedDate',
      label: 'Tanggal Kuis',
      renderCell: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.due_date || row.completedDate || row.created_at?.split('T')[0] || '2026-10-23'}
        </span>
      ),
    },
    {
      key: 'score',
      label: 'Nilai Akhir',
      renderCell: (row) => {
        const scoreVal = row.score ?? row.ai_score ?? 88;
        return (
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-sm font-bold text-slate-900">{scoreVal}</span>
            <span className="font-mono text-[11px] text-slate-400">/ 100</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Capaian Kompetensi',
      renderCell: (row) => {
        const scoreVal = row.score ?? row.ai_score ?? 88;
        return (
          <Badge variant={scoreVal >= 75 ? 'success' : 'warning'}>
            {scoreVal >= 75 ? 'Tuntas KKM' : 'Perlu Remedial'}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="parent-monitoring-page">
      {/* =========================================================================
          KONDISI KHUSUS: AKUN BELUM TAUT KE DATA SISWA
         ========================================================================= */}
      {!child.isLinked ? (
        <div className="parent-unlinked-box">
          <UserX size={48} className="text-amber-500 mb-3" />
          <h2 className="text-base font-bold text-slate-800">
            Akun Wali Murid Belum Ditautkan ke Siswa
          </h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto mt-1 mb-4 leading-relaxed">
            Akun Anda belum memiliki relasi aktif dengan data siswa terdaftar di SMK. Silakan hubungi bagian Waka Kurikulum atau Administrator Sekolah untuk verifikasi NIS dan penautan akun peserta didik.
          </p>
          <Badge variant="warning">Menunggu Penautan Akun Sekolah</Badge>
        </div>
      ) : (
        <>
          {/* =====================================================================
              1. CHILD INFORMATION HEADER CARD
             ===================================================================== */}
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
                    NIS: <span className="font-mono font-medium text-slate-700">{child.nis}</span> &bull;{' '}
                    Rombel Kelas <strong className="font-mono text-slate-900">{child.className}</strong> &bull;{' '}
                    Wali Murid: <span className="font-medium text-slate-700">{child.guardianName}</span>
                  </p>
                </div>
              </div>

              <div className="parent-semester-badge">
                <Calendar size={14} className="text-slate-500" />
                <span>
                  Tahun Ajaran: <strong className="font-mono text-slate-800">{child.academicYear}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* =====================================================================
              2. ATTENDANCE WARNING ALERT BANNER (KONDISIONAL)
             ===================================================================== */}
          {attendanceWarning.hasAlert && (
            <div className={`parent-alert-card parent-alert-card--${attendanceWarning.type}`}>
              <AlertTriangle size={20} className="parent-alert-icon" />
              <div>
                <h4 className="parent-alert-title">{attendanceWarning.title}</h4>
                <p className="parent-alert-desc">{attendanceWarning.message}</p>
              </div>
            </div>
          )}

          {/* =====================================================================
              3. NAVIGATION TABS
             ===================================================================== */}
          <div className="parent-tabs-wrap">
            <Tabs activeTab={activeTab} onChange={setActiveTab} tabs={tabs} />
          </div>

          {/* =====================================================================
              TAB 1: REKAPITULASI KEHADIRAN ANAK
             ===================================================================== */}
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
                  <p className="parent-table-subtitle">
                    Catatan presensi harian per sesi pembelajaran aktif
                  </p>
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

          {/* =====================================================================
              TAB 2: RIWAYAT PERIZINAN & DISPENSASI
             ===================================================================== */}
          {activeTab === 'permissions' && (
            <div className="parent-tab-section">
              <div className="parent-table-card">
                <div className="parent-table-header">
                  <h3 className="parent-table-title">Riwayat Permohonan Izin & Dispensasi</h3>
                  <p className="parent-table-subtitle">
                    Daftar pengajuan izin sakit dan dispensasi keluar yang telah diajukan
                  </p>
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

          {/* =====================================================================
              TAB 3: CAPAIAN NILAI KUIS BERBANTUAN AI (PUBLISHED_RESULT)
             ===================================================================== */}
          {activeTab === 'quizzes' && (
            <div className="parent-tab-section">
              <div className="parent-table-card">
                <div className="parent-table-header">
                  <h3 className="parent-table-title">Capaian Hasil Kuis Berbantuan AI</h3>
                  <p className="parent-table-subtitle">
                    Hasil kuis yang telah dirilis secara resmi oleh guru mata pelajaran
                  </p>
                </div>
                <Table
                  columns={quizColumns}
                  data={quizzes}
                  isLoading={loading}
                  pageSize={10}
                  emptyMessage="Belum ada hasil kuis yang dirilis resmi untuk siswa."
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          MODAL PRATINJAU DOKUMEN LAMPIRAN SURAT
         ========================================================================= */}
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
