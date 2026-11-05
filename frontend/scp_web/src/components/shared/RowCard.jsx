import './RowCard.css';

/**
 * Shared RowCard Component
 * Enterprise Clean Precision Design - Menampilkan data baris mandiri (casual & friendly)
 * Sesuai referensi visual Dashboard SCP
 */
export default function RowCard({
  children,
  left = null,
  right = null,
  hoverable = true,
  className = '',
  onClick = null,
  ...props
}) {
  const isClickable = Boolean(onClick);

  return (
    <div
      className={`row-card ${hoverable ? 'row-card--hoverable' : ''} ${isClickable ? 'row-card--clickable' : ''} ${className}`.trim()}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      {...props}
    >
      {left || right ? (
        <>
          {left && <div className="row-card__left">{left}</div>}
          {right && <div className="row-card__right">{right}</div>}
        </>
      ) : (
        children
      )}
    </div>
  );
}

// Subcomponents for flexible compound usage
RowCard.Left = function RowCardLeft({ children, className = '' }) {
  return <div className={`row-card__left ${className}`.trim()}>{children}</div>;
};

RowCard.Right = function RowCardRight({ children, className = '' }) {
  return <div className={`row-card__right ${className}`.trim()}>{children}</div>;
};

RowCard.Title = function RowCardTitle({ children, className = '' }) {
  return <span className={`row-card__title ${className}`.trim()}>{children}</span>;
};

RowCard.Subtitle = function RowCardSubtitle({ children, className = '' }) {
  return <span className={`row-card__subtitle ${className}`.trim()}>{children}</span>;
};
