import { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './Input.css';

const Input = forwardRef(function Input(
  {
    label,
    id,
    type = 'text',
    error,
    hint,
    icon: Icon,
    prefix,
    suffix,
    mono = false,
    required = false,
    disabled = false,
    className = '',
    containerClassName = '',
    ...props
  },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const wrapperClasses = [
    'input-wrapper',
    error && 'input-wrapper--error',
    disabled && 'input-wrapper--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`input-field ${containerClassName}`.trim()}>
      {label && (
        <label htmlFor={id} className="input-field__label">
          {label}
          {required && <span className="input-field__required">*</span>}
        </label>
      )}

      <div className={wrapperClasses}>
        {Icon && (
          <span className="input-wrapper__icon" aria-hidden="true">
            <Icon size={16} strokeWidth={1.75} />
          </span>
        )}
        {prefix && <span className="input-wrapper__prefix">{prefix}</span>}

        <input
          ref={ref}
          id={id}
          type={inputType}
          disabled={disabled}
          required={required}
          className={['input-wrapper__control', mono && 'input-wrapper__control--mono']
            .filter(Boolean)
            .join(' ')}
          aria-invalid={Boolean(error)}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            className="input-wrapper__toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={-1}
            aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}

        {!isPassword && suffix && (
          <span className="input-wrapper__suffix">{suffix}</span>
        )}
      </div>

      {error && (
        <p className="input-field__error" role="alert">
          {error}
        </p>
      )}
      {!error && hint && <p className="input-field__hint">{hint}</p>}
    </div>
  );
});

export default Input;
