import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface RetailerProfile {
  id: string;
  user_id: string;
  shop_name: string | null;
  shop_description: string | null;
  shop_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  instagram_handle: string | null;
  total_spent: number;
  total_orders: number;
  average_rating: number;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseRetailerProfileReturn {
  retailer: RetailerProfile | null;
  isLoading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<RetailerProfile>) => Promise<boolean>;
  refetch: () => void;
}

export const useRetailerProfile = (): UseRetailerProfileReturn => {
  const [retailer, setRetailer] = useState<RetailerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('retailers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        // If no record found, that's okay - retailer might not exist yet
        if (fetchError.code === 'PGRST116') {
          setRetailer(null);
          return;
        }
        throw fetchError;
      }

      if (data) {
        const transformed: RetailerProfile = {
          id: data.id,
          user_id: data.user_id,
          shop_name: data.shop_name,
          shop_description: data.shop_description,
          shop_url: data.shop_url,
          address: data.address,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
          country: data.country,
          phone: data.phone,
          instagram_handle: data.instagram_handle,
          total_spent: Number(data.total_spent) || 0,
          total_orders: data.total_orders || 0,
          average_rating: Number(data.average_rating) || 0,
          verified: data.verified || false,
          verified_at: data.verified_at,
          created_at: data.created_at || '',
          updated_at: data.updated_at || '',
        };
        setRetailer(transformed);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch retailer profile');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const updateProfile = async (updates: Partial<RetailerProfile>): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error: updateError } = await supabase
        .from('retailers')
        .update({
          shop_name: updates.shop_name,
          shop_description: updates.shop_description,
          shop_url: updates.shop_url,
          address: updates.address,
          city: updates.city,
          state: updates.state,
          postal_code: updates.postal_code,
          country: updates.country,
          phone: updates.phone,
          instagram_handle: updates.instagram_handle,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      await fetchProfile();
      return true;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      return false;
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { retailer, isLoading, error, updateProfile, refetch: fetchProfile };
};
