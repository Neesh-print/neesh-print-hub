import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublisherTransfer {
  id: string;
  publisher_id: string;
  order_id: string;
  stripe_session_id: string | null;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  status: 'pending' | 'transferred' | 'failed';
  stripe_transfer_id: string | null;
  released_by: string | null;
  released_at: string | null;
  transferred_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  publisher_name?: string;
  order_number?: string;
}

interface UsePublisherTransfersOptions {
  publisherId?: string;
  status?: 'pending' | 'transferred' | 'failed';
}

export function usePublisherTransfers(options: UsePublisherTransfersOptions = {}) {
  const [transfers, setTransfers] = useState<PublisherTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransfers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('publisher_transfers')
        .select(`
          *,
          publishers!inner ( company_name ),
          orders!inner ( id )
        `)
        .order('created_at', { ascending: false });

      if (options.publisherId) {
        query = query.eq('publisher_id', options.publisherId);
      }

      if (options.status) {
        query = query.eq('status', options.status);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching publisher transfers:', fetchError);
        setError(fetchError.message);
        return;
      }

      const mapped: PublisherTransfer[] = (data || []).map((row: Record<string, unknown>) => {
        const publishers = row.publishers as Record<string, unknown> | null;
        const orders = row.orders as Record<string, unknown> | null;
        return {
          id: row.id as string,
          publisher_id: row.publisher_id as string,
          order_id: row.order_id as string,
          stripe_session_id: row.stripe_session_id as string | null,
          gross_amount: Number(row.gross_amount),
          platform_fee: Number(row.platform_fee),
          net_amount: Number(row.net_amount),
          status: row.status as 'pending' | 'transferred' | 'failed',
          stripe_transfer_id: row.stripe_transfer_id as string | null,
          released_by: row.released_by as string | null,
          released_at: row.released_at as string | null,
          transferred_at: row.transferred_at as string | null,
          failure_reason: row.failure_reason as string | null,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          publisher_name: (publishers?.company_name as string) || 'Unknown',
          order_number: orders?.id ? `#${(orders.id as string).slice(0, 8).toUpperCase()}` : 'N/A',
        };
      });

      setTransfers(mapped);
    } catch (err) {
      console.error('Error fetching publisher transfers:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [options.publisherId, options.status]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const pendingTotal = transfers
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + t.net_amount, 0);

  const transferredTotal = transfers
    .filter(t => t.status === 'transferred')
    .reduce((sum, t) => sum + t.net_amount, 0);

  const pendingCount = transfers.filter(t => t.status === 'pending').length;
  const transferredCount = transfers.filter(t => t.status === 'transferred').length;

  return {
    transfers,
    isLoading,
    error,
    pendingTotal,
    transferredTotal,
    pendingCount,
    transferredCount,
    refetch: fetchTransfers,
  };
}
