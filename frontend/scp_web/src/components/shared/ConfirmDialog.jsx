import { AlertCircle, HelpCircle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import './ConfirmDialog.css';

/**
 * Shared Confirmation Dialog for critical actions
 */
export default function ConfirmDialog({
  isOpen = false,
  onClose,
  onConfirm,
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  confirmVariant = 'danger', // danger or primary
  loading = false,
  children = null,
}) {
  const Icon = confirmVariant === 'danger' ? AlertCircle : HelpCircle;

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={loading}>
        {cancelLabel}
      </Button>
      <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
        {confirmLabel}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={footer}
    >
      <div className="confirm-dialog__content">
        <div
          className={`confirm-dialog__icon-wrapper confirm-dialog__icon-wrapper--${confirmVariant}`}
        >
          <Icon size={22} strokeWidth={2} />
        </div>
        <p className="confirm-dialog__message">{message}</p>
        {children}
      </div>
    </Modal>
  );
}
