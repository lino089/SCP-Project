import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './Input.css';

/**
 * Shared Input Component with password toggle and error message
 */
export default function Input({
  id,
  name,
  label = '',
  type = 'text',
  value,
  defaultValue,
  placeholder = '',
  helperText = '',
  error = '',
  disabled = false,
  required = false,
  prefixIcon: PrefixIcon = null,
  onChange,
  className = '',
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const inputId = id || name || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`input-group ${className}`.trim()}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
          {required && <span className="input-label__required" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="input-wrapper">
        {PrefixIcon && (
          <span className="input-prefix" aria-hidden="true">
            <PrefixIcon size={16} strokeWidth={2} />
          </span>
        )}

        <input
          id={inputId}
          name={name}
          type={effectiveType}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          onChange={onChange}
          className={[
            'input-control',
            PrefixIcon ? 'input-control--with-prefix' : '',
            isPassword ? 'input-control--with-suffix' : '',
            error ? 'input-control--error' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            className="input-suffix-btn"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            disabled={disabled}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {error ? (
        <span className="input-error-text" role="alert">{error}</span>
      ) : helperText ? (
        <span className="input-helper-text">{helperText}</span>
      ) : null}
    </div>
  );
}
