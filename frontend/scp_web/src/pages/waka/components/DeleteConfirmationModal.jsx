import { useState, useEffect } from 'react';
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Loader2,
  Info,
  AlertCircle,
} from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import Button from '../../../components/shared/Button';
import Input from '../../../components/shared/Input';
import Badge from '../../../components/shared/Badge';
import { recycleBinApi } from '../../../services/masterDataApi';
import './DeleteConfirmationModal.css';

const ENTITY_LABELS = {
  guru: 'Guru',
  siswa: 'Siswa',
  kelas: 'Kelas',
  ruang: 'Ruangan',
  mapel: 'Mata Pelajaran',
};

const DEP_LABELS = {
  schedules: 'Jadwal Aktif',
  journals: 'Jurnal KBM',
  attendances: 'Presensi Siswa',
  quizzes: 'Kuis Dibuat',
  quiz_submissions: 'Pengerjaan Kuis',
  leave_requests: 'Pengajuan Izin',
  teacher_assignments: 'Tugas Tambahan',
  students: 'Siswa Terdaftar',
  users: 'Pengguna Terkait',
};

/**
 * Smart Delete Confirmation Modal
 * Menyediakan opsi Pemindahan ke Tempat Sampah (30 Hari) vs Hapus Permanen Paksa dengan verifikasi password.
 */
export default function DeleteConfirmationModal({
  isOpen = false,
  onClose,
  entityType = 'guru',
  item = null,
  onSoftDelete,
  onForceDelete,
  loading = false,
  serverError = '',
}) {
  const [actionType, setActionType] = useState('soft'); // 'soft' | 'force'
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [depData, setDepData] = useState(null);
  const [depError, setDepError] = useState('');

  // Fetch dependencies when opened
  useEffect(() => {
    if (!isOpen || !item?.id) return;

    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCheckingDeps(true);

    recycleBinApi
      .checkDependencies(entityType, item.id)
      .then((res) => {
        if (isMounted && res?.data) {
          setDepData(res.data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setDepError(err?.message || 'Gagal memuat status ketergantungan data.');
        }
      })
      .finally(() => {
        if (isMounted) setIsCheckingDeps(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, item?.id, entityType]);

  const handleClose = () => {
    if (loading) return;
    setActionType('soft');
    setPassword('');
    setLocalError('');
    setDepData(null);
    setDepError('');
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLocalError('');

    if (actionType === 'force') {
      if (!password.trim()) {
        setLocalError('Kata sandi wajib diisi untuk verifikasi hapus permanen.');
        return;
      }
      try {
        await onForceDelete?.(item, password);
      } catch (err) {
        setLocalError(err?.response?.data?.message || err?.message || 'Gagal menghapus data secara permanen.');
      }
    } else {
      try {
        await onSoftDelete?.(item);
      } catch (err) {
        setLocalError(err?.response?.data?.message || err?.message || 'Gagal memindahkan data ke tempat sampah.');
      }
    }
  };

  const entityTitle = ENTITY_LABELS[entityType] || 'Data';
  const itemName = item?.name || '-';
  const itemIdentifier = item?.nis_nip || item?.code || (item?.level ? `Tingkat ${item.level}` : '');
  const activeError = localError || serverError;

  return (
    <Modal
      key={isOpen ? `delete-modal-${item?.id}` : 'closed'}
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      title={`Hapus ${entityTitle}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Batal
          </Button>
          <div className="flex items-center gap-2">
            {actionType === 'soft' ? (
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                className="bg-amber-600 hover:bg-amber-700 text-white border-none"
              >
                <Clock size={16} className="mr-1.5" />
                Pindahkan ke Tempat Sampah
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={handleSubmit}
                loading={loading}
                disabled={!password.trim()}
              >
                <Trash2 size={16} className="mr-1.5" />
                Hapus Permanen Sekarang
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="delete-modal">
        {/* Target Entity Box */}
        <div className="delete-modal__target-box">
          <div className="delete-modal__target-info">
            <span className="delete-modal__target-name">{itemName}</span>
            {itemIdentifier && (
              <span className="delete-modal__target-meta">ID / Identitas: {itemIdentifier}</span>
            )}
          </div>
          <Badge variant="secondary">{entityTitle}</Badge>
        </div>

        {/* Live Dependency Analysis Box */}
        {isCheckingDeps ? (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-600">
            <Loader2 size={16} className="animate-spin text-amber-500" />
            <span>Memeriksa relasi data aktif dan historis...</span>
          </div>
        ) : depError ? (
          <div className="delete-modal__deps-box delete-modal__deps-box--error">
            <div className="delete-modal__deps-header">
              <AlertCircle size={16} />
              <span>Gagal Menganalisis Ketergantungan</span>
            </div>
            <p className="text-xs">{depError}</p>
          </div>
        ) : depData ? (
          <div
            className={`delete-modal__deps-box ${
              depData.total_dependencies > 0
                ? 'delete-modal__deps-box--warning'
                : 'delete-modal__deps-box--clean'
            }`}
          >
            <div className="delete-modal__deps-header">
              {depData.total_dependencies > 0 ? (
                <>
                  <AlertTriangle size={16} />
                  <span>
                    Terdeteksi {depData.total_dependencies} Relasi Data Terkait
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Aman Dihapus: Tidak Memiliki Keterikatan Data</span>
                </>
              )}
            </div>

            <p className="text-xs leading-relaxed">{depData.summary_text}</p>

            {depData.dependencies_count && Object.keys(depData.dependencies_count).length > 0 && (
              <div className="delete-modal__deps-breakdown">
                {Object.entries(depData.dependencies_count).map(([key, count]) => (
                  <span key={key} className="delete-modal__deps-badge">
                    <strong>{DEP_LABELS[key] || key}:</strong> {count}
                  </span>
                ))}
              </div>
            )}

            {depData.has_legal_history && (
              <div className="delete-modal__archive-alert">
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Catatan Integritas Arsip:</strong> Entitas ini memiliki catatan historis sekolah (Jurnal KBM, Presensi, atau Nilai). Jika dilakukan Hapus Paksa, sistem akan mengarsipkan dan menganonimkan identitas agar rapor dan rekam jejak legal tetap utuh.
                </span>
              </div>
            )}
          </div>
        ) : null}

        {/* Error Banner if any */}
        {activeError && (
          <div className="delete-modal__error-banner" role="alert">
            <AlertCircle size={16} className="shrink-0" />
            <span>{activeError}</span>
          </div>
        )}

        {/* Action Selection (Radio Cards) */}
        <div>
          <div className="delete-modal__options-title">Pilih Metode Penghapusan:</div>
          <div className="delete-modal__options-list">
            {/* OPSI A: Soft Delete (Tempat Sampah) */}
            <label
              className={`delete-modal__card ${
                actionType === 'soft' ? 'delete-modal__card--active-soft' : ''
              }`}
            >
              <input
                type="radio"
                name="deleteActionType"
                value="soft"
                checked={actionType === 'soft'}
                onChange={() => setActionType('soft')}
                className="delete-modal__radio"
              />
              <div className="delete-modal__card-content">
                <div className="delete-modal__card-header">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-amber-600" />
                    <span className="delete-modal__card-title">
                      Pindahkan ke Tempat Sampah (30 Hari)
                    </span>
                  </div>
                  <span className="delete-modal__badge-recommended">Direkomendasikan</span>
                </div>
                <p className="delete-modal__card-desc">
                  Data dinonaktifkan dari jadwal dan sistem aktif, namun tersimpan aman di Tempat Sampah selama 30 hari. Anda dapat memulihkannya (<em>restore</em>) kapan saja jika diperlukan.
                </p>
              </div>
            </label>

            {/* OPSI B: Force Delete */}
            <label
              className={`delete-modal__card ${
                actionType === 'force' ? 'delete-modal__card--active-force' : ''
              }`}
            >
              <input
                type="radio"
                name="deleteActionType"
                value="force"
                checked={actionType === 'force'}
                onChange={() => setActionType('force')}
                className="delete-modal__radio delete-modal__radio--force"
              />
              <div className="delete-modal__card-content">
                <div className="delete-modal__card-header">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={16} className="text-rose-600" />
                    <span className="delete-modal__card-title">
                      Hapus Bersih & Paksa (Permanen)
                    </span>
                  </div>
                  <span className="delete-modal__badge-danger">Kritis</span>
                </div>
                <p className="delete-modal__card-desc">
                  Menghapus data seketika tanpa masa simpan. Cocok untuk data uji coba atau kesalahan input. Jika memiliki riwayat KBM, data otomatis dianonimkan agar integritas dokumen sekolah tetap terjaga.
                </p>

                {actionType === 'force' && (
                  <div className="delete-modal__password-section" onClick={(e) => e.stopPropagation()}>
                    <div className="delete-modal__password-alert">
                      <AlertTriangle size={15} />
                      <span>Diperlukan verifikasi kata sandi akun Anda untuk melanjutkan tindakan kritis ini.</span>
                    </div>
                    <Input
                      type="password"
                      label="Kata Sandi Akun Anda"
                      placeholder="Masukkan kata sandi Anda..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
