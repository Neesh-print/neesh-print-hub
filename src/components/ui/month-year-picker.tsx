import { useMemo, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPublicationDate,
  parsePublicationDate,
  MONTHS,
  getYearOptions,
} from "@/lib/publication-date";

export interface MonthYearPickerProps {
  /** ISO date string or null */
  value: string | null;
  /** Called when a valid date is selected or cleared */
  onChange: (value: string | null) => void;
  /** Minimum year in dropdown (default: 2000) */
  minYear?: number;
  /** Maximum year in dropdown (default: current year + 1) */
  maxYear?: number;
  /** Show a clear button when value is set */
  allowClear?: boolean;
  /** Allow selecting future dates */
  allowFuture?: boolean;
  /** Disable the picker */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * MonthYearPicker Component
 * 
 * A form input for selecting month and year, storing as ISO date string.
 * Used for publication dates where only month-level granularity is needed.
 */
export function MonthYearPicker({
  value,
  onChange,
  minYear = 2000,
  maxYear,
  allowClear = false,
  allowFuture = false,
  disabled = false,
  className,
}: MonthYearPickerProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const effectiveMaxYear = maxYear ?? (allowFuture ? currentYear + 1 : currentYear);
  
  const { month: selectedMonth, year: selectedYear } = parsePublicationDate(value);
  
  const yearOptions = useMemo(() => 
    getYearOptions(minYear, effectiveMaxYear),
    [minYear, effectiveMaxYear]
  );
  
  const handleMonthChange = useCallback((monthStr: string) => {
    const month = parseInt(monthStr, 10);
    
    // If no year is selected yet, default to current year
    const year = selectedYear || currentYear;
    
    // Check if this would create a future date
    if (!allowFuture && year === currentYear && month > currentMonth) {
      return; // Don't allow future months in current year
    }
    onChange(createPublicationDate(month, year));
  }, [selectedYear, onChange, allowFuture, currentYear, currentMonth]);
  
  const handleYearChange = useCallback((yearStr: string) => {
    const year = parseInt(yearStr, 10);
    
    // If no month is selected yet, default to January
    let month = selectedMonth || 1;
    
    // Adjust month if it would create a future date
    if (!allowFuture && year === currentYear && month > currentMonth) {
      month = currentMonth;
    }
    onChange(createPublicationDate(month, year));
  }, [selectedMonth, onChange, allowFuture, currentYear, currentMonth]);
  
  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);
  
  // Check if a month is disabled (future date)
  const isMonthDisabled = useCallback((month: number) => {
    if (allowFuture) return false;
    if (!selectedYear) return false;
    if (selectedYear < currentYear) return false;
    if (selectedYear > currentYear) return true;
    return month > currentMonth;
  }, [allowFuture, selectedYear, currentYear, currentMonth]);
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select
        value={selectedMonth?.toString() ?? ""}
        onValueChange={handleMonthChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map(({ value: monthValue, label }) => (
            <SelectItem 
              key={monthValue} 
              value={monthValue.toString()}
              disabled={isMonthDisabled(monthValue)}
            >
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Select
        value={selectedYear?.toString() ?? ""}
        onValueChange={handleYearChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {allowClear && value && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="h-8 w-8"
          aria-label="Clear date"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
