import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PublisherProfile {
  id: string;
  user_id: string;
  company_name: string | null;
  description: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  total_magazines: number;
  total_sales: number;
  average_rating: number;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  stripe_account_id: string | null;
  avatar_url: string | null;
}

export interface UsePublisherProfileReturn {
  publisher: PublisherProfile | null;
  isLoading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<PublisherProfile>) => Promise<boolean>;
  refetch: () => void;
}

export const usePublisherProfile = (): UsePublisherProfileReturn => {
  const [publisher, setPublisher] = useState<PublisherProfile | null>(null);
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
        .from('publishers')
        .select('*, magazines(count)')
        .eq('user_id', user.id)
        .single();

      // Fetch avatar_url from profiles separately
      const { data: profileData } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        // If no record found, that's okay - publisher might not exist yet
        if (fetchError.code === 'PGRST116') {
          setPublisher(null);
          return;
        }
        throw fetchError;
      }

      if (data) {
        const transformed: PublisherProfile = {
          id: data.id,
          user_id: data.user_id,
          company_name: data.company_name,
          description: data.description,
          website_url: data.website_url,
          instagram_handle: data.instagram_handle,
          // Live count from the magazines relation (total_magazines column dropped).
          total_magazines: (data as { magazines?: { count: number }[] }).magazines?.[0]?.count ?? 0,
          total_sales: Number(data.total_sales) || 0,
          average_rating: Number(data.average_rating) || 0,
          verified: data.verified || false,
          verified_at: data.verified_at,
          created_at: data.created_at || '',
          updated_at: data.updated_at || '',
          stripe_account_id: data.stripe_account_id,
          avatar_url: profileData?.avatar_url || null,
        };
        setPublisher(transformed);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch publisher profile');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const updateProfile = async (updates: Partial<PublisherProfile>): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error: updateError } = await supabase
        .from('publishers')
        .update({
          company_name: updates.company_name,
          description: updates.description,
          website_url: updates.website_url,
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

  return { publisher, isLoading, error, updateProfile, refetch: fetchProfile };
};
