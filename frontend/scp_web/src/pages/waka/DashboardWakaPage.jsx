import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, User, Plus, AlertCircle } from 'lucide-react';
import { Button, Table, Badge, PasswordModal } from '../../components/shared';
import { academicSettingApi, scheduleApi } from '../../services/scheduleApi';
import './DashboardWaka.css';

const FALLBACK_HISTORY = [
  {
    id: 1,
    from_cycle: 2,
    to_cycle: 1,
    changed_at: '2026-09-08 06:45:00',
    changed_by: 'Waka Kurikulum',
  },
  {
    id: 2,
    from_cycle: 1,
    to_cycle: 2,
    changed_at: '2026-09-01 07:00:00',
    changed_by: 'Waka Kurikulum',
  },
];

const FALLBACK_MISSING_JOURNALS = [
  {
    id: 101,
    className: 'X-RPL-1',
    teacherName: 'Drs. Ahmad Fauzi, M.Pd.',
    subjectName: 'Matematika',
    period: 'Jam Ke-1 s.d. Ke-2',
  },
  {
    id: 102,
    className: 'XI-RPL-1',
    teacherName: 'Budi Santoso, S.T., M.T.',
    subjectName: 'Basis Data',
    period: 'Jam Ke-3 s.d. Ke-4',
  },
];

export default function DashboardWakaPage() {
  const navigate = useNavigate();

  // Settings states
  const [activeCycle, setActiveCycle] = useState(1);
  const [mondayIsUpacara, setMondayIsUpacara] = useState(true);

  // Cycle History list
  const [historyList, setHistoryList] = useState(FALLBACK_HISTORY);

  // Missing journals
  const [missingJournals, setMissingJournals] = useState(FALLBACK_MISSING_JOURNALS);

  // Loading & Feedback states
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Password confirmation modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: '',
    description: '',
    pendingAction: null, // { type: 'cycle' | 'upacara', target: any }
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const showFeedback = (msg) => {
    setFeedbackMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Load initial data on mount
  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        const settingsRes = await academicSettingApi.getSettings();
        if (isMounted && settingsRes?.data) {
          setActiveCycle(Number(settingsRes.data.active_cycle || 1));
          setMondayIsUpacara(Boolean(settingsRes.data.monday_is_upacara));
        }
      } catch {
        // Fallback default
      }

      try {
        const historyRes = await academicSettingApi.getCycleHistory();
        if (isMounted && historyRes?.data) {
          const list = Array.isArray(historyRes.data)
            ? historyRes.data
            : historyRes.data.data || [];
          if (list.length > 0) setHistoryList(list);
        }
      } catch {
        // Fallback history
      }

      try {
        const missingRes = await scheduleApi.getMissingJournals();
        if (isMounted && missingRes?.data) {
          const raw = Array.isArray(missingRes.data)
            ? missingRes.data
            : missingRes.data.data || [];
          const formatted = raw.map((item) => ({
            id: item.id,
            className: item.school_class?.name || item.className || 'Kelas',
            teacherName: item.teacher?.name || item.teacherName || 'Guru',
            subjectName: item.subject?.name || item.subjectName || 'Mata Pelajaran',
            period: `Jam Ke-${item.period_number || item.slot || 1}`,
          }));
          setMissingJournals(formatted);
        }
      } catch {
        // Fallback
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Trigger cycle change request
  const handleRequestCycleChange = (targetCycle) => {
    if (targetCycle === activeCycle) return;
    setModalError('');
    setModalConfig({
      title: 'Konfirmasi Penggantian Putaran Jadwal',
      description: `Anda akan mengubah jadwal aktif dari Putaran ${activeCycle} ke Putaran ${targetCycle}. Tindakan ini berdampak pada seluruh jadwal KBM aktif sekolah. Masukkan kata sandi akun untuk verifikasi.`,
      pendingAction: { type: 'cycle', target: targetCycle },
    });
    setModalOpen(true);
  };

  // Trigger monday ceremony toggle request
  const handleRequestUpacaraToggle = () => {
    const nextStatus = !mondayIsUpacara;
    setModalError('');
    setModalConfig({
      title: 'Konfirmasi Perubahan Status Upacara',
      description: `Anda akan mengubah status Upacara Hari Senin menjadi ${
        nextStatus ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'
      }. Perubahan ini memengaruhi alokasi jam pelajaran pertama pada hari Senin. Masukkan kata sandi akun untuk verifikasi.`,
      pendingAction: { type: 'upacara', target: nextStatus },
    });
    setModalOpen(true);
  };

  // Confirm password action
  const handleConfirmPassword = async (password) => {
    setModalLoading(true);
    setModalError('');

    try {
      if (modalConfig.pendingAction?.type === 'cycle') {
        const target = modalConfig.pendingAction.target;
        try {
          await academicSettingApi.updateCycle({ cycle_type: target, password });
        } catch (apiErr) {
          // If offline / demo mode fallback
          if (apiErr.status === 422 && apiErr.message) {
            setModalError(apiErr.message || 'Kata sandi verifikasi tidak valid.');
            setModalLoading(false);
            return;
          }
        }

        const now = new Date();
        const formattedDate = now.toISOString().replace('T', ' ').substring(0, 19);
        const newEntry = {
          id: Date.now(),
          from_cycle: activeCycle,
          to_cycle: target,
          changed_at: formattedDate,
          changed_by: 'Waka Kurikulum',
        };

        setHistoryList((prev) => [newEntry, ...prev]);
        setActiveCycle(target);
        setModalOpen(false);
        showFeedback(`Berhasil mengubah jadwal aktif menjadi Putaran ${target}.`);
      } else if (modalConfig.pendingAction?.type === 'upacara') {
        const nextStatus = modalConfig.pendingAction.target;
        try {
          await academicSettingApi.updateMondayStatus({ is_upacara: nextStatus, password });
        } catch (apiErr) {
          if (apiErr.status === 422 && apiErr.message) {
            setModalError(apiErr.message || 'Kata sandi verifikasi tidak valid.');
            setModalLoading(false);
            return;
          }
        }

        setMondayIsUpacara(nextStatus);
        setModalOpen(false);
        showFeedback(
          `Status Upacara Hari Senin berhasil diubah ke ${nextStatus ? 'AKTIF' : 'NONAKTIF'}.`
        );
      }
    } catch {
      setModalError('Terjadi kesalahan saat memproses permintaan.');
    } finally {
      setModalLoading(false);
    }
  };

  // Columns for Cycle History Log Table
  const historyColumns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      renderCell: (_, index) => (
        <span className="font-mono text-[12px] text-gray-400">
          {String(index + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'from_cycle',
      label: 'Dari Putaran',
      align: 'center',
      renderCell: (row) => <Badge variant="neutral">Putaran {row.from_cycle}</Badge>,
    },
    {
      key: 'to_cycle',
      label: 'Ke Putaran',
      align: 'center',
      renderCell: (row) => <Badge variant="default">Putaran {row.to_cycle}</Badge>,
    },
    {
      key: 'changed_at',
      label: 'Waktu Perubahan',
      align: 'left',
      renderCell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-gray-700">
          <Clock size={13} className="text-gray-400" />
          <span className="font-mono text-[12px] text-gray-700">{row.changed_at}</span>
        </span>
      ),
    },
    {
      key: 'changed_by',
      label: 'Diubah Oleh',
      align: 'left',
      renderCell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-gray-900 font-medium">
          <User size={13} className="text-gray-400" />
          {row.changed_by || 'Waka Kurikulum'}
        </span>
      ),
    },
  ];

  return (
    <div className="dashboard-container">
      {/* Feedback Toast */}
      {feedbackMessage && (
        <div className="dashboard-toast" role="status">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="dashboard-toast dashboard-toast--error" role="alert">
          <AlertCircle size={16} className="text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="dashboard-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="dashboard-title">Dashboard Akademik</h1>
          <p className="dashboard-subtitle">
            Kelola siklus putaran jadwal KBM, status upacara, dan kepatuhan jurnal sekolah.
          </p>
        </div>
        <div className="dashboard-header-actions w-full sm:w-auto flex justify-start sm:justify-end">
          <Button
            variant="primary"
            icon={Plus}
            className="w-full sm:w-auto"
            onClick={() => navigate('/web/upload-import')}
          >
            Import Jadwal PDF
          </Button>
        </div>
      </div>

      {/* Overview Cards Row */}
      <div className="dashboard-cards-grid">
        {/* Card 1: Putaran Jadwal Aktif */}
        <div className="dashboard-flat-card">
          <div className="dashboard-card-top">
            <span className="dashboard-card-label">Putaran jadwal aktif</span>
            <Badge variant="default">Aktif: Putaran {activeCycle}</Badge>
          </div>
          <div className="dashboard-card-main-val">Putaran {activeCycle}</div>
          <p className="dashboard-card-desc">Siklus jadwal rotasi mingguan yang sedang berjalan.</p>
          <div className="dashboard-card-footer-controls">
            <div className="inline-flex items-center bg-gray-100 p-1 rounded-md gap-1 w-fit">
              <button
                type="button"
                className={`px-3 py-1 rounded text-[12px] transition-all cursor-pointer ${
                  activeCycle === 1
                    ? 'bg-white text-gray-900 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 font-normal'
                }`}
                onClick={() => handleRequestCycleChange(1)}
              >
                Putaran 1
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded text-[12px] transition-all cursor-pointer ${
                  activeCycle === 2
                    ? 'bg-white text-gray-900 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 font-normal'
                }`}
                onClick={() => handleRequestCycleChange(2)}
              >
                Putaran 2
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Status Upacara Hari Senin */}
        <div className="dashboard-flat-card">
          <div className="dashboard-card-top">
            <span className="dashboard-card-label">Upacara hari Senin</span>
            <Badge variant={mondayIsUpacara ? 'success' : 'neutral'}>
              {mondayIsUpacara ? 'Aktif' : 'Nonaktif'}
            </Badge>
          </div>
          <div className="dashboard-card-main-val">
            {mondayIsUpacara ? 'Upacara Aktif' : 'KBM Normal'}
          </div>
          <p className="dashboard-card-desc">
            {mondayIsUpacara
              ? 'Jam ke-1 dialokasikan untuk upacara bendera (mulai 08:00).'
              : 'Tidak ada upacara, KBM jam ke-1 dimulai normal (07:15).'}
          </p>
          <div className="dashboard-card-footer-controls">
            <Button variant="secondary" size="sm" onClick={handleRequestUpacaraToggle}>
              Ubah ke {mondayIsUpacara ? 'Nonaktif' : 'Aktif'}
            </Button>
          </div>
        </div>

        {/* Card 3: Rekap Kepatuhan Jurnal */}
        <div className="dashboard-flat-card">
          <div className="dashboard-card-top">
            <span className="dashboard-card-label">Jurnal hari ini</span>
            <Badge variant={missingJournals.length > 0 ? 'error' : 'success'}>
              {missingJournals.length > 0 ? `${missingJournals.length} Terlambat` : 'Lengkap'}
            </Badge>
          </div>
          <div className="dashboard-card-main-val flex items-baseline">
            <span className="text-[24px] font-semibold text-gray-900 tracking-tight">
              {missingJournals.length}
            </span>
            <span className="text-[13px] font-normal text-gray-600 ml-1">sesi belum diisi</span>
          </div>
          <p className="dashboard-card-desc">
            Monitoring keterlambatan pengisian jurnal KBM (&gt; 30 menit).
          </p>
          <div className="dashboard-card-footer-controls">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/web/schedules')}
            >
              Lihat Matriks Jadwal
            </Button>
          </div>
        </div>
      </div>

      {/* Section: Missing Journal Alert */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2 className="dashboard-section-title">Peringatan Keterlambatan Jurnal</h2>
            <p className="dashboard-section-desc">
              Daftar sesi KBM yang belum menyelesaikan jurnal mengajar hari ini (&gt; 30 menit).
            </p>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {missingJournals.length} sesi memerlukan perhatian
          </span>
        </div>

        <div className="dashboard-row-cards-list">
          {missingJournals.length === 0 ? (
            <div className="dashboard-empty-row">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>Seluruh guru pengampu telah mengisi jurnal KBM hari ini dengan lengkap.</span>
            </div>
          ) : (
            missingJournals.map((journal) => (
              <div
                key={journal.id}
                className="dashboard-row-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
              >
                <div className="dashboard-row-card-left flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">Kelas {journal.className}</Badge>
                  <span className="text-[13px] font-semibold text-gray-900">
                    {journal.teacherName}
                  </span>
                  <span className="text-[13px] font-normal text-gray-500">
                    &bull; {journal.subjectName}
                  </span>
                  <span className="text-[11px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                    {journal.period}
                  </span>
                </div>
                <div className="dashboard-row-card-right flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  <Badge variant="error">Belum Diisi</Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      showFeedback(`Pengingat KBM berhasil dikirimkan ke ${journal.teacherName}.`)
                    }
                  >
                    Kirim Pengingat
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Section: Cycle History Table */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2 className="dashboard-section-title">Riwayat Perubahan Putaran Jadwal</h2>
            <p className="dashboard-section-desc">
              Log audit pergantian siklus putaran jadwal aktif sekolah.
            </p>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Total {historyList.length} catatan
          </span>
        </div>

        <Table
          columns={historyColumns}
          data={historyList}
          emptyMessage="Belum ada riwayat perubahan putaran jadwal."
        />
      </div>

      {/* Password Confirmation Modal */}
      <PasswordModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalError('');
        }}
        onConfirm={handleConfirmPassword}
        title={modalConfig.title}
        description={modalConfig.description}
        loading={modalLoading}
        error={modalError}
      />
    </div>
  );
}
