import { AlertTriangle, RotateCcw } from 'lucide-react';
import Button from '../shared/Button';
import './ErrorState.css';

/**
 * Error state with retry action
 */
export default function ErrorState({
  title = 'Terjadi Kesalahan',
  message = 'Gagal memuat data dari server. Silakan periksa koneksi atau coba beberapa saat lagi.',
  onRetry = null,
  retryLabel = 'Coba Lagi',
  className = '',
}) {
  return (
    <div className={`error-state ${className}`.trim()} role="alert">
      <div className="error-state__icon-wrapper">
        <AlertTriangle size={24} strokeWidth={2} />
      </div>
      <h3 className="error-state__title">{title}</h3>
      {message && <p className="error-state__message">{message}</p>}

      {onRetry && (
        <div className="error-state__action">
          <Button variant="secondary" size="md" icon={RotateCcw} onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
