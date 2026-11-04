import { useState } from 'react';
import SkeletonRow from '../feedback/SkeletonRow';
import Pagination from './Pagination';
import './Table.css';

/**
 * Enhanced Shared Table Component with Skeleton Loading, Unified Pagination & Row Selection
 */
export default function Table({
  columns = [], // [{ key, label, align: 'left'|'right'|'center', renderCell: (row, index) => ... }]
  data = [],
  rowKey = 'id',
  isLoading = false,
  pageSize = null, // enables client-side pagination if onPageChange is omitted
  currentPage = null,
  totalPages = null,
  totalItems = null,
  onPageChange = null,
  pagination = null, // { currentPage, totalPages, totalItems, perPage, onPageChange }
  emptyMessage = 'Tidak ada data ditemukan.',
  emptyComponent = null,
  className = '',
  // Selection Props
  selectable = false,
  selectedRowKeys = [],
  onSelectRow = null, // (key, isChecked, row) => void
  onSelectAllCurrentPage = null, // (currentPageKeys, willSelectAll) => void
  onSelectAllData = null, // () => void
  onDeselectAll = null, // () => void
  selectionLabel = 'data',
}) {
  // Resolve pagination props whether passed individually or via pagination object
  const effOnPageChange = pagination?.onPageChange ?? onPageChange;
  const isServerPaged = effOnPageChange !== null && (pagination?.totalPages ?? totalPages) !== null;
  const isClientPaged = (pagination?.perPage ?? pageSize) && !isServerPaged;

  const [internalPage, setInternalPage] = useState(1);
  const activePage = isServerPaged
    ? (pagination?.currentPage ?? currentPage ?? 1)
    : internalPage;

  const totalRecords = isServerPaged
    ? (pagination?.totalItems ?? totalItems ?? data.length)
    : data.length;

  const effectivePageSize = pagination?.perPage ?? pageSize ?? totalRecords ?? 10;
  const computedTotalPages = isServerPaged
    ? (pagination?.totalPages ?? totalPages ?? 1)
    : Math.max(1, Math.ceil(totalRecords / effectivePageSize));

  const clampedPage = isClientPaged
    ? Math.max(1, Math.min(internalPage, computedTotalPages))
    : activePage;

  const displayData = isClientPaged
    ? data.slice((clampedPage - 1) * effectivePageSize, clampedPage * effectivePageSize)
    : data;

  const handlePageSelect = (page) => {
    if (page < 1 || page > computedTotalPages || page === clampedPage) return;
    if (isServerPaged) {
      effOnPageChange?.(page);
    } else {
      setInternalPage(page);
    }
  };

  // Selection calculations
  const totalColumns = columns.length + (selectable ? 1 : 0);
  const pageKeys = displayData.map((row) => row[rowKey]);
  const isCurrentPageAllSelected =
    pageKeys.length > 0 && pageKeys.every((k) => selectedRowKeys.includes(k));
  const isCurrentPagePartiallySelected =
    pageKeys.some((k) => selectedRowKeys.includes(k)) && !isCurrentPageAllSelected;
  const isAllDataSelected =
    data.length > 0 && data.every((r) => selectedRowKeys.includes(r[rowKey]));

  return (
    <div className={`table-container ${className}`.trim()}>
      {/* Banner if all current page items are selected and there are more items across pages */}
      {selectable && isCurrentPageAllSelected && data.length > displayData.length && (
        <div className="table-selection-banner">
          {isAllDataSelected ? (
            <div className="table-selection-banner__content">
              <span>
                Seluruh <strong>{data.length}</strong> {selectionLabel} telah dipilih.
              </span>
              <button
                type="button"
                className="table-selection-banner__btn"
                onClick={onDeselectAll}
              >
                Batalkan Pilihan
              </button>
            </div>
          ) : (
            <div className="table-selection-banner__content">
              <span>
                Semua <strong>{displayData.length}</strong> {selectionLabel} pada halaman ini telah dipilih.
              </span>
              <button
                type="button"
                className="table-selection-banner__btn table-selection-banner__btn--primary"
                onClick={onSelectAllData}
              >
                Pilih semua {data.length} {selectionLabel}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="table-scroll-wrapper min-w-full">
          <table className="table-element min-w-full">
            <thead className="table-thead">
              <tr>
                {selectable && (
                  <th className="table-th table-th--selection whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      checked={isCurrentPageAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isCurrentPagePartiallySelected;
                      }}
                      onChange={() =>
                        onSelectAllCurrentPage?.(pageKeys, !isCurrentPageAllSelected)
                      }
                      title={
                        isCurrentPageAllSelected
                          ? 'Batalkan pilihan halaman ini'
                          : 'Pilih semua di halaman ini'
                      }
                      aria-label="Pilih semua baris pada halaman ini"
                    />
                  </th>
                )}
                {columns.map((col, idx) => {
                  const alignClass = `table-th--align-${col.align || 'left'}`;
                  return (
                    <th key={col.key || idx} className={`table-th ${alignClass} whitespace-nowrap`}>
                      {col.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="table-tbody">
              {isLoading ? (
                <SkeletonRow columns={totalColumns} rows={Math.min(effectivePageSize, 5)} />
              ) : displayData.length === 0 ? (
                <tr>
                  <td colSpan={totalColumns} className="table-empty">
                    {emptyComponent || emptyMessage}
                  </td>
                </tr>
              ) : (
                displayData.map((row, rowIdx) => {
                  const key = row[rowKey] ?? rowIdx;
                  const isRowSelected = selectable && selectedRowKeys.includes(key);
                  const absoluteIndex = isClientPaged
                    ? (clampedPage - 1) * effectivePageSize + rowIdx
                    : isServerPaged
                    ? (activePage - 1) * effectivePageSize + rowIdx
                    : rowIdx;
                  return (
                    <tr
                      key={key}
                      className={isRowSelected ? 'table-row--selected' : ''}
                    >
                      {selectable && (
                        <td className="table-td table-td--selection whitespace-nowrap">
                          <input
                            type="checkbox"
                            className="table-checkbox"
                            checked={isRowSelected}
                            onChange={(e) => onSelectRow?.(key, e.target.checked, row)}
                            aria-label={`Pilih baris ${absoluteIndex + 1}`}
                          />
                        </td>
                      )}
                      {columns.map((col, colIdx) => {
                        const alignClass = `table-td--align-${col.align || 'left'}`;
                        return (
                          <td key={col.key || colIdx} className={`table-td ${alignClass} whitespace-nowrap`}>
                            {col.renderCell ? col.renderCell(row, absoluteIndex) : row[col.key]}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && (isClientPaged || isServerPaged) && totalRecords > 0 && (
        <Pagination
          currentPage={clampedPage}
          totalPages={computedTotalPages}
          totalItems={totalRecords}
          perPage={effectivePageSize}
          onPageChange={handlePageSelect}
        />
      )}
    </div>
  );
}
