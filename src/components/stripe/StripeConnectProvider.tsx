import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { loadConnectAndInitialize, StripeConnectInstance } from '@stripe/connect-js';
import { supabase } from '@/integrations/supabase/client';

interface StripeConnectContextType {
  stripeConnectInstance: StripeConnectInstance | null;
  isLoading: boolean;
  error: string | null;
  initializeConnect: () => Promise<void>;
}

const StripeConnectContext = createContext<StripeConnectContextType | null>(null);

export const useStripeConnect = () => {
  const context = useContext(StripeConnectContext);
  if (!context) {
    throw new Error('useStripeConnect must be used within a StripeConnectProvider');
  }
  return context;
};

interface StripeConnectProviderProps {
  children: ReactNode;
  publishableKey: string;
}

export const StripeConnectProvider = ({ children, publishableKey }: StripeConnectProviderProps) => {
  const [stripeConnectInstance, setStripeConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('create-account-session');
    
    if (error) {
      throw new Error(error.message || 'Failed to create account session');
    }
    
    if (!data?.client_secret) {
      throw new Error('No client secret returned from server');
    }
    
    return data.client_secret;
  }, []);

  const initializeConnect = useCallback(async () => {
    if (stripeConnectInstance) return; // Already initialized
    
    setIsLoading(true);
    setError(null);
    
    try {
      const instance = await loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret,
        appearance: {
          overlays: 'dialog',
          variables: {
            colorPrimary: '#f97316', // Orange to match neesh branding
            colorBackground: '#0c0a09', // Dark background
            colorText: '#fafaf9',
            colorDanger: '#ef4444',
            borderRadius: '8px',
            fontFamily: 'Inter, system-ui, sans-serif',
            colorSecondaryText: '#a8a29e',
            colorBorder: '#292524',
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
  }, [publishableKey, fetchClientSecret, stripeConnectInstance]);

  return (
    <StripeConnectContext.Provider value={{ stripeConnectInstance, isLoading, error, initializeConnect }}>
      {children}
    </StripeConnectContext.Provider>
  );
};
