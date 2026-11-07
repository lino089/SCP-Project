import './StatCard.css';

/**
 * Shared StatCard Component — Mobile KPI Summary Card
 * Uses JetBrains Mono for metrics & Exness sharp borders
 */
export default function StatCard({
  label,
  title, // legacy alias (D-9)
  value,
  subtext,
  icon: Icon,
  trend,
  variant = 'default', // default, accent, success, warning, danger
  color, // legacy alias for variant (D-9)
  onClick,
  className = '',
}) {
  const resolvedLabel = label ?? title;
  const resolvedVariant = color ?? variant;

  return (
    <div
      className={[
        'stat-card',
        `stat-card--${resolvedVariant}`,
        onClick && 'stat-card--clickable',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="stat-card__top">
        <span className="stat-card__label">{resolvedLabel}</span>
        {Icon && (
          <div className="stat-card__icon">
            <Icon size={16} strokeWidth={1.75} />
          </div>
        )}
      </div>

      <div className="stat-card__value font-mono">{value ?? '-'}</div>

      {(subtext || trend) && (
        <div className="stat-card__footer">
          {trend && <span className="stat-card__trend font-mono">{trend}</span>}
          {subtext && <span className="stat-card__subtext">{subtext}</span>}
        </div>
      )}
    </div>
  );
}
