import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Frequency, TitleStatus } from "../../supabase/functions/_shared/index-listing";

// The publisher's listing on the Neesh Index (neesh.art/index), through the
// index-listing edge function. Only the publisher who claimed a listing gets
// anything back; everyone else gets empty lists, and the nav hides the page.

export interface IndexPublisher {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  city: string | null;
  country: string | null;
  stockist_page_url: string | null;
}

export interface IndexTitle {
  id: string;
  publisher_id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_path: string | null;
  cover_url: string | null;
  frequency: Frequency | null;
  cover_price: number | null;
  currency: string | null;
  trim_size: string | null;
  page_count: number | null;
  country: string | null;
  city: string | null;
  status: TitleStatus;
  last_issue_date: string | null;
  subscribe_url: string | null;
  directory_title_tags: { tag_id: string; is_primary: boolean }[];
}

export interface IndexTag {
  id: string;
  name: string;
  category: string | null;
}

export interface IndexListing {
  publishers: IndexPublisher[];
  titles: IndexTitle[];
  tags: IndexTag[];
  index_site?: string;
}

const KEY = ["index-listing"];

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("index-listing", { body });
  if (error) {
    // The function answers with { error } in plain words; surface that.
    let message = "That did not save. Try again in a minute.";
    try {
      const ctx = (error as { context?: Response }).context;
      const payload = ctx ? await ctx.json() : null;
      if (payload?.error) message = payload.error;
    } catch {
      // keep the default
    }
    throw new Error(message);
  }
  return data as T;
}

export function useIndexListing() {
  const { user, userRole } = useAuth();
  return useQuery({
    queryKey: KEY,
    queryFn: () => invoke<IndexListing>({ action: "get" }),
    enabled: Boolean(user) && userRole === "publisher",
    staleTime: 5 * 60 * 1000,
  });
}

/** True only for the publisher who owns a claimed Index listing. */
export function useOwnsIndexListing(): boolean {
  const { data } = useIndexListing();
  return Boolean(data && data.publishers.length > 0);
}

export function useSaveIndexPublisher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { publisher_id: string; fields: Record<string, unknown> }) =>
      invoke<{ ok: true; changed: boolean }>({ action: "save_publisher", ...args }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSaveIndexTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      title_id: string;
      fields: Record<string, unknown>;
      niches: { primary: string; others: string[]; identity: string[] };
      cover?: { data: string };
    }) => invoke<{ ok: true; changed: boolean }>({ action: "save_title", ...args }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
