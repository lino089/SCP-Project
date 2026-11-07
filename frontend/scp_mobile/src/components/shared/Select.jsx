import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import './Select.css';

const Select = forwardRef(function Select(
  {
    label,
    id,
    options = [],
    placeholder = 'Pilih opsi...',
    error,
    hint,
    icon: Icon,
    required = false,
    disabled = false,
    className = '',
    containerClassName = '',
    children,
    ...props
  },
  ref
) {
  const wrapperClasses = [
    'select-wrapper',
    error && 'select-wrapper--error',
    disabled && 'select-wrapper--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`select-field ${containerClassName}`.trim()}>
      {label && (
        <label htmlFor={id} className="select-field__label">
          {label}
          {required && <span className="select-field__required">*</span>}
        </label>
      )}

      <div className={wrapperClasses}>
        {Icon && (
          <span className="select-wrapper__icon" aria-hidden="true">
            <Icon size={16} strokeWidth={1.75} />
          </span>
        )}

        <select
          ref={ref}
          id={id}
          disabled={disabled}
          required={required}
          className={['select-wrapper__control', Icon && 'select-wrapper__control--with-icon']
            .filter(Boolean)
            .join(' ')}
          aria-invalid={Boolean(error)}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children
            ? children
            : options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
        </select>

        <span className="select-wrapper__chevron" aria-hidden="true">
          <ChevronDown size={16} />
        </span>
      </div>

      {error && (
        <p className="select-field__error" role="alert">
          {error}
        </p>
      )}
      {!error && hint && <p className="select-field__hint">{hint}</p>}
    </div>
  );
});

export default Select;
