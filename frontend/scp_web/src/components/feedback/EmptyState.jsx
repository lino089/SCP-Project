import { Inbox, SearchX } from 'lucide-react';
import Button from '../shared/Button';
import './EmptyState.css';

/**
 * Contextual Empty State component
 * @param {'default'|'search'} type - Skenario state kosong
 */
export default function EmptyState({
  type = 'default',
  icon = null,
  title = '',
  description = '',
  actionLabel = '',
  onAction = null,
  actionButton = null,
  compact = false,
  className = '',
}) {
  const isSearch = type === 'search';
  const Icon = icon || (isSearch ? SearchX : Inbox);
  const displayTitle = title || (isSearch ? 'Pencarian Tidak Ditemukan' : 'Belum Ada Data');
  const displayDesc =
    description ||
    (isSearch
      ? 'Tidak ada data yang cocok dengan kriteria pencarian atau filter Anda.'
      : 'Data saat ini masih kosong atau belum dibuat.');

  return (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''} ${className}`.trim()}>
      <div className="empty-state__icon-wrapper">
        <Icon size={24} strokeWidth={1.8} />
      </div>
      <h3 className="empty-state__title">{displayTitle}</h3>
      {displayDesc && <p className="empty-state__description">{displayDesc}</p>}

      {actionButton ? (
        <div className="empty-state__action">{actionButton}</div>
      ) : actionLabel && onAction ? (
        <div className="empty-state__action">
          <Button variant="secondary" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
