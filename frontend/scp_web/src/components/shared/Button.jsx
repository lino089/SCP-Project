import './Button.css';

/**
 * Shared Button Component
 */
export default function Button({
  children,
  variant = 'primary', // primary, secondary, outline, ghost, danger, dark, accent
  size = 'md', // sm, md, lg
  type = 'button',
  icon: Icon = null,
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  onClick,
  ...props
}) {
  const isDisabled = disabled || loading;

  const classNames = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? 'btn--full-width' : '',
    isDisabled ? 'btn--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classNames}
      disabled={isDisabled}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} strokeWidth={2} />
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
}
