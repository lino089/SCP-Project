import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Button from '../shared/Button';
import './ForbiddenState.css';

export default function ForbiddenState({
  title = 'Akses Dibatasi',
  message = 'Anda tidak memiliki hak akses (otorisasi) untuk melihat halaman atau melakukan tindakan ini.',
  onBack,
  backLabel = 'Kembali ke Beranda',
  className = '',
}) {
  return (
    <div className={`forbidden-state ${className}`.trim()} role="alert">
      <div className="forbidden-state__icon-wrapper" aria-hidden="true">
        <ShieldAlert size={26} strokeWidth={2} />
      </div>
      <span className="forbidden-state__code">HTTP 403 — FORBIDDEN</span>
      <h3 className="forbidden-state__title">{title}</h3>
      <p className="forbidden-state__message">{message}</p>
      {onBack && (
        <div className="forbidden-state__action">
          <Button variant="secondary" size="md" icon={ArrowLeft} onClick={onBack}>
            {backLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
