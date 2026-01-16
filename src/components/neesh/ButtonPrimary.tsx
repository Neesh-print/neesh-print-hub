import { ReactNode, ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonPrimaryProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  variant?: 'purple' | 'black';
}

export const ButtonPrimary = ({
  children,
  onClick,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  type = 'button',
  variant = 'black',
  className = '',
  ...props
}: ButtonPrimaryProps) => {
  const isDisabled = disabled || loading;

  const variantClasses = {
    purple: 'bg-accent hover:bg-accent/90',
    black: 'bg-primary hover:bg-primary/90',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2
        px-4 py-2.5 rounded-lg
        font-display font-medium text-body
        ${variantClasses[variant]}
        text-primary-foreground
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
