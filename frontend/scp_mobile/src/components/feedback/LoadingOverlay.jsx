import './LoadingOverlay.css';

export default function LoadingOverlay({
  active = false,
  text = 'Memproses data...',
  subtext = '',
  fixed = false,
}) {
  if (!active) return null;

  return (
    <div
      className={['loading-overlay', fixed ? 'loading-overlay--fixed' : '']
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
    >
      <div className="loading-overlay__spinner" aria-hidden="true" />
      {text && <span className="loading-overlay__text">{text}</span>}
      {subtext && <span className="loading-overlay__subtext">{subtext}</span>}
    </div>
  );
}
