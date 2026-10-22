import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Button from '../shared/Button';
import './ForbiddenState.css';

/**
 * 403 Forbidden Access State component
 */
export default function ForbiddenState({
  title = 'Akses Ditolak',
  message = 'Anda tidak memiliki hak akses atau wewenang untuk membuka halaman ini.',
  onBack = null,
  backLabel = 'Kembali ke Dashboard',
  className = '',
}) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  return (
    <div className={`forbidden-state ${className}`.trim()} role="alert">
      <div className="forbidden-state__icon-wrapper">
        <ShieldAlert size={28} strokeWidth={2} />
      </div>
      <div className="forbidden-state__code">403 FORBIDDEN</div>
      <h2 className="forbidden-state__title">{title}</h2>
      <p className="forbidden-state__message">{message}</p>

      <div className="forbidden-state__action">
        <Button variant="primary" size="md" icon={ArrowLeft} onClick={handleBack}>
          {backLabel}
        </Button>
      </div>
    </div>
  );
}
