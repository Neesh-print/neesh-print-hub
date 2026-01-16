import { ArrowRight } from "lucide-react";

export interface WalletDisplayProps {
  label: string;
  amount: number;
  actionLabel: string;
  onAction: () => void;
}

export const WalletDisplay = ({
  label,
  amount,
  actionLabel,
  onAction,
}: WalletDisplayProps) => {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <div className="flex items-center gap-3">
      <span className="text-caption text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      
      <span className="font-display font-bold text-lg text-foreground">
        {formattedAmount}
      </span>
      
      <button
        onClick={onAction}
        className="inline-flex items-center gap-1 text-body text-accent hover:text-accent/80 transition-colors"
      >
        {actionLabel}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
