import { ReactNode, ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonSecondaryProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  destructive?: boolean;
}

export const ButtonSecondary = ({
  children,
  onClick,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  type = 'button',
  destructive = false,
  className = '',
  ...props
}: ButtonSecondaryProps) => {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2
        px-4 py-2.5 rounded-lg
        font-display font-medium text-body
        bg-background border border-border
        ${destructive ? 'text-destructive hover:bg-destructive/5' : 'text-foreground hover:bg-secondary'}
        transition-colors
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {!loading && icon && iconPosition === 'left' && icon}
      {children}
      {!loading && icon && iconPosition === 'right' && icon}
    </button>
  );
};
