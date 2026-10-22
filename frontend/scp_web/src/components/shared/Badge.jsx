import './Badge.css';

/**
 * Shared Status Badge Component
 */
export default function Badge({
  children,
  variant = 'default', // default/neutral, success, error/danger, warning, info/primary
  icon: Icon = null,
  className = '',
  ...props
}) {
  return (
    <span className={`badge badge--${variant} ${className}`.trim()} {...props}>
      {Icon && <Icon size={12} strokeWidth={2.2} />}
      <span>{children}</span>
    </span>
  );
}
