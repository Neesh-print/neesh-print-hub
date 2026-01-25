import { useState, useCallback, useRef, useEffect } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onMaxExceeded?: (max: number) => void;
}

const sizeStyles = {
  sm: {
    button: 'h-8 w-8',
    input: 'h-8 w-14 text-sm',
    icon: 'h-3 w-3',
  },
  md: {
    button: 'h-10 w-10',
    input: 'h-10 w-16 text-base',
    icon: 'h-4 w-4',
  },
  lg: {
    button: 'h-12 w-12',
    input: 'h-12 w-20 text-lg',
    icon: 'h-5 w-5',
  },
};

export const QuantityInput = ({
  value,
  onChange,
  min = 1,
  max = 999,
  disabled = false,
  size = 'md',
  className,
  onMaxExceeded,
}: QuantityInputProps) => {
  const [inputValue, setInputValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const styles = sizeStyles[size];

  // Sync internal state with external value
  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const canDecrease = value > min && !disabled;
  const canIncrease = value < max && !disabled;

  const clampValue = useCallback((num: number): number => {
    return Math.max(min, Math.min(max, num));
  }, [min, max]);

  const handleDecrement = useCallback(() => {
    if (canDecrease) {
      onChange(value - 1);
    }
  }, [canDecrease, value, onChange]);

  const handleIncrement = useCallback(() => {
    if (canIncrease) {
      onChange(value + 1);
    } else if (!disabled && value >= max && onMaxExceeded) {
      onMaxExceeded(max);
    }
  }, [canIncrease, value, onChange, disabled, max, onMaxExceeded]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow empty string during typing
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setInputValue(raw);
  }, []);

  const handleBlur = useCallback(() => {
    let num = parseInt(inputValue, 10);

    // Handle empty or invalid input
    if (isNaN(num) || inputValue.trim() === '') {
      num = min;
    }

    // Check if exceeded max before clamping
    if (num > max && onMaxExceeded) {
      onMaxExceeded(max);
    }

    // Clamp to min/max
    const clampedValue = clampValue(num);
    setInputValue(String(clampedValue));
    onChange(clampedValue);
  }, [inputValue, min, max, clampValue, onChange, onMaxExceeded]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleDecrement();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    }
  }, [handleIncrement, handleDecrement]);

  const handleFocus = useCallback(() => {
    // Select all text on focus for easy replacement
    inputRef.current?.select();
  }, []);

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleDecrement}
        disabled={!canDecrease}
        aria-label="Decrease quantity"
        className={cn(styles.button, "flex-shrink-0")}
      >
        <Minus className={styles.icon} />
      </Button>

      <Input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label="Quantity"
        className={cn(
          styles.input,
          "text-center font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        )}
      />

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleIncrement}
        disabled={!canIncrease}
        aria-label="Increase quantity"
        className={cn(styles.button, "flex-shrink-0")}
      >
        <Plus className={styles.icon} />
      </Button>
    </div>
  );
};
