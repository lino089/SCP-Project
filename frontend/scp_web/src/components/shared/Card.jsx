import './Card.css';

/**
 * Shared Card Component
 */
export default function Card({
  children,
  title = '',
  subtitle = '',
  headerAction = null,
  footer = null,
  hoverable = false,
  className = '',
  bodyClassName = '',
  ...props
}) {
  const hasHeader = title || subtitle || headerAction;

  return (
    <div
      className={`card ${hoverable ? 'card--hoverable' : ''} ${className}`.trim()}
      {...props}
    >
      {hasHeader && (
        <div className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}

      <div className={`card-body ${bodyClassName}`.trim()}>
        {children}
      </div>

      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}

// Subcomponents for flexible compound usage
Card.Header = function CardHeader({ children, className = '' }) {
  return <div className={`card-header ${className}`.trim()}>{children}</div>;
};

Card.Title = function CardTitle({ children, className = '' }) {
  return <h3 className={`card-title ${className}`.trim()}>{children}</h3>;
};

Card.Body = function CardBody({ children, className = '' }) {
  return <div className={`card-body ${className}`.trim()}>{children}</div>;
};

Card.Footer = function CardFooter({ children, className = '' }) {
  return <div className={`card-footer ${className}`.trim()}>{children}</div>;
};
