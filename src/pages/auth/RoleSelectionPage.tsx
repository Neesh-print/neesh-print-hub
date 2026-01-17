import { useNavigate } from 'react-router-dom';
import { Copy, Store, ChevronRight } from 'lucide-react';
import { AuthLayout, AuthDivider, AuthLink } from '@/components/auth';

// TODO: Move to environment variables
const RETAILER_TYPEFORM_URL = 'https://neesh.typeform.com/retailer';

const RoleSelectionPage = () => {
  const navigate = useNavigate();

  const handlePublisherApply = () => {
    navigate('/apply/publisher');
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
        <button
          onClick={handlePublisherApply}
          className="w-full flex items-center gap-4 px-6 py-5 bg-cream hover:bg-cream/80 rounded-lg transition-colors text-left"
        >
          <Copy className="w-6 h-6 text-foreground flex-shrink-0" />
          <span className="font-display font-medium text-body text-foreground">
            Apply as a Publisher
          </span>
        </button>

        <button
          onClick={handleRetailerApply}
          className="w-full flex items-center gap-4 px-6 py-5 bg-cream hover:bg-cream/80 rounded-lg transition-colors text-left"
        >
          <Store className="w-6 h-6 text-foreground flex-shrink-0" />
          <span className="font-display font-medium text-body text-foreground">
            Apply as a Retailer
          </span>
        </button>
      </div>

      {/* Divider */}
      <AuthDivider />

      {/* Login link */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-body text-text-secondary">
          Already found your Neesh?
        </span>
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1 font-display font-medium text-body text-foreground hover:opacity-70 transition-opacity"
        >
          Log in
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Divider */}
      <AuthDivider />

      {/* Talk to team link */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-body text-text-secondary">
          Have any questions?
        </span>
        <button
          onClick={() => window.open('mailto:hi@neesh.art', '_blank')}
          className="inline-flex items-center gap-1 font-display font-medium text-body text-foreground hover:opacity-70 transition-opacity"
        >
          Talk to the team
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </AuthLayout>
  );
};

export default RoleSelectionPage;