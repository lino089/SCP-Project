import { useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import './SearchInput.css';

/**
 * Shared Search Input Component (Mobile Touch Friendly with Debounce)
 */
export default function SearchInput({
  value = '',
  onChange,
  onDebouncedChange,
  debounceMs = 300,
  onClear,
  placeholder = 'Cari data...',
  className = '',
  ...props
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!onDebouncedChange) return;

    const timer = setTimeout(() => {
      onDebouncedChange(value);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, debounceMs, onDebouncedChange]);

  const handleInputChange = (e) => {
    const val =
      typeof e?.target?.value !== 'undefined'
        ? e.target.value
        : typeof e === 'string'
        ? e
        : '';
    onChange?.(val);
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange('');
    }
    inputRef.current?.focus();
  };

  return (
    <div className={`search-input-wrapper ${className}`.trim()}>
      <span className="search-input-icon" aria-hidden="true">
        <Search size={16} strokeWidth={2} />
      </span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="search-input-field"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="search-input-clear-btn"
          aria-label="Bersihkan pencarian"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
