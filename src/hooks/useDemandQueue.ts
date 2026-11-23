import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Demand queue (demand-signal spec, Automations 1 and 2): shop suggestions
// waiting for review and publisher emails waiting to be sent. Reads come
// straight from the tables (admin-only RLS); every change goes through the
// demand-review edge function. Hand-written types until the generated
// Supabase types are refreshed.
const db = supabase as unknown as SupabaseClient;

export type SuggestionStatus = "new" | "verifying" | "needs_review" | "approved" | "rejected" | "duplicate";
export type Confidence = "confirmed" | "likely" | "unverified";
export type RejectReason = "not_stocked" | "closed" | "spam" | "other";
export type OutreachStatus = "draft" | "approved" | "sent" | "skipped";

export interface SuggestionEvidence {
  checked_at?: string;
  store?: { id: string; name: string; city: string | null; country: string; slug: string };
  place?: { name: string; address: string | null; country: string | null; website: string | null; maps_url: string };
  places_note?: string;
  website?: string;
  title_hit?: { url: string; snippet: string };
  duplicate_of?: string;
  existing_stockist_id?: string;
  spam?: string;
  error?: string;
}

export interface Suggestion {
  id: string;
  shop_name: string;
  city: string;
  email: string | null;
  status: SuggestionStatus;
  confidence: Confidence | null;
  evidence: SuggestionEvidence;
  reject_reason: RejectReason | null;
  created_at: string;
  reviewed_at: string | null;
  title: { name: string; slug: string; available_on_neesh: boolean } | null;
}

export interface OutreachRow {
  id: string;
  recipient_email: string;
  recipient_type: "publisher" | "reader" | "space";
  template: string;
  subject: string | null;
  body: string | null;
  status: OutreachStatus;
  skip_reason: string | null;
  demand_signal_ids: number[];
  created_at: string;
  sent_at: string | null;
  title: { name: string; slug: string } | null;
  publisher: { name: string } | null;
}

export interface DemandQueue {
  suggestions: Suggestion[];
  outreach: OutreachRow[];
}

const QUEUE_KEY = ["admin-demand-queue"];

export const useDemandQueue = () =>
  useQuery({
    queryKey: QUEUE_KEY,
    queryFn: async (): Promise<DemandQueue> => {
      const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const [s, o] = await Promise.all([
        db
          .from("directory_stockist_suggestions")
          .select(
            "id, shop_name, city, email, status, confidence, evidence, reject_reason, created_at, reviewed_at, title:directory_titles(name, slug, available_on_neesh)",
          )
          .or(`status.in.(new,verifying,needs_review),created_at.gte.${since}`)
          .order("created_at", { ascending: false })
          .limit(300),
        db
          .from("outreach_log")
          .select(
            "id, recipient_email, recipient_type, template, subject, body, status, skip_reason, demand_signal_ids, created_at, sent_at, title:directory_titles(name, slug), publisher:directory_publishers(name)",
          )
          .order("created_at", { ascending: false })
          .limit(300),
      ]);
      if (s.error) throw new Error(s.error.message);
      if (o.error) throw new Error(o.error.message);
      return {
        suggestions: (s.data ?? []) as unknown as Suggestion[],
        outreach: (o.data ?? []) as unknown as OutreachRow[],
      };
    },
  });

type Action =
  | { action: "approve_suggestion"; id: string }
  | { action: "approve_confirmed" }
  | { action: "reject_suggestion"; id: string; reason: RejectReason }
  | { action: "reverify_suggestion"; id: string }
  | { action: "run_verify" }
  | { action: "run_drafts" }
  | { action: "run_loop" }
  | { action: "preview_rollup" }
  | { action: "update_draft"; id: string; subject: string; body: string }
  | { action: "send_outreach"; id: string }
  | { action: "skip_outreach"; id: string; reason: string };

export interface DemandActionResult {
  ok: boolean;
  revalidated?: boolean;
  approved?: number;
  failed?: { id: string; error: string }[];
  results?: { id: string; status: string }[];
  drafted?: { title: string; template?: string }[];
  needsContact?: string[];
  skipped?: { title: string; reason?: string }[];
  loop?: { label: string; action: string; detail?: string }[];
  thanks?: string;
  rollup?: { subject: string; html: string; empty: boolean };
}

export async function runDemandAction(body: Action): Promise<DemandActionResult> {
  const { data, error } = await supabase.functions.invoke("demand-review", { body });
  if (error) {
    // Surface the function's own message ("this title is flagged do not contact").
    const context = (error as { context?: Response }).context;
    const detail = context ? await context.json().catch(() => null) : null;
    throw new Error(detail?.error ?? error.message);
  }
  return data as DemandActionResult;
}

export const useDemandAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runDemandAction,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUEUE_KEY });
      // Today's Review card and the nav badge count the same queue.
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
};
