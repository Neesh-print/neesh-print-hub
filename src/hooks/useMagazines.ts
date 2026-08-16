import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Magazine {
  [key: string]: unknown; // Index signature for DataTable compatibility
  id: string;
  title: string;
  cover_image_url: string | null;
  wholesale_price: number;
  suggested_retail_price: number;
  price: number; // Alias for wholesale_price
  description: string | null;
  category: string | null;
  specs: string | null;
  issue_number: string | null;
  issue_frequency: string | null;
  publication_type: string | null;
  publication_date: string | null; // ISO date string (e.g., "2025-12-01")
  is_active: boolean;
  inventory_count: number;
  sold_count: number;
  created_at: string;
  origin_country_code: string | null;
  fulfillment_method: string | null;
  publisher: {
    id: string;
    company_name: string | null;
    description: string | null;
  } | null;
}

export interface UseMagazinesOptions {
  publisherId?: string;
  status?: 'active' | 'archived' | 'all';
  limit?: number;
  searchQuery?: string;
  enabled?: boolean;
}

export interface UseMagazinesReturn {
  magazines: Magazine[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useMagazines = (options: UseMagazinesOptions = {}): UseMagazinesReturn => {
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [isLoading, setIsLoading] = useState(options.enabled !== false);
  const [error, setError] = useState<string | null>(null);




  const fetchMagazines = useCallback(async () => {
    if (options.enabled === false) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
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
          issue_frequency,
          publication_type,
          publication_date,
          is_active,
          inventory_count,
          sold_count,
          created_at,
          origin_country_code,
          fulfillment_method,
          publisher_id,
          publishers (
            id,
            company_name,
            description
          )
        `)
        .order('publication_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (options.publisherId) {
        query = query.eq('publisher_id', options.publisherId);
      }

      if (options.status && options.status !== 'all') {
        query = query.eq('is_active', options.status === 'active');
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.searchQuery) {
        query = query.ilike('title', `%${options.searchQuery}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Transform data to match Magazine interface
      const transformedMagazines: Magazine[] = (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        cover_image_url: item.cover_image_url,
        wholesale_price: Number(item.wholesale_price) || 0,
        suggested_retail_price: Number(item.suggested_retail_price) || 0,
        price: Number(item.wholesale_price) || 0,
        description: item.description,
        category: item.category,
        specs: item.specs,
        issue_number: item.issue_number,
        issue_frequency: item.issue_frequency,
        publication_type: item.publication_type,
        publication_date: item.publication_date,
        is_active: item.is_active ?? false,
        inventory_count: item.inventory_count || 0,
        sold_count: item.sold_count || 0,
        created_at: item.created_at,
        origin_country_code: item.origin_country_code,
        fulfillment_method: item.fulfillment_method ?? null,
        publisher: item.publishers ? {
          id: item.publishers.id,
          company_name: item.publishers.company_name,
          description: item.publishers.description,
        } : null,
      }));

      setMagazines(transformedMagazines);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch magazines');
    } finally {
      setIsLoading(false);
    }
  }, [options.publisherId, options.status, options.limit, options.searchQuery, options.enabled]);

  useEffect(() => {
    fetchMagazines();
  }, [fetchMagazines]);

  return { magazines, isLoading, error, refetch: fetchMagazines };
};
