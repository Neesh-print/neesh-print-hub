import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Magazine {
  id: string;
  title: string;
  cover_image_url: string | null;
  wholesale_price: number;
  retail_price: number;
  description: string | null;
  category: string | null;
  page_count: number | null;
  dimensions: string | null;
  issue_number: string | null;
  status: string;
  quantity_available: number;
  created_at: string;
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
}

export interface UseMagazinesReturn {
  magazines: Magazine[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useMagazines = (options: UseMagazinesOptions = {}): UseMagazinesReturn => {
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMagazines = useCallback(async () => {
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
          is_active,
          inventory_count,
          created_at,
          publisher_id,
          publishers (
            id,
            company_name,
            description
          )
        `)
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
        retail_price: Number(item.suggested_retail_price) || 0,
        description: item.description,
        category: item.category,
        page_count: null, // Not in current schema
        dimensions: item.specs,
        issue_number: item.issue_number,
        status: item.is_active ? 'active' : 'archived',
        quantity_available: item.inventory_count || 0,
        created_at: item.created_at,
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
  }, [options.publisherId, options.status, options.limit, options.searchQuery]);

  useEffect(() => {
    fetchMagazines();
  }, [fetchMagazines]);

  return { magazines, isLoading, error, refetch: fetchMagazines };
};
