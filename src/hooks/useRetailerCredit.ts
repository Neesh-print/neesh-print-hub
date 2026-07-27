import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface RetailerCredit {
  /** true only when payment_terms_enabled AND terms_status === 'approved' */
  termsEnabled: boolean;
  netTermsDays: number; // 0 | 14 | 30
  termsStatus: string;
  creditLimit: number;
  outstanding: number;
  available: number;
}

/**
 * Current retailer's net-terms eligibility and available credit.
 * Reads the retailers row + the retailer_outstanding_balance RPC.
 */
export function useRetailerCredit() {
  const { user } = useAuth();
  const [credit, setCredit] = useState<RetailerCredit | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCredit = useCallback(async () => {
    if (!user) {
      setCredit(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: retailer } = await supabase
        .from('retailers')
        .select('payment_terms_enabled, net_terms_days, terms_status, credit_limit')
        .eq('user_id', user.id)
        .maybeSingle();

      const row = (retailer || {}) as Record<string, unknown>;
      const creditLimit = Number(row.credit_limit ?? 0);
      const termsStatus = (row.terms_status as string) ?? 'none';

      const { data: outstandingData } = await supabase
        .rpc('retailer_outstanding_balance', { p_retailer_id: user.id });
      const outstanding = Number(outstandingData ?? 0);

      setCredit({
        termsEnabled: Boolean(row.payment_terms_enabled) && termsStatus === 'approved',
        netTermsDays: Number(row.net_terms_days ?? 0),
        termsStatus,
        creditLimit,
        outstanding,
        available: Math.max(0, creditLimit - outstanding),
      });
    } catch (err) {
      console.error('useRetailerCredit error:', err);
      setCredit(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCredit();
  }, [fetchCredit]);

  return { credit, isLoading, refetch: fetchCredit };
}
