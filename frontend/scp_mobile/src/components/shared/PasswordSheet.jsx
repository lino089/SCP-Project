import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import BottomSheetModal from './BottomSheetModal';
import Input from './Input';
import Button from './Button';
import { authConfirmApi } from '../../services/masterDataApi';
import './PasswordSheet.css';

/**
 * PasswordSheet — Mobile Bottom-Sheet Password Re-authentication
 * Compatible with web `PasswordModal` props:
 * Supports both automatic verification via `/api/confirm-password` or custom `onConfirm(password)` handler.
 */
export default function PasswordSheet({
  isOpen = false,
  onClose,
  onConfirm,
  title = 'Konfirmasi Keamanan',
  description = 'Masukkan kata sandi akun Anda untuk melanjutkan tindakan sensitif ini.',
  confirmLabel = 'Verifikasi & Lanjutkan',
  cancelLabel = 'Batal',
  loading: externalLoading = false,
  isLoading, // alias used by page call sites (D-9)
  errorMessage = '', // server-side error surfaced by the caller (D-9)
  verifyWithBackend = false,
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [internalLoading, setInternalLoading] = useState(false);

  const isBusy = Boolean(externalLoading || isLoading || internalLoading);
  const shownError = error || errorMessage;

  const handleClose = () => {
    if (isBusy) return;
    setPassword('');
    setError('');
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Kata sandi wajib diisi.');
      return;
    }

    setError('');
    setInternalLoading(true);

    try {
      if (verifyWithBackend) {
        await authConfirmApi.confirmPassword(password);
      }
      await onConfirm?.(password);
      setPassword('');
    } catch (err) {
      setError(err?.message || 'Kata sandi yang Anda masukkan tidak valid.');
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="sm"
      footer={
        <div className="password-sheet__footer">
          <Button
            variant="outline"
            size="md"
            onClick={handleClose}
            disabled={isBusy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            form="password-sheet-form"
            variant="primary"
            size="md"
            loading={isBusy}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <form id="password-sheet-form" onSubmit={handleSubmit} className="password-sheet__body">
        <div className="password-sheet__banner">
          <div className="password-sheet__icon">
            <ShieldCheck size={20} />
          </div>
          <p className="password-sheet__desc">{description}</p>
        </div>

        <Input
          id="confirm-security-password"
          type="password"
          label="Kata Sandi Akun"
          placeholder="Masukkan kata sandi Anda..."
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError('');
          }}
          error={shownError}
          disabled={isBusy}
          autoFocus
          required
        />
      </form>
    </BottomSheetModal>
  );
}
