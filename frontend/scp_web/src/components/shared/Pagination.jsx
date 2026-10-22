import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

/**
 * Reusable Pagination Bar for Server-side & Client-side data
 */
export default function Pagination({
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

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className={`pagination-container ${className}`.trim()}>
      <span className="pagination-info">
        Menampilkan{' '}
        <span className="font-mono text-gray-900 font-medium">
          {String(startRecord).padStart(2, '0')}-{String(endRecord).padStart(2, '0')}
        </span>{' '}
        dari <span className="font-mono text-gray-900 font-medium">{totalItems}</span> data
      </span>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-btn"
            disabled={disabled || currentPage <= 1}
            onClick={() => handleSelect(currentPage - 1)}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft size={15} />
          </button>

          {getPageNumbers().map((num) => (
            <button
              key={num}
              type="button"
              disabled={disabled}
              className={`pagination-btn font-mono text-[11px] ${
                currentPage === num ? 'pagination-btn--active' : ''
              }`}
              onClick={() => handleSelect(num)}
            >
              {String(num).padStart(2, '0')}
            </button>
          ))}

          <button
            type="button"
            className="pagination-btn"
            disabled={disabled || currentPage >= totalPages}
            onClick={() => handleSelect(currentPage + 1)}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
