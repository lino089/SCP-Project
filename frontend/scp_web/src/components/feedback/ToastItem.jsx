import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const DEFAULT_TITLES = {
  success: 'Berhasil',
  error: 'Terjadi Kesalahan',
  warning: 'Peringatan',
  info: 'Informasi',
};

export default function ToastItem({ toast, onRemove }) {
  const { id, title, message, variant = 'info', duration = 4000, action } = toast;
  const [isLeaving, setIsLeaving] = useState(false);
  const [progress, setProgress] = useState(100);
  const remainingTimeRef = useRef(duration);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);
  const isPausedRef = useRef(false);

  const IconComponent = ICONS[variant] || Info;
  const displayTitle = title || (DEFAULT_TITLES[variant] && !message ? DEFAULT_TITLES[variant] : null);

  const startDismissTimer = useCallback(() => {
    if (duration <= 0) return;
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onRemove(id), 200);
    }, remainingTimeRef.current);
  }, [duration, id, onRemove]);

  const pauseTimer = () => {
    if (duration <= 0) return;
    isPausedRef.current = true;
    clearTimeout(timerRef.current);
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
  };

  const resumeTimer = () => {
    if (duration <= 0) return;
    isPausedRef.current = false;
    startDismissTimer();
  };

  const handleManualClose = () => {
    clearTimeout(timerRef.current);
    setIsLeaving(true);
    setTimeout(() => onRemove(id), 200);
  };

  useEffect(() => {
    startDismissTimer();
    return () => clearTimeout(timerRef.current);
  }, [startDismissTimer]);

  // Update progress bar animation
  useEffect(() => {
    if (duration <= 0) return;
    const interval = 50;
    const step = (interval / duration) * 100;
    const progressTimer = setInterval(() => {
      if (!isPausedRef.current) {
        setProgress((prev) => Math.max(0, prev - step));
      }
    }, interval);
    return () => clearInterval(progressTimer);
  }, [duration]);

  return (
    <div
      role="alert"
      className={`toast-item toast-item--${variant} ${isLeaving ? 'toast-item--leaving' : ''}`}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
    >
      <div className="toast-item__icon-wrapper">
        <IconComponent size={18} strokeWidth={2.2} />
      </div>

      <div className="toast-item__content">
        {displayTitle && <h4 className="toast-item__title">{displayTitle}</h4>}
        {message && <p className="toast-item__message">{message}</p>}
        {action && (
          <button
            type="button"
            className="toast-item__action"
            onClick={() => {
              action.onClick?.();
              handleManualClose();
            }}
          >
            {action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        className="toast-item__close"
        onClick={handleManualClose}
        aria-label="Tutup notifikasi"
      >
        <X size={15} />
      </button>

      {duration > 0 && (
        <div
          className="toast-item__progress"
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      )}
    </div>
  );
}
