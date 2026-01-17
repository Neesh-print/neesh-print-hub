import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { ButtonSecondary } from '@/components/neesh/ButtonSecondary';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/neesh/Logo';

const ApplicationPendingPage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-12">
          <Logo size="xl" />
        </div>

        {/* Clock icon */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
            <Clock className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>

        {/* Heading */}
        <h2 className="font-display font-bold text-display text-foreground mb-4">
          Application Under Review
        </h2>

        {/* Body text */}
        <p className="text-body text-muted-foreground mb-2">
          We're still reviewing your application. You'll receive an email at{' '}
          <span className="font-medium text-foreground">{user?.email || 'your email'}</span> once approved.
        </p>

        {/* Subtext */}
        <p className="text-caption text-muted-foreground mb-8">
          Most applications are reviewed within 2-3 business days.
        </p>

        {/* While you wait card */}
        <div className="card-neesh text-left mb-8">
          <p className="font-medium text-foreground mb-3">While you wait:</p>
          <ul className="space-y-2 text-body text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-accent">•</span>
              <span>
                Follow us on Instagram{' '}
                <a 
                  href="https://instagram.com/neesh.art" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-accent transition-colors"
                >
                  @neesh.art
                </a>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent">•</span>
              <span>
                Read our FAQ at{' '}
                <a 
                  href="https://neesh.art/faq" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-accent transition-colors"
                >
                  neesh.art/faq
                </a>
              </span>
            </li>
          </ul>
        </div>

        {/* Sign out button */}
        <ButtonSecondary onClick={handleSignOut} fullWidth>
          Sign Out
        </ButtonSecondary>

        {/* Wrong account link */}
        <p className="text-caption text-muted-foreground mt-4">
          Wrong account?{' '}
          <button
            onClick={handleSignOut}
            className="text-foreground hover:text-accent transition-colors"
          >
            Sign out and try again
          </button>
        </p>
      </div>
    </div>
  );
};

export default ApplicationPendingPage;