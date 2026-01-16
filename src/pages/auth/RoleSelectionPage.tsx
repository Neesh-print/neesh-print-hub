import { useNavigate } from 'react-router-dom';
import { FileText, Store } from 'lucide-react';
import { AuthLayout, AuthDivider, AuthLink } from '@/components/auth';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';

const RoleSelectionPage = () => {
  const navigate = useNavigate();

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
          onClick={() => navigate('/apply/publisher')}
        >
          Apply as a Publisher
        </ButtonPrimary>

        <ButtonPrimary
          fullWidth
          icon={<Store className="w-5 h-5" />}
          onClick={() => navigate('/apply/retailer')}
        >
          Apply as a Retailer
        </ButtonPrimary>
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
