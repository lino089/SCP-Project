import { useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import './SearchInput.css';

/**
 * Shared Search Input Component with keyboard shortcut & debounce support
 */
export default function SearchInput({
  value = '',
  onChange,
  onDebouncedChange,
  debounceMs = 300,
  onClear,
  placeholder = 'Cari...',
  className = '',
  shortcutHint = '/',
  ...props
}) {
  const inputRef = useRef(null);

  // Keyboard shortcut '/' to focus
  useEffect(() => {
    if (!shortcutHint) return;

    const handleKeyDown = (e) => {
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcutHint]);

  // Debounced callback trigger
  useEffect(() => {
    if (!onDebouncedChange) return;

    const timer = setTimeout(() => {
      onDebouncedChange(value);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, debounceMs, onDebouncedChange]);

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange({ target: { value: '' } });
    }
    inputRef.current?.focus();
  };

  return (
    <div className={`search-input-wrapper ${className}`.trim()}>
      <span className="search-input-icon" aria-hidden="true">
        <Search size={15} strokeWidth={2} />
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="search-input-field"
        {...props}
      />
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          className="search-input-clear-btn"
          aria-label="Bersihkan pencarian"
        >
          <X size={13} />
        </button>
      ) : shortcutHint ? (
        <kbd className="search-input-kbd pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 font-mono text-[10px] font-medium text-gray-400">
          {shortcutHint}
        </kbd>
      ) : null}
    </div>
  );
}
