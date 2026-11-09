import './DataTable.css';

/**
 * DataTable — tabel data mobile (maks. 3 kolom visual).
 *
 * Kolom: { key, label, width?, align? : 'left'|'center'|'right' }
 * Baris : renderRow(item, index) => <tr>...</tr>
 *
 * Sel utama memakai dua baris:
 *   <span className="data-table__cell-title">Nama</span>
 *   <span className="data-table__cell-meta">NIP · email</span>
 */
export default function DataTable({
  columns = [],
  rows = [],
  renderRow,
  isLoading = false,
  skeletonRows = 6,
  empty = null,
  zebra = true,
  className = '',
  footer = null,
  ariaLabel = 'Tabel data',
  minWidth,
}) {
  const colCount = columns.length || 1;
  const showSkeleton = isLoading && rows.length === 0;

  return (
    <div className={`data-table ${zebra ? 'data-table--zebra' : ''} ${className}`.trim()}>
      <table aria-label={ariaLabel} style={minWidth ? { minWidth } : undefined}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={`data-table__th data-table__th--${col.align || 'left'}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {showSkeleton &&
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={`sk-${i}`} className="data-table__skeleton-row">
                <td colSpan={colCount}>
                  <span className="data-table__skeleton-bar" />
                </td>
              </tr>
            ))}

          {!showSkeleton &&
            rows.map((item, index) => renderRow?.(item, index))}

          {!showSkeleton && rows.length === 0 && (
            <tr>
              <td colSpan={colCount} className="data-table__empty">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {footer && <div className="data-table__footer">{footer}</div>}
    </div>
  );
}