import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRetailerProfile } from './useRetailerProfile';
import type { ShippingAddress, ShippingAddressFormData } from '@/types/shipping';

/**
 * Hook for managing a single shipping address per retailer.
 * Simplified from the multi-address version.
 */
export function useShippingAddress() {
  const { retailer } = useRetailerProfile();
  
  const query = useQuery({
    queryKey: ['shipping-address', retailer?.id],
    queryFn: async () => {
      if (!retailer?.id) return null;
      
      const { data, error } = await supabase
        .from('shipping_addresses')
        .select('*')
        .eq('retailer_id', retailer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as ShippingAddress | null;
    },
    enabled: !!retailer?.id,
  });

  return {
    address: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useSaveShippingAddress() {
  const queryClient = useQueryClient();
  const { retailer } = useRetailerProfile();

  return useMutation({
    mutationFn: async (data: ShippingAddressFormData & { id?: string }) => {
      if (!retailer?.id) throw new Error('No retailer found');

      const addressData = {
        retailer_id: retailer.id,
        label: data.label || null,
        recipient_name: data.recipient_name,
        company_name: data.company_name || null,
        address_line_1: data.address_line_1,
        address_line_2: data.address_line_2 || null,
        city: data.city,
        state: data.state,
        postal_code: data.postal_code,
        country: data.country || 'US',
        phone: data.phone || null,
        delivery_instructions: data.delivery_instructions || null,
        is_default: true, // Always default since it's the only one
      };

      if (data.id) {
        // Update existing address
        const { data: address, error } = await supabase
          .from('shipping_addresses')
          .update({
            ...addressData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.id)
          .select()
          .single();

        if (error) throw error;
        return address;
      } else {
        // Create new address (delete any existing first to ensure only one)
        await supabase
          .from('shipping_addresses')
          .delete()
          .eq('retailer_id', retailer.id);

        const { data: address, error } = await supabase
          .from('shipping_addresses')
          .insert(addressData)
          .select()
          .single();

        if (error) throw error;
        return address;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-address'] });
      queryClient.invalidateQueries({ queryKey: ['shipping-addresses'] }); // Also invalidate old key
      queryClient.invalidateQueries({ queryKey: ['retailer'] });
    },
  });
}
