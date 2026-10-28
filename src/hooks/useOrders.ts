import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseShippingAddress } from "@/utils/parseShippingAddress";
import { formatOrderRef } from "@/lib/orderStatus";

export interface Order {
  [key: string]: unknown; // Index signature for DataTable compatibility
  id: string;
  order_number: string;
  status: string;
  fulfillment_status: string;
  payment_status: string;
  total_amount: number;
  shipping_amount: number;
  created_at: string;
  shipped_at: string | null;
  tracking_number: string | null;
  carrier: string | null;
  shipping_address: {
    name?: string;
    address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
    };
  } | null;
  retailer: {
    id: string;
    shop_name: string | null;
    user_id: string;
  } | null;
  magazine: {
    id: string;
    title: string;
    cover_image_url: string | null;
    publisher_id: string;
  } | null;
  publisher_name: string | null;
  quantity: number;
  unit_price: number;
}

export interface UseOrdersOptions {
  publisherId?: string;
  retailerId?: string;
  status?: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'all';
  /** Matches orders.status; pass several to match any of them. */
  fulfillmentStatus?: string | readonly string[];
  limit?: number;
  dateRange?: { start: Date; end: Date };
}

export interface UseOrdersReturn {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useOrders = (options: UseOrdersOptions = {}): UseOrdersReturn => {
  // Callers often pass a fresh array; depend on its contents, not its identity
  const fulfillmentKey = typeof options.fulfillmentStatus === 'string'
    ? options.fulfillmentStatus
    : options.fulfillmentStatus?.join(',');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use the order_details_with_pricing view which already joins orders with
      // retailers, magazines, and publishers correctly
      let query = supabase.from('order_details_with_pricing')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by publisher
      if (options.publisherId) {
        query = query.eq('publisher_id', options.publisherId);
      }

      if (options.retailerId) {
        query = query.eq('retailer_id', options.retailerId);
      }

      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.dateRange) {
        query = query
          .gte('created_at', options.dateRange.start.toISOString())
          .lte('created_at', options.dateRange.end.toISOString());
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Transform view data to match Order interface
      // Cast to any[] to handle new columns not yet in generated types
      const transformedOrders: Order[] = ((data as any[]) || []).map((item, index) => ({
        id: item.id || `temp-${index}`,
        // Stable reference from the order's own ID, so it matches the detail page
        order_number: formatOrderRef(item.id),
        status: item.status || 'pending',
        fulfillment_status: item.status || 'pending',
        // Older rows (and views without the column) fall back to the status.
        payment_status: item.payment_status ?? (item.status === 'pending' ? 'pending' : 'paid'),
        total_amount: Number(item.total_price) || 0,
        shipping_amount: 0,
        created_at: item.created_at || new Date().toISOString(),
        shipped_at: item.status === 'shipped' ? item.updated_at : null,
        tracking_number: item.tracking_number,
        carrier: item.carrier,
        shipping_address: parseShippingAddress(item.shipping_address),
        retailer: item.retailer_id ? {
          id: item.retailer_id,
          shop_name: item.retailer_shop_name,
          user_id: item.retailer_id,
        } : null,
        magazine: item.magazine_id && item.magazine_title && item.publisher_id ? {
          id: item.magazine_id,
          title: item.magazine_title,
          cover_image_url: item.cover_image_url,
          publisher_id: item.publisher_id,
        } : null,
        publisher_name: item.publisher_name ?? null,
        quantity: item.quantity || 0,
        unit_price: Number(item.unit_price) || 0,
      }));

      // Filter by fulfillment status if specified (not available in view query)
      let filteredOrders = transformedOrders;

      // Filter by fulfillment status if specified
      if (fulfillmentKey) {
        const wanted = fulfillmentKey.split(',');
        filteredOrders = filteredOrders.filter(
          order => wanted.includes(order.fulfillment_status)
        );
      }

      setOrders(filteredOrders);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [
    options.publisherId, 
    options.retailerId, 
    options.status, 
    fulfillmentKey,
    options.limit, 
    options.dateRange?.start.toISOString(), 
    options.dateRange?.end.toISOString()
  ]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, isLoading, error, refetch: fetchOrders };
};
