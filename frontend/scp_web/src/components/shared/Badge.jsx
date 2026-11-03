import './Badge.css';

/**
 * Shared Status Badge Component
 */
export default function Badge({
  children,
  variant = 'default', // default/neutral, success, error/danger, warning, info/primary
  dot = false,
  icon: Icon = null,
  className = '',
  ...props
}) {
  return (
    <span className={`badge badge--${variant} ${className}`.trim()} {...props}>
      {dot && <span className={`badge-dot badge-dot--${variant}`} />}
      {Icon && <Icon size={12} strokeWidth={1.5} />}
      <span>{children}</span>
    </span>
  );
}
