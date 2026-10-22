import { useEffect } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

/**
 * Accessible Shared Modal Dialog Component
 */
export default function Modal({
  isOpen = false,
  onClose,
  title = '',
  children,
  footer = null,
  size = 'md', // sm, md, lg, xl
  closeOnOverlayClick = true,
  closeOnEsc = true,
  className = '',
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (closeOnEsc && e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose?.();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div className={`modal-card modal--${size} ${className}`.trim()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          {onClose && (
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Tutup modal"
            >
              <X size={18} strokeWidth={2} />
            </button>
          )}
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
