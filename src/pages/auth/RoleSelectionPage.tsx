import { useNavigate } from 'react-router-dom';
import { Copy, Store, ChevronRight } from 'lucide-react';
import { AuthLayout } from '@/components/auth';

// TODO: Move to environment variables
const RETAILER_TYPEFORM_URL = 'https://neesh.typeform.com/retailer';

const DashedDivider = () => (
  <div className="flex items-center gap-4 py-2">
    <div className="flex-1 border-t-2 border-dashed border-muted" />
    <span className="text-sm text-muted-foreground">or</span>
    <div className="flex-1 border-t-2 border-dashed border-muted" />
  </div>
);

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
        <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-3">
          New to Neesh?
        </h1>
        <p className="text-base text-muted-foreground">
          Apply to join our curated network. Choose your role to get started
        </p>
      </div>

      {/* Role Selection Buttons */}
      <div className="space-y-4 mb-8">
        <button
          onClick={handlePublisherApply}
          className="w-full flex items-center justify-center gap-4 px-6 py-5 bg-secondary hover:bg-secondary/80 rounded-xl transition-colors"
        >
          <Copy className="w-6 h-6 text-foreground" strokeWidth={1.5} />
          <span className="font-display font-medium text-base text-foreground">
            Apply as a Publisher
          </span>
        </button>

        <button
          onClick={handleRetailerApply}
          className="w-full flex items-center justify-center gap-4 px-6 py-5 bg-secondary hover:bg-secondary/80 rounded-xl transition-colors"
        >
          <Store className="w-6 h-6 text-foreground" strokeWidth={1.5} />
          <span className="font-display font-medium text-base text-foreground">
            Apply as a Retailer
          </span>
        </button>
      </div>

      {/* Divider */}
      <DashedDivider />

      {/* Login link */}
      <div className="flex items-center justify-center gap-2 py-6">
        <span className="text-base text-muted-foreground">
          Already found your Neesh?
        </span>
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1 font-display font-semibold text-base text-foreground hover:opacity-70 transition-opacity"
        >
          Log in
          <ChevronRight className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>

      {/* Divider */}
      <DashedDivider />

      {/* Talk to team link */}
      <div className="flex items-center justify-center gap-2 py-6">
        <span className="text-base text-muted-foreground">
          Have any questions?
        </span>
        <button
          onClick={() => window.open('mailto:hi@neesh.art', '_blank')}
          className="inline-flex items-center gap-1 font-display font-semibold text-base text-foreground hover:opacity-70 transition-opacity"
        >
          Talk to the team
          <ChevronRight className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>
    </AuthLayout>
  );
};

export default RoleSelectionPage;