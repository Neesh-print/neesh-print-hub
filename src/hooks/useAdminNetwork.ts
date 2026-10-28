import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NetworkPublisher {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  createdAt: string;
  approved: boolean;
  payoutsEnabled: boolean;
  /** Stripe's "currently due" requirements, e.g. bank details. */
  stripeDue: string[];
  hasStripeAccount: boolean;
  hasAddress: boolean;
  liveTitles: number;
}

export interface NetworkSpace {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  createdAt: string;
  location: string;
  type: string | null;
}

export interface AdminNetworkData {
  publishers: NetworkPublisher[];
  spaces: NetworkSpace[];
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Readable labels for Stripe requirement keys ("external_account" → "bank details"). */
const STRIPE_REQUIREMENT_LABEL: Record<string, string> = {
  external_account: "bank details",
  tos_acceptance: "Stripe terms",
  business_type: "business type",
  representative: "representative details",
  individual: "personal details",
  company: "company details",
};

const stripeDueOf = (value: unknown): string[] => {
  const due = (value as { currently_due?: string[]; past_due?: string[] } | null) ?? null;
  const keys = [...(due?.past_due ?? []), ...(due?.currently_due ?? [])];
  return [...new Set(keys.map((k) => STRIPE_REQUIREMENT_LABEL[k.split(".")[0]] ?? k.split(".")[0].replace(/_/g, " ")))];
};

async function fetchAdminNetwork(): Promise<AdminNetworkData> {
  const [pubs, spaces, mags, addresses, apps] = await Promise.all([
    supabase.from("publishers").select("*").order("created_at", { ascending: false }),
    supabase.from("retailers").select("*").order("created_at", { ascending: false }),
    supabase.from("magazines").select("publisher_id, is_active"),
    supabase.from("publisher_shipping_settings").select("publisher_id, ships_from_address"),
    supabase.from("publisher_applications").select("user_id, business_name, email"),
  ]);
  for (const res of [pubs, spaces, mags, addresses, apps]) if (res.error) throw res.error;

  const pubRows = (pubs.data ?? []) as Row[];
  const spaceRows = (spaces.data ?? []) as Row[];
  const userIds = [...new Set([...pubRows, ...spaceRows].map((r) => str(r.user_id)).filter(Boolean))];
  const { data: users, error: usersError } = userIds.length
    ? await supabase.from("users").select("id, email").in("id", userIds)
    : { data: [] as { id: string; email: string }[], error: null };
  if (usersError) throw usersError;
  const emailByUser = new Map((users ?? []).map((u) => [u.id, u.email]));
  const appByUser = new Map((apps.data ?? []).filter((a) => a.user_id).map((a) => [a.user_id as string, a]));

  const liveTitles = new Map<string, number>();
  for (const m of mags.data ?? []) {
    if (m.is_active && m.publisher_id) liveTitles.set(m.publisher_id, (liveTitles.get(m.publisher_id) ?? 0) + 1);
  }
  const withAddress = new Set(
    (addresses.data ?? [])
      .filter((s) => (s.ships_from_address as { line1?: string } | null)?.line1)
      .map((s) => s.publisher_id),
  );

  return {
    publishers: pubRows
      // Test accounts are flagged by the admin migration; until it's applied the column is absent.
      .filter((p) => p.is_test !== true)
      .map((p) => {
        const userId = str(p.user_id) || null;
        const app = userId ? appByUser.get(userId) : undefined;
        return {
          id: str(p.id),
          userId,
          name: str(p.company_name) || app?.business_name || "Unknown publisher",
          email: (userId && emailByUser.get(userId)) || app?.email || "",
          createdAt: str(p.created_at),
          approved: p.application_status === "approved",
          payoutsEnabled: p.stripe_payouts_enabled === true,
          stripeDue: stripeDueOf(p.stripe_requirements_due),
          hasStripeAccount: !!p.stripe_account_id,
          hasAddress: withAddress.has(str(p.id)),
          liveTitles: liveTitles.get(str(p.id)) ?? 0,
        };
      }),
    spaces: spaceRows
      .filter((r) => r.is_test !== true)
      .map((r) => {
        const userId = str(r.user_id) || null;
        return {
          id: str(r.id),
          userId,
          name: str(r.shop_name) || "Unnamed space",
          email: str(r.contact_email) || (userId && emailByUser.get(userId)) || "",
          createdAt: str(r.created_at),
          location: [str(r.city), str(r.state) || str(r.country)].filter(Boolean).join(", "),
          type: Array.isArray(r.store_types) && r.store_types.length ? String(r.store_types[0]) : null,
        };
      }),
  };
}

/** Publishers and spaces with their setup, for the admin v2 Network screen. */
export function useAdminNetwork() {
  return useQuery({ queryKey: ["admin-network"], queryFn: fetchAdminNetwork, staleTime: 60_000 });
}
