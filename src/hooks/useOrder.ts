import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  fulfillment_status: string;
  payment_status: string;
  total_amount: number;
  shipping_amount: number;
  created_at: string;
  updated_at: string;
  shipped_at: string | null;
  tracking_number: string | null;
  carrier: string | null;
  shipping_address: string | null;
  notes: string | null;
  payment_intent_id: string | null;
  retailer: {
    id: string;
    shop_name: string | null;
    user_id: string;
    address: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    phone: string | null;
  } | null;
  magazine: {
    id: string;
    title: string;
    cover_image_url: string | null;
    wholesale_price: number;
    publisher: {
      id: string;
      company_name: string | null;
    } | null;
  } | null;
  quantity: number;
  unit_price: number;
}

export interface UseOrderReturn {
  order: OrderDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useOrder = (orderId: string | undefined): UseOrderReturn => {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch order with magazines (no retailers join - FK points to users, not retailers)
      const { data, error: fetchError } = await supabase
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
          payment_intent_id,
          retailer_id,
          magazine_id,
          magazines (
            id,
            title,
            cover_image_url,
            wholesale_price,
            publisher_id,
            publishers (
              id,
              company_name
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // Fetch retailer info separately using retailer_id as user_id
      let retailerData = null;
      if (data?.retailer_id) {
        const { data: retailer } = await supabase
          .from('retailers')
          .select('id, shop_name, user_id, address, city, state, postal_code, country, phone')
          .eq('user_id', data.retailer_id)
          .maybeSingle();
        retailerData = retailer;
      }

      if (data) {
        const transformed: OrderDetail = {
          id: data.id,
          order_number: `#${data.id.slice(0, 4).toUpperCase()}`,
          status: data.status,
          fulfillment_status: data.status,
          payment_status: data.status === 'pending' ? 'pending' : 'paid',
          total_amount: Number(data.total_price) || 0,
          shipping_amount: 0,
          created_at: data.created_at || '',
          updated_at: data.updated_at || '',
          shipped_at: null,
          tracking_number: data.tracking_number,
          carrier: null,
          shipping_address: data.shipping_address,
          notes: data.notes,
          payment_intent_id: data.payment_intent_id,
          retailer: retailerData ? {
            id: retailerData.id,
            shop_name: retailerData.shop_name,
            user_id: retailerData.user_id,
            address: retailerData.address,
            city: retailerData.city,
            state: retailerData.state,
            postal_code: retailerData.postal_code,
            country: retailerData.country,
            phone: retailerData.phone,
          } : null,
          magazine: (data as any).magazines ? {
            id: (data as any).magazines.id,
            title: (data as any).magazines.title,
            cover_image_url: (data as any).magazines.cover_image_url,
            wholesale_price: Number((data as any).magazines.wholesale_price) || 0,
            publisher: (data as any).magazines.publishers ? {
              id: (data as any).magazines.publishers.id,
              company_name: (data as any).magazines.publishers.company_name,
            } : null,
          } : null,
          quantity: data.quantity,
          unit_price: Number(data.unit_price) || 0,
        };
        setOrder(transformed);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order');
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  return { order, isLoading, error, refetch: fetchOrder };
};
