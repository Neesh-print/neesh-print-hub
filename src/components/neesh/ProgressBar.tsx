export interface ProgressBarProps {
  current: number;
  total: number;
  showLabel?: boolean;
  color?: 'purple' | 'green';
}

export const ProgressBar = ({
  current,
  total,
  showLabel = false,
  color = 'purple',
}: ProgressBarProps) => {
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  const segments = 10;
  const filledSegments = Math.round((percentage / 100) * segments);

  const colorClasses = {
    purple: 'bg-accent',
    green: 'bg-chart-green',
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: segments }).map((_, index) => (
          <div
            key={index}
            className={`
              h-2 flex-1 rounded-sm transition-colors
              ${index < filledSegments ? colorClasses[color] : 'bg-border'}
            `}
          />
        ))}
      </div>
      
      {showLabel && (
        <p className="mt-1.5 text-caption text-muted-foreground text-right">
          {current}/{total}
        </p>
      )}
    </div>
  );
};
