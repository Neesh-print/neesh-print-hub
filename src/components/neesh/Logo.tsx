import neeshLogo from '@/assets/neesh-logo.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'h-5',
  md: 'h-6',
  lg: 'h-7',
  xl: 'h-8',
};

export const Logo = ({ size = 'md', className = '' }: LogoProps) => {
  return (
    <img 
      src={neeshLogo} 
      alt="Neesh" 
      className={`${sizeClasses[size]} w-auto ${className}`}
    />
  );
};
