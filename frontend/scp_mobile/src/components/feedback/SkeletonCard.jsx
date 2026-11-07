/**
 * SkeletonCard — loading placeholder for list/detail surfaces.
 * `rows`  = number of text lines inside one card.
 * `count` = legacy prop (D-9): number of stacked cards.
 */
export default function SkeletonCard({ rows = 3, count = 1, className = '' }) {
  const cards = Math.max(1, Number(count) || 1);

  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: cards }).map((_, c) => (
        <div
          key={c}
          className={`animate-pulse ${className}`.trim()}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                height: '12px',
                width: '33%',
                borderRadius: '4px',
                backgroundColor: 'var(--color-border-subtle)',
              }}
            />
            <div
              style={{
                height: '12px',
                width: '56px',
                borderRadius: '4px',
                backgroundColor: 'var(--color-surface-subtle)',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: rows }).map((__, i) => (
              <div
                key={i}
                style={{
                  height: '10px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  width: `${Math.max(45, 95 - i * 18)}%`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
