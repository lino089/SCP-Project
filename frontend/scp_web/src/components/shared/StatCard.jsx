import Badge from './Badge';
import './StatCard.css';

/**
 * Shared StatCard / KPI Overview Card
 */
export default function StatCard({
  label = '',
  value = '',
  description = '',
  badge = null,
  badgeVariant = 'default',
  icon: Icon = null,
  footer = null,
  hoverable = false,
  className = '',
}) {
  return (
    <div className={`stat-card ${hoverable ? 'stat-card--hoverable' : ''} ${className}`.trim()}>
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {badge ? (
          typeof badge === 'string' ? (
            <Badge variant={badgeVariant}>{badge}</Badge>
          ) : (
            badge
          )
        ) : Icon ? (
          <span className="text-gray-400">
            <Icon size={16} />
          </span>
        ) : null}
      </div>

      <div className="stat-card-main-val">{value}</div>

      {description && <p className="stat-card-desc">{description}</p>}

      {footer && <div className="stat-card-footer-controls">{footer}</div>}
    </div>
  );
}
