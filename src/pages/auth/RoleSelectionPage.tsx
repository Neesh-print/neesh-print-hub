import { useNavigate } from 'react-router-dom';
import { FileText, Store } from 'lucide-react';
import { AuthLayout, AuthDivider, AuthLink } from '@/components/auth';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';

// TODO: Move to environment variables
const PUBLISHER_TYPEFORM_URL = 'https://neesh.typeform.com/publisher';
const RETAILER_TYPEFORM_URL = 'https://neesh.typeform.com/retailer';

const RoleSelectionPage = () => {
  const navigate = useNavigate();

  const handlePublisherApply = () => {
    window.location.href = PUBLISHER_TYPEFORM_URL;
  };

  const handleRetailerApply = () => {
    window.location.href = RETAILER_TYPEFORM_URL;
  };

  return (
    <AuthLayout showBackArrow onBack={() => navigate('/login')}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-display text-foreground mb-2">
          New to Neesh?
        </h1>
        <p className="text-body text-text-secondary">
          Apply to join our curated network. Choose your role to get started
        </p>
      </div>

      {/* Role Selection Buttons */}
      <div className="space-y-4">
        <ButtonPrimary
          fullWidth
          icon={<FileText className="w-5 h-5" />}
          onClick={handlePublisherApply}
        >
          Apply as a Publisher
        </ButtonPrimary>

        <ButtonPrimary
          fullWidth
          icon={<Store className="w-5 h-5" />}
          onClick={handleRetailerApply}
        >
          Apply as a Retailer
        </ButtonPrimary>
      </div>

      {/* Already applied note */}
      <div className="mt-6 text-center">
        <p className="text-caption text-muted-foreground">
          Already applied? Check your email for next steps, or{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-foreground hover:text-accent transition-colors font-medium"
          >
            sign in
          </button>
          {' '}if you've been approved.
        </p>
      </div>

      {/* Divider */}
      <AuthDivider />

      {/* Login link */}
      <AuthLink
        text="Already found your Neesh?"
        actionText="Log in"
        to="/login"
      />

      {/* Divider */}
      <AuthDivider />

      {/* Talk to team link */}
      <AuthLink
        text="Have any questions?"
        actionText="Talk to the team"
        onClick={() => window.open('mailto:hello@neesh.com', '_blank')}
      />
    </AuthLayout>
  );
};

export default RoleSelectionPage;