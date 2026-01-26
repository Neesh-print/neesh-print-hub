import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  shipping_address: string | null;
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
  quantity: number;
  unit_price: number;
}

export interface UseOrdersOptions {
  publisherId?: string;
  retailerId?: string;
  status?: 'pending' | 'paid' | 'packed' | 'shipped' | 'delivered' | 'all';
  fulfillmentStatus?: 'pending' | 'packed' | 'shipped' | 'delivered';
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use the order_details_with_pricing view which already joins orders with
      // retailers, magazines, and publishers correctly
      // Note: Cast to 'any' since views aren't included in generated types
      let query = (supabase.from as any)('order_details_with_pricing')
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
      // The view returns flat fields, not nested objects
      const transformedOrders: Order[] = (data || []).map((item: any, index: number) => ({
        id: item.id,
        order_number: `#${String(index + 1).padStart(4, '0')}`,
        status: item.status,
        fulfillment_status: item.status,
        payment_status: item.status === 'pending' ? 'pending' : 'paid',
        total_amount: Number(item.total_price) || 0,
        shipping_amount: 0,
        created_at: item.created_at,
        shipped_at: null,
        tracking_number: null, // Not in view
        carrier: null,
        shipping_address: null, // Not in view
        retailer: item.retailer_id ? {
          id: item.retailer_id, // View doesn't have retailer.id, use retailer_id
          shop_name: item.retailer_shop_name,
          user_id: item.retailer_id,
        } : null,
        magazine: item.magazine_id ? {
          id: item.magazine_id,
          title: item.magazine_title,
          cover_image_url: item.cover_image_url,
          publisher_id: item.publisher_id,
        } : null,

        quantity: item.quantity,
        unit_price: Number(item.unit_price) || 0,
      }));

      // Filter by fulfillment status if specified (not available in view query)
      let filteredOrders = transformedOrders;

      // Filter by fulfillment status if specified
      if (options.fulfillmentStatus) {
        filteredOrders = filteredOrders.filter(
          order => order.fulfillment_status === options.fulfillmentStatus
        );
      }

      setOrders(filteredOrders);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [options.publisherId, options.retailerId, options.status, options.fulfillmentStatus, options.limit, options.dateRange?.start, options.dateRange?.end]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, isLoading, error, refetch: fetchOrders };
};
