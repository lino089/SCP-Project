import { useState } from 'react';
import SkeletonRow from '../feedback/SkeletonRow';
import Pagination from './Pagination';
import './Table.css';

/**
 * Enhanced Shared Table Component with Skeleton Loading & Unified Pagination
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

  const displayData = isClientPaged
    ? data.slice((activePage - 1) * effectivePageSize, activePage * effectivePageSize)
    : data;

  const handlePageSelect = (page) => {
    if (page < 1 || page > computedTotalPages || page === activePage) return;
    if (isServerPaged) {
      effOnPageChange?.(page);
    } else {
      setInternalPage(page);
    }
  };

  return (
    <div className={`table-container ${className}`.trim()}>
      <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="table-scroll-wrapper min-w-full">
          <table className="table-element min-w-full">
            <thead className="table-thead">
              <tr>
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
                <SkeletonRow columns={columns.length} rows={Math.min(effectivePageSize, 5)} />
              ) : displayData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="table-empty">
                    {emptyComponent || emptyMessage}
                  </td>
                </tr>
              ) : (
                displayData.map((row, rowIdx) => {
                  const key = row[rowKey] ?? rowIdx;
                  return (
                    <tr key={key}>
                      {columns.map((col, colIdx) => {
                        const alignClass = `table-td--align-${col.align || 'left'}`;
                        return (
                          <td key={col.key || colIdx} className={`table-td ${alignClass} whitespace-nowrap`}>
                            {col.renderCell ? col.renderCell(row, rowIdx) : row[col.key]}
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
          currentPage={activePage}
          totalPages={computedTotalPages}
          totalItems={totalRecords}
          perPage={effectivePageSize}
          onPageChange={handlePageSelect}
        />
      )}
    </div>
  );
}
