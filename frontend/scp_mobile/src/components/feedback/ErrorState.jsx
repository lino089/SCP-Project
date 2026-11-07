import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from '../shared/Button';
import './ErrorState.css';

export default function ErrorState({
  title = 'Gagal memuat data',
  message = 'Terjadi kendala saat menghubungkan ke server. Silakan periksa koneksi Anda dan coba kembali.',
  onRetry,
  retryLabel = 'Coba Lagi',
  className = '',
}) {
  return (
    <div className={`error-state ${className}`.trim()} role="alert">
      <div className="error-state__icon-wrapper" aria-hidden="true">
        <AlertCircle size={22} strokeWidth={2} />
      </div>
      <h4 className="error-state__title">{title}</h4>
      <p className="error-state__message">{message}</p>
      {onRetry && (
        <div className="error-state__action">
          <Button variant="outline" size="md" icon={RefreshCw} onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
