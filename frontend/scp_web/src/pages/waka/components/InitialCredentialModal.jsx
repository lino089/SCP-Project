import { useState } from 'react';
import { KeyRound, Copy, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import Button from '../../../components/shared/Button';
import './InitialCredentialModal.css';

/**
 * Modal Kredensial Awal Akun Baru
 * Menampilkan kata sandi acak hasil auto-provisioning backend
 * Dilengkapi fitur salin instan dan proteksi penutupan tidak sengaja.
 */
export default function InitialCredentialModal({
  isOpen = false,
  onClose,
  data = null, // { type: 'teacher' | 'student', teacher, student, parent, password }
}) {
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const isTeacher = data.type === 'teacher';
  const teacher = data.teacher || {};
  const student = data.student || {};
  const parent = data.parent || {};
  const password = data.password || data.generate_password || '********';

  // Format teks untuk disalin ke clipboard
  const getCopyText = () => {
    if (isTeacher) {
      return `[Kredensial Akun - Guru Baru]
Nama: ${teacher.name || '-'}
NIP / Username: ${teacher.nis_nip || teacher.nip || '-'}
FET Staff ID: ${teacher.fet_staff_id || '-'}
Kata Sandi Awal: ${password}
Status: Wajib Ganti Password saat login perdana.`;
    }
    return `[Kredensial Akun - Siswa & Orang Tua]
--- AKUN SISWA ---
Nama: ${student.name || '-'}
NIS: ${student.nis_nip || student.nis || '-'}
Kelas: ${student.schoolClass?.name || student.className || '-'}
Kata Sandi Awal: ${password}

--- AKUN ORANG TUA / WALI ---
Nama: ${parent.name || `Wali dari ${student.name}`}
Username: ${parent.nis_nip || `P-${student.nis_nip || student.nis}`}
Kata Sandi Awal: ${password}
Status: Wajib Ganti Password saat login perdana.`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getCopyText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback manual copy
      const textarea = document.createElement('textarea');
      textarea.value = getCopyText();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={null} // Disallow clicking X to close without acknowledgment
      closeOnOverlayClick={false}
      closeOnEsc={false}
      size="md"
      title="Kredensial Akun Baru Diterbitkan"
      footer={
        <div className="credential-modal__footer">
          <Button
            variant="secondary"
            icon={copied ? Check : Copy}
            onClick={handleCopy}
            className={copied ? 'btn--copied' : ''}
          >
            {copied ? 'Tersalin ke Clipboard!' : 'Salin Kredensial'}
          </Button>
          <Button variant="primary" icon={ShieldCheck} onClick={onClose}>
            Saya Telah Menyalin Kredensial
          </Button>
        </div>
      }
    >
      <div className="credential-modal__content">
        <div className="credential-modal__banner">
          <div className="credential-modal__icon">
            <KeyRound size={22} />
          </div>
          <div className="credential-modal__banner-text">
            <h4>Simpan Informasi Kredensial Ini</h4>
            <p>
              Kata sandi di bawah dibuat otomatis oleh sistem dan <strong>tidak akan ditampilkan kembali</strong>. Pengguna wajib mengganti kata sandi pada login pertama.
            </p>
          </div>
        </div>

        {isTeacher ? (
          <div className="credential-card">
            <div className="credential-card__header">
              <span className="credential-badge">Akun Guru</span>
              <span className="credential-user">{teacher.name}</span>
            </div>
            <div className="credential-card__grid">
              <div className="credential-field">
                <span className="credential-field__label">NIP / ID Login</span>
                <span className="credential-field__value font-mono">
                  {teacher.nis_nip || teacher.nip || '-'}
                </span>
              </div>
              <div className="credential-field">
                <span className="credential-field__label">FET Staff ID</span>
                <span className="credential-field__value font-mono">
                  {teacher.fet_staff_id || '-'}
                </span>
              </div>
              <div className="credential-field credential-field--full credential-field--highlight">
                <span className="credential-field__label">Kata Sandi Awal</span>
                <div className="credential-field__password-box">
                  <span className="font-mono text-lg font-bold">{password}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Akun Siswa */}
            <div className="credential-card">
              <div className="credential-card__header">
                <span className="credential-badge credential-badge--student">Akun Siswa</span>
                <span className="credential-user">{student.name}</span>
              </div>
              <div className="credential-card__grid">
                <div className="credential-field">
                  <span className="credential-field__label">NIS / Username</span>
                  <span className="credential-field__value font-mono">
                    {student.nis_nip || student.nis || '-'}
                  </span>
                </div>
                <div className="credential-field">
                  <span className="credential-field__label">Kelas</span>
                  <span className="credential-field__value">
                    {student.schoolClass?.name || student.className || '-'}
                  </span>
                </div>
                <div className="credential-field credential-field--full credential-field--highlight">
                  <span className="credential-field__label">Kata Sandi Siswa</span>
                  <div className="credential-field__password-box">
                    <span className="font-mono text-lg font-bold">{password}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Akun Orang Tua */}
            <div className="credential-card">
              <div className="credential-card__header">
                <span className="credential-badge credential-badge--parent">Akun Orang Tua</span>
                <span className="credential-user">
                  {parent.name || `Wali dari ${student.name}`}
                </span>
              </div>
              <div className="credential-card__grid">
                <div className="credential-field">
                  <span className="credential-field__label">Username Ortu (P-NIS)</span>
                  <span className="credential-field__value font-mono">
                    {parent.nis_nip || `P-${student.nis_nip || student.nis}`}
                  </span>
                </div>
                <div className="credential-field credential-field--full credential-field--highlight">
                  <span className="credential-field__label">Kata Sandi Orang Tua</span>
                  <div className="credential-field__password-box">
                    <span className="font-mono text-lg font-bold">{password}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="credential-modal__note">
          <AlertTriangle size={15} />
          <span>Pastikan kredensial telah diserahkan langsung kepada pihak yang bersangkutan secara aman.</span>
        </div>
      </div>
    </Modal>
  );
}
