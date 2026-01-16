import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface AuthLayoutProps {
  children: ReactNode;
  showBackArrow?: boolean;
  onBack?: () => void;
}

export const AuthLayout = ({ 
  children, 
  showBackArrow = false, 
  onBack 
}: AuthLayoutProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header with logo */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white">
        <div className="h-full px-4 md:px-6 flex items-center">
          <button
            onClick={() => navigate('/')}
            className="font-display font-bold text-xl tracking-tight text-foreground hover:opacity-80 transition-opacity"
          >
            NEESH
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center pt-16 px-4 py-8">
        <div className="w-full max-w-[480px]">
          {/* Back arrow */}
          {showBackArrow && (
            <button
              onClick={handleBack}
              className="mb-6 flex items-center gap-2 text-foreground hover:opacity-70 transition-opacity"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Content card */}
          <div className="bg-white">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
