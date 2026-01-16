import { forwardRef, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  error?: string;
  onChange?: (value: string) => void;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(({
  label,
  placeholder,
  value,
  onChange,
  options,
  error,
  disabled = false,
  required = false,
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
      <div className="relative">
        <select
          ref={ref}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          required={required}
          className={`
            input-neesh w-full appearance-none pr-10 cursor-pointer
            ${error ? 'ring-2 ring-destructive ring-offset-1' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${!value ? 'text-muted-foreground' : ''}
          `}
          aria-invalid={!!error}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>
      {error && (
        <p className="mt-1.5 text-caption text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});

FormSelect.displayName = 'FormSelect';
