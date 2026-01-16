import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface AuthLinkProps {
  text: string;
  actionText: string;
  to?: string;
  onClick?: () => void;
}

export const AuthLink = ({ text, actionText, to, onClick }: AuthLinkProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-1 text-body text-foreground hover:opacity-70 transition-opacity"
    >
      <span>{text}</span>
      <span className="font-semibold">{actionText}</span>
      <ChevronRight className="w-4 h-4" />
    </button>
  );
};
