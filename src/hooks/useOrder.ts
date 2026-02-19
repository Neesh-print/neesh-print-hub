import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseShippingAddress, ShippingAddress } from "@/utils/parseShippingAddress";

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
  shipping_address: ShippingAddress | null;
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
        const rawData = data as unknown as {
          id: string;
          status: string;
          total_price: number;
          unit_price: number;
          quantity: number;
          created_at: string;
          updated_at: string;
          tracking_number: string | null;
          shipping_address: string | null;
          notes: string | null;
          payment_intent_id: string | null;
          retailer_id: string | null;
          magazine_id: string | null;
          magazines: {
            id: string;
            title: string;
            cover_image_url: string | null;
            wholesale_price: number;
            publisher_id: string;
            publishers: {
              id: string;
              company_name: string | null;
            } | null;
          } | null;
        };

        const transformed: OrderDetail = {
          id: rawData.id,
          order_number: `#${rawData.id.slice(0, 4).toUpperCase()}`,
          status: rawData.status,
          fulfillment_status: rawData.status,
          payment_status: rawData.status === 'pending' ? 'pending' : 'paid',
          total_amount: Number(rawData.total_price) || 0,
          shipping_amount: 0,
          created_at: rawData.created_at || '',
          updated_at: rawData.updated_at || '',
          shipped_at: null,
          tracking_number: rawData.tracking_number,
          carrier: null,
          shipping_address: parseShippingAddress(rawData.shipping_address),
          notes: rawData.notes,
          payment_intent_id: rawData.payment_intent_id,
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
          magazine: rawData.magazines ? {
            id: rawData.magazines.id,
            title: rawData.magazines.title,
            cover_image_url: rawData.magazines.cover_image_url,
            wholesale_price: Number(rawData.magazines.wholesale_price) || 0,
            publisher: rawData.magazines.publishers ? {
              id: rawData.magazines.publishers.id,
              company_name: rawData.magazines.publishers.company_name,
            } : null,
          } : null,
          quantity: rawData.quantity,
          unit_price: Number(rawData.unit_price) || 0,
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
