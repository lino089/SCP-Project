import './Badge.css';

/**
 * Shared Badge Component — Precision Sharp-Cornered Status Pills
 * Variants:
 * - Semantic: 'success', 'warning', 'error', 'info', 'accent', 'neutral'
 * - Structural: 'code' (monospace), 'outline', 'status'
 */
export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  icon: Icon,
  mono = false,
  className = '',
  ...props
}) {
  const classes = [
    'badge',
    `badge--${variant}`,
    `badge--${size}`,
    (mono || variant === 'code') && 'badge--mono',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...props}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {Icon && <Icon className="badge__icon" size={size === 'sm' ? 11 : 13} />}
      <span className="badge__text">{children}</span>
    </span>
  );
}
