import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { ButtonSecondary } from '@/components/neesh/ButtonSecondary';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/neesh/Logo';

// v2 "Application under review" screen: band-tinted clock, reading-voice
// copy, and a "While you wait" card that points at the public site.
const SITE = 'https://neesh.art';

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
        <div className="mb-12">
          <Logo size="xl" />
        </div>

        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#EFEEF6]">
            <Clock className="w-7 h-7 text-accent" />
          </div>
        </div>

        <h2 className="font-display font-bold text-display text-foreground mb-4">
          Application under review
        </h2>

        <p className="text-body text-muted-foreground mb-2">
          We&rsquo;re still reading yours. You&rsquo;ll get an email at{' '}
          <span className="font-medium text-foreground">{user?.email || 'your email'}</span> the
          moment it&rsquo;s approved.
        </p>

        <p className="text-caption text-muted-foreground mb-8">
          Most applications are reviewed within 2–3 business days.
        </p>

        <div className="border border-border rounded-lg p-6 text-left mb-8">
          <p className="font-medium text-foreground mb-3">While you wait</p>
          <ul className="space-y-2 text-body text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-accent">•</span>
              <span>
                Follow us on Instagram,{' '}
                <a
                  href="https://instagram.com/neesh.art"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-4 hover:text-accent transition-colors"
                >
                  @neesh.art
                </a>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent">•</span>
              <span>
                Read the{' '}
                <a
                  href={`${SITE}/faq`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-4 hover:text-accent transition-colors"
                >
                  FAQ
                </a>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent">•</span>
              <span>
                Browse the{' '}
                <a
                  href={`${SITE}/index`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-4 hover:text-accent transition-colors"
                >
                  index
                </a>{' '}
                and see who you&rsquo;ll be shelved beside
              </span>
            </li>
          </ul>
        </div>

        <ButtonSecondary onClick={handleSignOut} fullWidth>
          Sign out
        </ButtonSecondary>

        <p className="text-caption text-muted-foreground mt-4">
          Wrong account?{' '}
          <button
            onClick={handleSignOut}
            className="text-foreground underline underline-offset-4 hover:text-accent transition-colors"
          >
            Sign out and try again
          </button>
        </p>
      </div>
    </div>
  );
};

export default ApplicationPendingPage;
