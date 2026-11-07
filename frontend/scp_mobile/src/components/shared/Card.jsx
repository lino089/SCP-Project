import './Card.css';

/**
 * Shared Card Component — Clean Precision Box Container
 */
export default function Card({
  children,
  title,
  subtitle,
  actions,
  footer,
  noPadding = false,
  className = '',
  bodyClassName = '',
  ...props
}) {
  return (
    <div className={`scp-card ${className}`.trim()} {...props}>
      {(title || subtitle || actions) && (
        <div className="scp-card__header">
          <div className="scp-card__header-text">
            {title && <h3 className="scp-card__title">{title}</h3>}
            {subtitle && <p className="scp-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="scp-card__actions">{actions}</div>}
        </div>
      )}

      <div
        className={[
          'scp-card__body',
          noPadding && 'scp-card__body--flush',
          bodyClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>

      {footer && <div className="scp-card__footer">{footer}</div>}
    </div>
  );
}
