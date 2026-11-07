import { useEffect } from 'react';
import { X } from 'lucide-react';
import './BottomSheetModal.css';

/**
 * BottomSheetModal — Mobile Slide-Up Bottom Sheet Dialog
 * Replaces desktop centered Modal while remaining 100% prop-compatible with `Modal`
 */
export default function BottomSheetModal({
  isOpen = false,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md', // sm, md, lg, full
  closeOnOverlay = true,
  showCloseButton = true,
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
      className="bottom-sheet-backdrop"
      onClick={closeOnOverlay ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'bottom-sheet-title' : undefined}
    >
      <div
        className={`bottom-sheet-panel bottom-sheet-panel--${size} ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bottom-sheet-handle-bar" aria-hidden="true">
          <div className="bottom-sheet-handle-pill" />
        </div>

        {(title || showCloseButton) && (
          <div className="bottom-sheet-header">
            <div className="bottom-sheet-header__text">
              {title && (
                <h3 id="bottom-sheet-title" className="bottom-sheet-title">
                  {title}
                </h3>
              )}
              {subtitle && <p className="bottom-sheet-subtitle">{subtitle}</p>}
            </div>

            {showCloseButton && (
              <button
                type="button"
                className="bottom-sheet-close-btn"
                onClick={onClose}
                aria-label="Tutup dialog"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        <div className="bottom-sheet-body">{children}</div>

        {footer && <div className="bottom-sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}
