import { ChevronDown } from 'lucide-react';
import './Select.css';

/**
 * Shared Select Dropdown Component
 */
export default function Select({
  id,
  name,
  label = '',
  value,
  defaultValue,
  placeholder = 'Pilih opsi...',
  options = [], // [{ value, label, disabled }] or array of strings
  helperText = '',
  error = '',
  disabled = false,
  required = false,
  onChange,
  className = '',
  ...props
}) {
  const selectId = id || name || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`select-group ${className}`.trim()}>
      {label && (
        <label htmlFor={selectId} className="select-label">
          {label}
          {required && <span className="select-label__required" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="select-wrapper">
        <select
          id={selectId}
          name={name}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          required={required}
          onChange={onChange}
          className={[
            'select-control',
            error ? 'select-control--error' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        >
          {placeholder && (
            <option value="" disabled={required}>
              {placeholder}
            </option>
          )}
          {options.map((opt, index) => {
            const isObj = typeof opt === 'object' && opt !== null;
            const optVal = isObj ? opt.value : opt;
            const optLabel = isObj ? opt.label : opt;
            const optDisabled = isObj ? opt.disabled : false;

            return (
              <option key={`${optVal}-${index}`} value={optVal} disabled={optDisabled}>
                {optLabel}
              </option>
            );
          })}
        </select>
        <span className="select-icon" aria-hidden="true">
          <ChevronDown size={16} strokeWidth={2} />
        </span>
      </div>

      {error ? (
        <span className="select-error-text" role="alert">{error}</span>
      ) : helperText ? (
        <span className="select-helper-text">{helperText}</span>
      ) : null}
    </div>
  );
}
