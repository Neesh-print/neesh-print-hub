import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Order {
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
      let query = supabase
        .from('orders')
        .select(`
          id,
          status,
          total_price,
          unit_price,
          quantity,
          created_at,
          updated_at,
          tracking_number,
          shipping_address,
          notes,
          retailer_id,
          magazine_id,
          retailers (
            id,
            shop_name,
            user_id
          ),
          magazines (
            id,
            title,
            cover_image_url,
            publisher_id
          )
        `)
        .order('created_at', { ascending: false });

      // Filter by publisher - get orders for magazines owned by this publisher
      if (options.publisherId) {
        query = query.eq('magazines.publisher_id', options.publisherId);
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

      // Transform data to match Order interface
      const transformedOrders: Order[] = (data || []).map((item: any, index: number) => ({
        id: item.id,
        order_number: `#${String(index + 1).padStart(4, '0')}`,
        status: item.status,
        fulfillment_status: item.status, // Using status as fulfillment_status since schema doesn't have separate field
        payment_status: item.status === 'pending' ? 'pending' : 'paid',
        total_amount: Number(item.total_price) || 0,
        shipping_amount: 0, // Not in current schema
        created_at: item.created_at,
        shipped_at: null, // Not in current schema
        tracking_number: item.tracking_number,
        carrier: null, // Not in current schema
        shipping_address: item.shipping_address,
        retailer: item.retailers ? {
          id: item.retailers.id,
          shop_name: item.retailers.shop_name,
          user_id: item.retailers.user_id,
        } : null,
        magazine: item.magazines ? {
          id: item.magazines.id,
          title: item.magazines.title,
          cover_image_url: item.magazines.cover_image_url,
          publisher_id: item.magazines.publisher_id,
        } : null,
        quantity: item.quantity,
        unit_price: Number(item.unit_price) || 0,
      }));

      // If filtering by publisher, filter out orders without matching magazines
      let filteredOrders = transformedOrders;
      if (options.publisherId) {
        filteredOrders = transformedOrders.filter(
          order => order.magazine?.publisher_id === options.publisherId
        );
      }

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
