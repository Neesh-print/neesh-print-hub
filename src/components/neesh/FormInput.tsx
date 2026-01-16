import { forwardRef, InputHTMLAttributes } from "react";

export interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  onChange?: (value: string) => void;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  error,
  disabled = false,
  required = false,
  helperText,
  className = '',
  ...props
}, ref) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block mb-1.5 font-display font-medium text-body text-foreground">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        required={required}
        className={`
          input-neesh w-full
          ${error ? 'ring-2 ring-destructive ring-offset-1' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        aria-invalid={!!error}
        aria-describedby={error ? `${props.id}-error` : helperText ? `${props.id}-helper` : undefined}
        {...props}
      />
      {error && (
        <p id={`${props.id}-error`} className="mt-1.5 text-caption text-destructive">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${props.id}-helper`} className="mt-1.5 text-caption text-muted-foreground">
          {helperText}
        </p>
      )}
    </div>
  );
});

FormInput.displayName = 'FormInput';
