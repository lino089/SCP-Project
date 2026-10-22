import { useState } from 'react';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import './PasswordModal.css';

/**
 * Shared Password Confirmation Modal
 */
export default function PasswordModal({
  isOpen = false,
  onClose,
  onConfirm,
  title = 'Konfirmasi Kata Sandi',
  description = 'Masukkan kata sandi akun Anda untuk mengonfirmasi tindakan penting ini.',
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  confirmVariant = 'primary',
  loading = false,
  serverError = '',
}) {
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!password.trim()) {
      setLocalError('Kata sandi wajib diisi');
      return;
    }
    setLocalError('');
    onConfirm?.(password);
  };

  const handleClose = () => {
    setPassword('');
    setLocalError('');
    onClose?.();
  };

  const displayedError = serverError || localError;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={confirmVariant} onClick={handleSubmit} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="password-modal__form">
        {description && (
          <p className="password-modal__description">{description}</p>
        )}
        <Input
          type="password"
          label="Kata Sandi"
          placeholder="Masukkan kata sandi"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (localError) setLocalError('');
          }}
          error={displayedError}
          required
          autoFocus
        />
      </form>
    </Modal>
  );
}
