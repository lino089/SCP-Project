import { ChevronLeft, ChevronRight } from 'lucide-react';
import './PaginationBar.css';

/**
 * Reusable Mobile PaginationBar
 * Compatible with web `Pagination` props
 */
export default function PaginationBar({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  perPage = 10,
  onPageChange,
  disabled = false,
  className = '',
}) {
  if (totalItems <= 0 && totalPages <= 1) return null;

  const startRecord = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const endRecord = Math.min(totalItems, currentPage * perPage);

  const handleSelect = (page) => {
    if (disabled || page < 1 || page > totalPages || page === currentPage) return;
    onPageChange?.(page);
  };

  return (
    <div className={`pagination-bar ${className}`.trim()}>
      <span className="pagination-bar__info">
        Data{' '}
        <span className="font-mono text-[var(--color-text-primary)] font-semibold">
          {String(startRecord).padStart(2, '0')}-{String(endRecord).padStart(2, '0')}
        </span>{' '}
        dari <span className="font-mono text-[var(--color-text-primary)] font-semibold">{totalItems}</span>
      </span>

      {totalPages > 1 && (
        <div className="pagination-bar__controls">
          <button
            type="button"
            className="pagination-bar__btn"
            disabled={disabled || currentPage <= 1}
            onClick={() => handleSelect(currentPage - 1)}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="pagination-bar__page-indicator font-mono">
            {String(currentPage).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
          </span>

          <button
            type="button"
            className="pagination-bar__btn"
            disabled={disabled || currentPage >= totalPages}
            onClick={() => handleSelect(currentPage + 1)}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
