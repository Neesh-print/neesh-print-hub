import { Minus, Plus } from "lucide-react";

export interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export const QuantitySelector = ({
  value,
  onChange,
  min = 1,
  max,
}: QuantitySelectorProps) => {
  const canDecrease = value > min;
  const canIncrease = max === undefined || value < max;

  const handleDecrease = () => {
    if (canDecrease) {
      onChange(value - 1);
    }
  };

  const handleIncrease = () => {
    if (canIncrease) {
      onChange(value + 1);
    }
  };

  return (
    <div className="inline-flex items-center border border-border rounded-lg overflow-hidden">
      <button
        onClick={handleDecrease}
        disabled={!canDecrease}
        className={`
          w-10 h-10 flex items-center justify-center
          transition-colors
          ${canDecrease ? 'hover:bg-secondary text-foreground' : 'text-muted-foreground cursor-not-allowed'}
        `}
        aria-label="Decrease quantity"
      >
        <Minus className="w-4 h-4" />
      </button>
      
      <span className="w-12 h-10 flex items-center justify-center font-display font-medium text-foreground border-x border-border">
        {value}
      </span>
      
      <button
        onClick={handleIncrease}
        disabled={!canIncrease}
        className={`
          w-10 h-10 flex items-center justify-center
          transition-colors
          ${canIncrease ? 'hover:bg-secondary text-foreground' : 'text-muted-foreground cursor-not-allowed'}
        `}
        aria-label="Increase quantity"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
