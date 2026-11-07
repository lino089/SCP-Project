import { Inbox } from 'lucide-react';
import Button from '../shared/Button';
import './EmptyState.css';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Belum ada data tersedia',
  description,
  message, // legacy alias (D-9)
  actionLabel = '',
  onAction,
  actionIcon,
  compact = false,
  className = '',
}) {
  const resolvedDescription =
    description ?? message ?? 'Data yang Anda cari belum tersedia atau belum ditambahkan ke dalam sistem.';

  return (
    <div
      className={['empty-state', compact ? 'empty-state--compact' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="empty-state__icon-wrapper" aria-hidden="true">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <h4 className="empty-state__title">{title}</h4>
      {resolvedDescription && (
        <p className="empty-state__description">{resolvedDescription}</p>
      )}
      {actionLabel && onAction && (
        <div className="empty-state__action">
          <Button variant="primary" size="md" icon={actionIcon} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
