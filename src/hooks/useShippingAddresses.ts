import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRetailerProfile } from './useRetailerProfile';
import type { ShippingAddress, ShippingAddressFormData } from '@/types/shipping';

export function useShippingAddresses() {
  const { retailer } = useRetailerProfile();
  
  return useQuery({
    queryKey: ['shipping-addresses', retailer?.id],
    queryFn: async () => {
      if (!retailer?.id) return [];
      
      const { data, error } = await supabase
        .from('shipping_addresses')
        .select('*')
        .eq('retailer_id', retailer.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ShippingAddress[];
    },
    enabled: !!retailer?.id,
  });
}

export function useCreateShippingAddress() {
  const queryClient = useQueryClient();
  const { retailer } = useRetailerProfile();

  return useMutation({
    mutationFn: async (data: ShippingAddressFormData) => {
      if (!retailer?.id) throw new Error('No retailer found');

      // If this is set as default, unset other defaults first
      if (data.is_default) {
        await supabase
          .from('shipping_addresses')
          .update({ is_default: false })
          .eq('retailer_id', retailer.id);
      }

      const { data: address, error } = await supabase
        .from('shipping_addresses')
        .insert({
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
          is_default: data.is_default,
        })
        .select()
        .single();

      if (error) throw error;
      return address;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['retailer'] });
    },
  });
}

export function useUpdateShippingAddress() {
  const queryClient = useQueryClient();
  const { retailer } = useRetailerProfile();

  return useMutation({
    mutationFn: async ({ id, ...data }: ShippingAddressFormData & { id: string }) => {
      if (!retailer?.id) throw new Error('No retailer found');

      // If setting as default, unset other defaults first
      if (data.is_default) {
        await supabase
          .from('shipping_addresses')
          .update({ is_default: false })
          .eq('retailer_id', retailer.id)
          .neq('id', id);
      }

      const { data: address, error } = await supabase
        .from('shipping_addresses')
        .update({
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
          is_default: data.is_default,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return address;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-addresses'] });
    },
  });
}

export function useDeleteShippingAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase
        .from('shipping_addresses')
        .delete()
        .eq('id', addressId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['retailer'] });
    },
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  const { retailer } = useRetailerProfile();

  return useMutation({
    mutationFn: async (addressId: string) => {
      if (!retailer?.id) throw new Error('No retailer found');

      // Unset all other defaults
      await supabase
        .from('shipping_addresses')
        .update({ is_default: false })
        .eq('retailer_id', retailer.id);

      // Set new default
      const { error } = await supabase
        .from('shipping_addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-addresses'] });
    },
  });
}
