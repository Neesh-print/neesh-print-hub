import { ReactNode } from "react";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-12 h-12 flex items-center justify-center text-muted-foreground mb-4">
        {icon}
      </div>
      
      <h3 className="font-display font-semibold text-lg text-foreground mb-2">
        {title}
      </h3>
      
      <p className="text-body text-muted-foreground max-w-sm mb-6">
        {description}
      </p>
      
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  );
};
