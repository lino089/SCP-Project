import { useState } from 'react';
import { UserCheck, ShieldAlert, Trash2, Plus, AlertCircle } from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import Button from '../../../components/shared/Button';
import Select from '../../../components/shared/Select';
import Badge from '../../../components/shared/Badge';
import './TeacherAssignmentModal.css';

/**
 * Modal Penugasan Tambahan Guru
 * Mengelola penugasan Guru Piket Kesiswaan dan Wali Kelas
 */
export default function TeacherAssignmentModal({
  isOpen = false,
  onClose,
  teacher = null,
  classList = [],
  onAssign,
  onRevoke,
  isLoading = false,
}) {
  const [type, setType] = useState('kesiswaan');
  const [classId, setClassId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!teacher) return null;

  const assignments = teacher.assignments || [];

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (type === 'wali_kelas' && !classId) {
      setErrorMessage('Silakan pilih kelas untuk penugasan wali kelas.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onAssign?.(teacher.id, {
        type,
        class_id: type === 'wali_kelas' ? Number(classId) : null,
      });
      // Reset form on success
      setClassId('');
    } catch (err) {
      setErrorMessage(err.message || 'Gagal menambahkan tugas tambahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeClick = async (assignmentId) => {
    try {
      setIsSubmitting(true);
      setErrorMessage('');
      await onRevoke?.(teacher.id, assignmentId);
    } catch (err) {
      setErrorMessage(err.message || 'Gagal mencabut penugasan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Kelola Tugas Tambahan Guru"
      footer={
        <div className="flex justify-end w-full">
          <Button variant="secondary" onClick={onClose}>
            Selesai
          </Button>
        </div>
      }
    >
      <div className="teacher-assignment__content">
        {/* Guru Info Card */}
        <div className="teacher-assignment__teacher-card">
          <div className="teacher-assignment__avatar">
            <UserCheck size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900">{teacher.name}</h4>
            <p className="text-xs text-neutral-500">
              NIP: {teacher.nis_nip || teacher.nip || '-'} &bull; FET Staff ID:{' '}
              {teacher.fet_staff_id || '-'}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="assignment-error-alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Active Assignments */}
        <div className="teacher-assignment__section">
          <h5 className="teacher-assignment__section-title">Penugasan Aktif</h5>
          {assignments.length === 0 ? (
            <p className="text-xs text-neutral-400 italic py-2">
              Guru ini belum memiliki tugas tambahan aktif.
            </p>
          ) : (
            <div className="teacher-assignment__list">
              {assignments.map((asgn) => {
                const isWali = asgn.type === 'wali_kelas';
                const className = asgn.school_class?.name || asgn.schoolClass?.name || (typeof asgn.class_id === 'number' ? `Kelas #${asgn.class_id}` : '');

                return (
                  <div key={asgn.id || asgn.type} className="assignment-item">
                    <div className="flex items-center gap-2">
                      <Badge variant={isWali ? 'primary' : 'warning'}>
                        {isWali ? 'Wali Kelas' : 'Guru Kesiswaan'}
                      </Badge>
                      {isWali && (
                        <span className="text-sm font-medium text-neutral-800">
                          {className || 'Semua Kelas'}
                        </span>
                      )}
                    </div>
                    {asgn.id && (
                      <button
                        type="button"
                        className="assignment-item__revoke-btn"
                        onClick={() => handleRevokeClick(asgn.id)}
                        disabled={isSubmitting || isLoading}
                        title="Cabut penugasan"
                      >
                        <Trash2 size={15} />
                        <span>Cabut</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Assignment Form */}
        <form onSubmit={handleAssignSubmit} className="teacher-assignment__form">
          <h5 className="teacher-assignment__section-title">Tambah Penugasan Baru</h5>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Select
                label="Jenis Tugas Tambahan"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setErrorMessage('');
                }}
                options={[
                  { value: 'kesiswaan', label: 'Guru Piket Kesiswaan' },
                  { value: 'wali_kelas', label: 'Wali Kelas' },
                ]}
              />
            </div>

            {type === 'wali_kelas' && (
              <div>
                <Select
                  label="Pilih Rombel Kelas"
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setErrorMessage('');
                  }}
                  options={[
                    { value: '', label: '-- Pilih Kelas --' },
                    ...classList.map((c) => ({
                      value: String(c.id),
                      label: `${c.name} (Tingkat ${c.level || c.grade})`,
                    })),
                  ]}
                />
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              icon={Plus}
              loading={isSubmitting || isLoading}
              disabled={isSubmitting || isLoading}
            >
              Simpan Tugas Tambahan
            </Button>
          </div>
        </form>

        <div className="teacher-assignment__hint">
          <ShieldAlert size={14} />
          <span>
            Setiap rombel kelas hanya dapat memiliki 1 wali kelas aktif. Guru kesiswaan memiliki hak akses untuk memverifikasi perizinan siswa.
          </span>
        </div>
      </div>
    </Modal>
  );
}
