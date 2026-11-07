import { useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import './FullScreenSheet.css';

/**
 * FullScreenSheet — Mobile Full-Viewport Slide-Over Sheet
 * Ideal for multi-step forms, KBM journal input, and Quiz question editors
 */
export default function FullScreenSheet({
  isOpen = false,
  onClose,
  title,
  subtitle,
  headerRight,
  children,
  footer,
  className = '',
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fullscreen-sheet ${className}`.trim()}
      role="dialog"
      aria-modal="true"
    >
      <header className="fullscreen-sheet__header">
        <button
          type="button"
          className="fullscreen-sheet__back-btn"
          onClick={onClose}
          aria-label="Kembali"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="fullscreen-sheet__title-wrap">
          {title && <h2 className="fullscreen-sheet__title">{title}</h2>}
          {subtitle && <p className="fullscreen-sheet__subtitle">{subtitle}</p>}
        </div>

        <div className="fullscreen-sheet__right">
          {headerRight || (
            <button
              type="button"
              className="fullscreen-sheet__close-btn"
              onClick={onClose}
              aria-label="Tutup"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      <div className="fullscreen-sheet__body">{children}</div>

      {footer && <footer className="fullscreen-sheet__footer">{footer}</footer>}
    </div>
  );
}
