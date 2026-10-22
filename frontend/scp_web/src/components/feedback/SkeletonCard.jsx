/**
 * Skeleton placeholder for Dashboard KPI cards & item cards
 * @param {number} count - Number of skeleton cards (default: 3)
 */
export default function SkeletonCard({ count = 3, className = '' }) {
  const cards = Array.from({ length: count });

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 w-full ${className}`.trim()}>
      {cards.map((_, idx) => (
        <div
          key={`skeleton-card-${idx}`}
          className="p-5 bg-white border border-gray-200 rounded-lg animate-pulse flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-3 w-28 bg-gray-200 rounded" />
            <div className="h-5 w-16 bg-gray-200 rounded" />
          </div>
          <div className="h-7 w-32 bg-gray-200 rounded mt-2" />
          <div className="h-3.5 w-full bg-gray-100 rounded" />
          <div className="pt-2">
            <div className="h-8 w-24 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
