import { forwardRef, TextareaHTMLAttributes } from "react";

export interface FormTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  onChange?: (value: string) => void;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(({
  label,
  placeholder,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  helperText,
  rows = 4,
  maxLength,
  className = '',
  ...props
}, ref) => {
  const currentLength = typeof value === 'string' ? value.length : 0;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block mb-1.5 font-display font-medium text-body text-foreground">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        required={required}
        rows={rows}
        maxLength={maxLength}
        className={`
          input-neesh w-full resize-y min-h-[100px]
          ${error ? 'ring-2 ring-destructive ring-offset-1' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        aria-invalid={!!error}
        aria-describedby={error ? `${props.id}-error` : helperText ? `${props.id}-helper` : undefined}
        {...props}
      />
      <div className="flex justify-between mt-1.5">
        <div>
          {error && (
            <p id={`${props.id}-error`} className="text-caption text-destructive">
              {error}
            </p>
          )}
          {helperText && !error && (
            <p id={`${props.id}-helper`} className="text-caption text-muted-foreground">
              {helperText}
            </p>
          )}
        </div>
        {maxLength && (
          <p className="text-caption text-muted-foreground">
            {currentLength}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
});

FormTextarea.displayName = 'FormTextarea';
