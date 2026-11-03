import Badge from './Badge';
import './StatCard.css';

/**
 * Shared StatCard / KPI Overview Card
 * Enterprise Clean Precision Design (Linear / Vercel style)
 * Icon Diet applied: highlights primary metrics, uppercase micro-label, status dot & accent border
 */
export default function StatCard({
  label = '',
  title = '',
  value = '',
  unit = '',
  description = '',
  badge = null,
  badgeVariant = 'default',
  statusDot = null,
  accentPosition = 'none', // 'top' | 'left' | 'none'
  accentBorder = false,    // shortcut to apply accentPosition='top' if true
  variant = 'default',     // 'success' | 'warning' | 'danger' | 'info' | 'default'
  footer = null,
  hoverable = false,
  className = '',
}) {
  const displayLabel = label || title;
  const effectiveAccent = accentBorder ? 'top' : accentPosition;

  const accentClass =
    effectiveAccent === 'top' && variant !== 'default'
      ? `accent-border-top--${variant}`
      : effectiveAccent === 'left' && variant !== 'default'
      ? `accent-border-left--${variant}`
      : '';

  const dotVariant =
    statusDot === true
      ? variant
      : typeof statusDot === 'string'
      ? statusDot
      : null;

  return (
    <div
      className={`stat-card ${accentClass} ${hoverable ? 'stat-card--hoverable' : ''} ${className}`.trim()}
    >
      <div className="stat-card-top">
        <span className="stat-card-label">{displayLabel}</span>
        {badge ? (
          typeof badge === 'string' ? (
            <Badge variant={badgeVariant} dot>{badge}</Badge>
          ) : (
            badge
          )
        ) : dotVariant ? (
          <span className={`status-dot status-dot--${dotVariant}`} />
        ) : null}
      </div>

      <div className="stat-card-main-val">
        <span className="font-mono">{value}</span>
        {unit && <span className="stat-card-unit">{unit}</span>}
      </div>

      {description && <p className="stat-card-desc">{description}</p>}

      {footer && <div className="stat-card-footer-controls">{footer}</div>}
    </div>
  );
}
