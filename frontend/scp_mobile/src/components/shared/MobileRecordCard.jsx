import Badge from './Badge';
import './MobileRecordCard.css';

/**
 * MobileRecordCard — Touch-friendly Card Replacement for Desktop Data Tables & RowCards
 * Preserves Exness Fintech precision structure:
 * - Header: Monospace code/ID badge + Status badge
 * - Body: Primary title, secondary subtitle, and 2-column key-value metadata grid
 * - Footer: Action buttons (Edit, Delete, Detail, Approve, etc.)
 */
export default function MobileRecordCard({
  code,
  title,
  subtitle,
  statusBadge,
  statusVariant = 'neutral',
  meta = [], // [{ label, value, mono }]
  children,
  actions,
  onClick,
  selected = false,
  accentBorder = false,
  className = '',
}) {
  return (
    <div
      className={[
        'mobile-record-card',
        onClick && 'mobile-record-card--interactive',
        selected && 'mobile-record-card--selected',
        accentBorder && 'mobile-record-card--accent',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {(code || statusBadge) && (
        <div className="mobile-record-card__top">
          {code ? (
            <Badge variant="code" size="sm" mono>
              {code}
            </Badge>
          ) : (
            <span />
          )}

          {statusBadge && (
            <div className="mobile-record-card__status">
              {typeof statusBadge === 'string' ? (
                <Badge variant={statusVariant} size="sm" dot>
                  {statusBadge}
                </Badge>
              ) : (
                statusBadge
              )}
            </div>
          )}
        </div>
      )}

      <div className="mobile-record-card__main">
        {title && <h4 className="mobile-record-card__title">{title}</h4>}
        {subtitle && <p className="mobile-record-card__subtitle">{subtitle}</p>}
      </div>

      {meta.length > 0 && (
        <div className="mobile-record-card__meta-grid">
          {meta.map((item, idx) => (
            <div key={idx} className="mobile-record-card__meta-item">
              <span className="mobile-record-card__meta-label">{item.label}</span>
              <span
                className={[
                  'mobile-record-card__meta-value',
                  item.mono && 'font-mono',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {item.value ?? '-'}
              </span>
            </div>
          ))}
        </div>
      )}

      {children && <div className="mobile-record-card__extra">{children}</div>}

      {actions && (
        <div
          className="mobile-record-card__actions"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
