import { AlertTriangle, Info } from 'lucide-react';
import BottomSheetModal from './BottomSheetModal';
import Button from './Button';
import './ConfirmSheet.css';

/**
 * ConfirmSheet — Mobile Bottom-Sheet Confirmation Dialog
 * Compatible with web `ConfirmDialog` props
 */
export default function ConfirmSheet({
  isOpen = false,
  onClose,
  onConfirm,
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger', // 'danger' | 'warning' | 'primary'
  loading = false,
}) {
  const isDanger = variant === 'danger';

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      title={title}
      size="sm"
      footer={
        <div className="confirm-sheet__footer">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="confirm-sheet__content">
        <div
          className={[
            'confirm-sheet__icon',
            isDanger ? 'confirm-sheet__icon--danger' : 'confirm-sheet__icon--warning',
          ].join(' ')}
        >
          {isDanger ? <AlertTriangle size={22} /> : <Info size={22} />}
        </div>
        <div className="confirm-sheet__text">
          <p className="confirm-sheet__message">{message}</p>
        </div>
      </div>
    </BottomSheetModal>
  );
}
