/**
 * Skeleton placeholder rows for Table loading state
 * @param {number} columns - Number of table columns to fill
 * @param {number} rows - Number of skeleton rows to display (default: 5)
 */
export default function SkeletonRow({ columns = 5, rows = 5 }) {
  const rowArray = Array.from({ length: rows });
  const colArray = Array.from({ length: columns });

  return (
    <>
      {rowArray.map((_, rIdx) => (
        <tr key={`skeleton-row-${rIdx}`} className="animate-pulse border-b border-gray-100">
          {colArray.map((_, cIdx) => (
            <td key={`skeleton-cell-${rIdx}-${cIdx}`} className="py-3 px-4">
              <div
                className="h-4 bg-gray-200 rounded"
                style={{
                  width: cIdx === 0 ? '32px' : cIdx === columns - 1 ? '70%' : `${50 + ((rIdx + cIdx) % 4) * 12}%`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
