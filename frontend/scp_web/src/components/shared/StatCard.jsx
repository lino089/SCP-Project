import Badge from './Badge';
import './StatCard.css';

/**
 * Shared StatCard / KPI Overview Card
 */
export default function StatCard({
  label = '',
  title = '',
  value = '',
  description = '',
  badge = null,
  badgeVariant = 'default',
  icon: Icon = null,
  variant = 'default',
  footer = null,
  hoverable = false,
  className = '',
}) {
  const displayLabel = label || title;

  const iconVariantClasses = {
    success: 'bg-emerald-50 text-emerald-600 border-emerald-200/60',
    info: 'bg-blue-50 text-blue-600 border-blue-200/60',
    warning: 'bg-amber-50 text-amber-600 border-amber-200/60',
    danger: 'bg-rose-50 text-rose-600 border-rose-200/60',
    default: 'bg-slate-50 text-slate-600 border-slate-200/60',
  };

  return (
    <div className={`stat-card ${hoverable ? 'stat-card--hoverable' : ''} ${className}`.trim()}>
      <div className="stat-card-top">
        <span className="stat-card-label">{displayLabel}</span>
        {badge ? (
          typeof badge === 'string' ? (
            <Badge variant={badgeVariant}>{badge}</Badge>
          ) : (
            badge
          )
        ) : Icon ? (
          <span
            className={`p-1.5 rounded-md border flex items-center justify-center shrink-0 ${
              iconVariantClasses[variant] || iconVariantClasses.default
            }`}
          >
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
