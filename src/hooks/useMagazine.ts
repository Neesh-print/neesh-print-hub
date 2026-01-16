import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MagazineDetail {
  id: string;
  title: string;
  cover_image_url: string | null;
  wholesale_price: number;
  suggested_retail_price: number;
  price: number;
  description: string | null;
  category: string | null;
  specs: string | null;
  issue_number: string | null;
  is_active: boolean;
  inventory_count: number;
  sold_count: number;
  created_at: string;
  publication_type: string | null;
  issue_frequency: string | null;
  volume_pricing_tiers: any | null;
  publisher: {
    id: string;
    company_name: string | null;
    description: string | null;
    website_url: string | null;
    instagram_handle: string | null;
  } | null;
}

export interface UseMagazineReturn {
  magazine: MagazineDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useMagazine = (magazineId: string | undefined): UseMagazineReturn => {
  const [magazine, setMagazine] = useState<MagazineDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMagazine = useCallback(async () => {
    if (!magazineId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('magazines')
        .select(`
          id,
          title,
          cover_image_url,
          wholesale_price,
          suggested_retail_price,
          description,
          category,
          specs,
          issue_number,
          is_active,
          inventory_count,
          sold_count,
          created_at,
          publication_type,
          issue_frequency,
          volume_pricing_tiers,
          publisher_id,
          publishers (
            id,
            company_name,
            description,
            website_url,
            instagram_handle
          )
        `)
        .eq('id', magazineId)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        const transformed: MagazineDetail = {
          id: data.id,
          title: data.title,
          cover_image_url: data.cover_image_url,
          wholesale_price: Number(data.wholesale_price) || 0,
          suggested_retail_price: Number(data.suggested_retail_price) || 0,
          price: Number(data.wholesale_price) || 0,
          description: data.description,
          category: data.category,
          specs: data.specs,
          issue_number: data.issue_number,
          is_active: data.is_active ?? true,
          inventory_count: data.inventory_count || 0,
          sold_count: data.sold_count || 0,
          created_at: data.created_at || '',
          publication_type: data.publication_type,
          issue_frequency: data.issue_frequency,
          volume_pricing_tiers: data.volume_pricing_tiers,
          publisher: (data as any).publishers ? {
            id: (data as any).publishers.id,
            company_name: (data as any).publishers.company_name,
            description: (data as any).publishers.description,
            website_url: (data as any).publishers.website_url,
            instagram_handle: (data as any).publishers.instagram_handle,
          } : null,
        };
        setMagazine(transformed);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch magazine');
    } finally {
      setIsLoading(false);
    }
  }, [magazineId]);

  useEffect(() => {
    fetchMagazine();
  }, [fetchMagazine]);

  return { magazine, isLoading, error, refetch: fetchMagazine };
};
