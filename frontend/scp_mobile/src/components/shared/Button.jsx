import './Button.css';

/**
 * Shared Button Component — Exness Fintech Style (Mobile Touch Optimized)
 * Variants: primary (blue action), brand (yellow CTA), secondary, outline, ghost, danger
 * Sizes: sm (36px), md (42px), lg (48px)
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  className = '',
  ...props
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth && 'btn--full',
    loading && 'btn--loading',
    !children && Icon && 'btn--icon-only',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {!loading && Icon && iconPosition === 'left' && (
        <Icon className="btn__icon" size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
      )}
      {children && <span className="btn__label">{children}</span>}
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className="btn__icon" size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
      )}
    </button>
  );
}
