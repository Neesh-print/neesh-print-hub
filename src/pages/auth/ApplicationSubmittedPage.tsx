import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { ButtonSecondary } from '@/components/neesh/ButtonSecondary';

const ApplicationSubmittedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <h1 className="font-display font-bold text-2xl tracking-tight text-foreground mb-12">
          neesh
        </h1>

        {/* Checkmark icon */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10">
            <CheckCircle className="w-8 h-8 text-accent" />
          </div>
        </div>

        {/* Heading */}
        <h2 className="font-display font-bold text-display text-foreground mb-4">
          Application Received
        </h2>

        {/* Body text */}
        <p className="text-body text-muted-foreground mb-2">
          Thanks for applying to join Neesh. We review applications within 2-3 business days and will be in touch via email.
        </p>

        {/* Subtext */}
        <p className="text-caption text-muted-foreground mb-8">
          Questions? Reach out to{' '}
          <a 
            href="mailto:hi@neesh.art" 
            className="text-foreground hover:text-accent transition-colors"
          >
            hi@neesh.art
          </a>
        </p>

        {/* Back button */}
        <ButtonSecondary onClick={() => navigate('/')}>
          Back to Home
        </ButtonSecondary>
      </div>
    </div>
  );
};

export default ApplicationSubmittedPage;