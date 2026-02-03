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
  publication_date: string | null; // ISO date string (e.g., "2025-12-01")
  issue_frequency: string | null;
  volume_pricing_tiers: any | null;
  origin_country_code: string | null;
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
          publication_date,
          issue_frequency,
          volume_pricing_tiers,
          origin_country_code,
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
        const rawData = data as unknown as {
          id: string;
          title: string;
          cover_image_url: string | null;
          wholesale_price: number;
          suggested_retail_price: number;
          description: string | null;
          category: string | null;
          specs: string | null;
          issue_number: string | null;
          is_active: boolean;
          inventory_count: number;
          sold_count: number;
          created_at: string;
          publication_type: string | null;
          publication_date: string | null;
          issue_frequency: string | null;
          volume_pricing_tiers: unknown;
          origin_country_code: string | null;
          publishers: {
            id: string;
            company_name: string | null;
            description: string | null;
            website_url: string | null;
            instagram_handle: string | null;
          } | {
            id: string;
            company_name: string | null;
            description: string | null;
            website_url: string | null;
            instagram_handle: string | null;
          }[] | null;
        };

        const publisherData = Array.isArray(rawData.publishers) ? rawData.publishers[0] : rawData.publishers;

        const transformed: MagazineDetail = {
          id: rawData.id,
          title: rawData.title,
          cover_image_url: rawData.cover_image_url,
          wholesale_price: Number(rawData.wholesale_price) || 0,
          suggested_retail_price: Number(rawData.suggested_retail_price) || 0,
          price: Number(rawData.wholesale_price) || 0,
          description: rawData.description,
          category: rawData.category,
          specs: rawData.specs,
          issue_number: rawData.issue_number,
          is_active: rawData.is_active ?? true,
          inventory_count: rawData.inventory_count || 0,
          sold_count: rawData.sold_count || 0,
          created_at: rawData.created_at || '',
          publication_type: rawData.publication_type,
          publication_date: rawData.publication_date,
          issue_frequency: rawData.issue_frequency,
          volume_pricing_tiers: rawData.volume_pricing_tiers,
          origin_country_code: rawData.origin_country_code,
          publisher: publisherData ? {
            id: publisherData.id,
            company_name: publisherData.company_name,
            description: publisherData.description,
            website_url: publisherData.website_url,
            instagram_handle: publisherData.instagram_handle,
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
