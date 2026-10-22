import './ProgressBar.css';

/**
 * Shared Progress Bar Component
 */
export default function ProgressBar({
  value = 0, // 0 to 100
  label = '',
  showValue = true,
  color = 'success', // success, accent, primary, error
  className = '',
}) {
  const clampedValue = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className={`progressbar-container ${className}`.trim()}>
      {(label || showValue) && (
        <div className="progressbar-header">
          {label && <span className="progressbar-label">{label}</span>}
          {showValue && <span className="progressbar-value">{clampedValue}%</span>}
        </div>
      )}
      <div
        className="progressbar-track"
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`progressbar-fill progressbar-fill--${color}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
