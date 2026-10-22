import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublisherTransfer {
  id: string;
  publisher_id: string;
  /** Null for shipping transfers (shipping_v2). */
  order_id: string | null;
  /** goods = copies, shipping = the parcel's shipping (shipping_v2) */
  kind: 'goods' | 'shipping';
  shipment_id: string | null;
  hold_reason: string | null;
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
  /** "Fay × 5" for goods rows */
  item_label?: string;
  /** Neesh label bought for this parcel (shipping rows) */
  label_cost?: number | null;
}

interface UsePublisherTransfersOptions {
  publisherId?: string;
  status?: 'pending' | 'transferred' | 'failed';
  /** Include shipping transfers and parcel details (needs the shipping_v2 migration). */
  withShipping?: boolean;
}

export function usePublisherTransfers(options: UsePublisherTransfersOptions = {}) {
  const [transfers, setTransfers] = useState<PublisherTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransfers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Shipping transfers have no order, so the order join must be optional (shipping_v2).
      const selectColumns: string = options.withShipping
        ? `*, publishers!inner ( company_name ), orders ( id, quantity, magazines ( title ) ), order_shipments ( id, label_cost_usd, uses_neesh_labels )`
        : `*, publishers!inner ( company_name ), orders!inner ( id )`;

      let query = supabase
        .from('publisher_transfers')
        .select(selectColumns)
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

      const mapped: PublisherTransfer[] = ((data || []) as unknown as Record<string, unknown>[]).map((row) => {
        const publishers = row.publishers as Record<string, unknown> | null;
        const orders = row.orders as Record<string, unknown> | null;
        const magazine = orders?.magazines as Record<string, unknown> | null | undefined;
        const shipment = row.order_shipments as Record<string, unknown> | null | undefined;
        return {
          id: row.id as string,
          publisher_id: row.publisher_id as string,
          order_id: (row.order_id as string | null) ?? null,
          kind: ((row.kind as string) === 'shipping' ? 'shipping' : 'goods') as 'goods' | 'shipping',
          shipment_id: (row.shipment_id as string | null) ?? null,
          hold_reason: (row.hold_reason as string | null) ?? null,
          item_label: magazine?.title ? `${magazine.title as string} \u00d7 ${orders?.quantity as number}` : undefined,
          label_cost: shipment?.label_cost_usd != null ? Number(shipment.label_cost_usd) : null,
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
          order_number: orders?.id
            ? `#${(orders.id as string).slice(0, 8).toUpperCase()}`
            : row.shipment_id ? `Parcel #${(row.shipment_id as string).slice(0, 8).toUpperCase()}` : 'N/A',
        };
      });

      setTransfers(mapped);
    } catch (err) {
      console.error('Error fetching publisher transfers:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [options.publisherId, options.status, options.withShipping]);

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
