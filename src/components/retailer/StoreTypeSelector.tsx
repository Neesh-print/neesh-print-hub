import { STORE_TYPES } from "@/lib/store-types";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface StoreTypeSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}

export function StoreTypeSelector({ value, onChange, error }: StoreTypeSelectorProps) {
  const handleToggle = (typeValue: string) => {
    if (value.includes(typeValue)) {
      onChange(value.filter(v => v !== typeValue));
    } else {
      onChange([...value, typeValue]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STORE_TYPES.map((type) => {
          const isSelected = value.includes(type.value);
          return (
            <label
              key={type.value}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleToggle(type.value)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className={cn(
                "text-sm font-medium",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}>
                {type.label}
              </span>
            </label>
          );
        })}
      </div>
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
