import { TrendingUp, TrendingDown } from "lucide-react";

export interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; direction: 'up' | 'down' };
  onClick?: () => void;
  highlight?: 'default' | 'warning' | 'success';
}

export const StatCard = ({
  label,
  value,
  subtitle,
  trend,
  onClick,
  highlight = 'default',
}: StatCardProps) => {
  const isClickable = !!onClick;
  const Component = isClickable ? 'button' : 'div';

  const highlightClasses = {
    default: '',
    warning: 'border-l-4 border-l-status-pending',
    success: 'border-l-4 border-l-status-success',
  };

  return (
    <Component
      onClick={onClick}
      className={`
        card-neesh w-full text-left
        ${highlightClasses[highlight]}
        ${isClickable ? 'hover:border-accent/30 hover:shadow-neesh-md cursor-pointer transition-all' : ''}
      `}
    >
      <p className="text-caption text-muted-foreground mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="font-display font-bold text-display-sm text-foreground">
          {value}
        </span>
        {trend && (
          <div className={`flex items-center gap-0.5 ${trend.direction === 'up' ? 'text-chart-green' : 'text-status-error-text'}`}>
            {trend.direction === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span className="text-caption font-medium">
              {trend.direction === 'up' ? '+' : '-'}{Math.abs(trend.value)}%
            </span>
          </div>
        )}
      </div>
      {subtitle && (
        <p className="text-caption text-muted-foreground mt-1">{subtitle}</p>
      )}
    </Component>
  );
};
