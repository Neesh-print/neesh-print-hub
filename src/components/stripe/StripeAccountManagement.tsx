import { useEffect, useState } from 'react';
import { 
  ConnectComponentsProvider, 
  ConnectAccountManagement,
  ConnectPayouts 
} from '@stripe/react-connect-js';
import { loadConnectAndInitialize, StripeConnectInstance } from '@stripe/connect-js';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { ButtonSecondary } from '@/components/neesh';

// Stripe publishable key - in production, this should come from environment
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';

type ComponentType = 'account_management' | 'payouts';

interface StripeAccountManagementProps {
  component?: ComponentType;
  onAccountInvalid?: () => void;
}

export const StripeAccountManagement = ({ component = 'account_management', onAccountInvalid }: StripeAccountManagementProps) => {
  const [stripeConnectInstance, setStripeConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const fetchClientSecret = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('create-account-session');

    if (error) {
      // Check if the response body indicates invalid account
      if (data?.needs_reconnect || data?.error === 'stripe_account_invalid') {
        setNeedsReconnect(true);
        onAccountInvalid?.();
        throw new Error('Stripe account needs to be reconnected');
      }
      throw new Error(error.message || 'Failed to create account session');
    }

    if (!data?.client_secret) {
      if (data?.needs_reconnect || data?.error === 'stripe_account_invalid') {
        setNeedsReconnect(true);
        onAccountInvalid?.();
        throw new Error('Stripe account needs to be reconnected');
      }
      throw new Error('No client secret returned from server');
    }

    return data.client_secret;
  };

  const initializeConnect = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const instance = await loadConnectAndInitialize({
        publishableKey: STRIPE_PUBLISHABLE_KEY,
        fetchClientSecret,
        appearance: {
          overlays: 'dialog',
          variables: {
            colorPrimary: '#f97316', // Orange to match neesh branding
            colorBackground: '#18181b', // Dark background that works well
            colorText: '#fafafa',
            colorDanger: '#ef4444',
            borderRadius: '8px',
            fontFamily: 'Inter, system-ui, sans-serif',
            colorSecondaryText: '#a1a1aa',
            colorBorder: '#3f3f46',
          },
        },
      });
      
      setStripeConnectInstance(instance);
    } catch (err) {
      console.error('Failed to initialize Stripe Connect:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize Stripe Connect');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeConnect();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading account management...</p>
      </div>
    );
  }

  if (needsReconnect) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
        <AlertCircle className="h-8 w-8 text-orange-500" />
        <div className="text-center">
          <p className="font-medium text-foreground">Stripe account needs to be reconnected</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your previously connected Stripe account is no longer valid. Please set up a new payout method.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-destructive/10 rounded-lg border border-destructive/30">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <div className="text-center">
          <p className="font-medium text-foreground">Failed to load account management</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
        <ButtonSecondary onClick={initializeConnect}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </ButtonSecondary>
      </div>
    );
  }

  if (!stripeConnectInstance) {
    return null;
  }

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      <div className="stripe-connect-container">
        {component === 'account_management' && (
          <ConnectAccountManagement />
        )}
        {component === 'payouts' && (
          <ConnectPayouts />
        )}
      </div>
    </ConnectComponentsProvider>
  );
};

export default StripeAccountManagement;
