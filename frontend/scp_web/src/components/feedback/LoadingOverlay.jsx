import './LoadingOverlay.css';

/**
 * Loading Overlay component with spinner and message
 */
export default function LoadingOverlay({
  message = 'Memuat data...',
  subtext = '',
  fixed = false,
  className = '',
}) {
  return (
    <div
      className={`loading-overlay ${fixed ? 'loading-overlay--fixed' : ''} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="loading-overlay__spinner" aria-hidden="true" />
      {message && <div className="loading-overlay__text">{message}</div>}
      {subtext && <div className="loading-overlay__subtext">{subtext}</div>}
    </div>
  );
}
