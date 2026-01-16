import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export interface InfoCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  actionIcon?: ReactNode;
}

export const InfoCard = ({
  title,
  children,
  className = '',
  onClick,
  actionIcon,
}: InfoCardProps) => {
  const isClickable = !!onClick;
  const Component = isClickable ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`
        card-neesh w-full text-left
        ${isClickable ? 'hover:border-accent/30 hover:shadow-neesh-md cursor-pointer transition-all' : ''}
        ${className}
      `}
    >
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-body text-foreground">
            {title}
          </h3>
          {isClickable && (
            actionIcon || <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      )}
      <div className={title ? '' : 'flex items-center justify-between'}>
        {children}
        {!title && isClickable && (
          actionIcon || <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </div>
    </Component>
  );
};
