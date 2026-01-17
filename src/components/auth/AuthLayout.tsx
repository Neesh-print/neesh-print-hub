import { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/neesh/Logo';
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with logo */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background">
        <div className="h-full px-6 md:px-8 flex items-center">
          <button
            onClick={() => navigate('/')}
            className="hover:opacity-80 transition-opacity"
          >
            <Logo size="lg" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center pt-16 px-6 py-8">
        <div className="w-full max-w-md relative">
          {/* Back button - positioned to the left of content */}
          {showBackArrow && (
            <button
              onClick={handleBack}
              className="absolute -left-12 top-2 hidden md:flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6" strokeWidth={1.5} />
            </button>
          )}
          
          {/* Mobile back button */}
          {showBackArrow && (
            <button
              onClick={handleBack}
              className="md:hidden mb-6 flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6" strokeWidth={1.5} />
            </button>
          )}

          {/* Content */}
          <div className="bg-background">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
