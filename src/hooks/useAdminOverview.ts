import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatOrderRef } from "@/lib/orderStatus";
import type { OverviewOrder } from "@/lib/adminOverview";
import { needsAttention } from "@/lib/adminCatalog";

export interface AdminReviewCounts {
  applicationsWaiting: number;
  applicationDrafts: number;
  publishersCantBePaid: number;
  publishersWithoutAddress: number;
  titlesNeedingAttention: number;
  spacesTotal: number;
}

export interface AdminOverviewData {
  orders: OverviewOrder[];
  review: AdminReviewCounts;
}

type OrderRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  status: string;
  quantity: number | null;
  total_price: number | string | null;
  shipping_address: unknown;
  carrier: string | null;
  tracking_number: string | null;
  retailer_id: string | null;
  magazine: { title: string | null; issue_number: string | null; publisher_id: string | null } | null;
};

const hasAddress = (value: unknown) => {
  if (!value) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return typeof value === "object" && Object.keys(value as object).length > 0;
};

async function count(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count: n, error } = await query;
  if (error) throw error;
  return n ?? 0;
}

async function fetchAdminOverview(): Promise<AdminOverviewData> {
  const [ordersRes, publishersRes, spacesRes, transfersRes, addressesRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, created_at, updated_at, status, quantity, total_price, shipping_address, carrier, tracking_number, retailer_id, magazine:magazines(title, issue_number, publisher_id)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("publishers").select("*"),
    // "*" so is_internal and is_test come through; the generated types predate them.
    supabase.from("retailers").select("*"),
    supabase
      .from("publisher_transfers")
      .select("id, order_id, status, net_amount, platform_fee, hold_reason, failure_reason, transferred_at")
      .eq("kind", "goods"),
    supabase.from("publisher_shipping_settings").select("publisher_id, ships_from_address"),
  ]);
  for (const res of [ordersRes, publishersRes, spacesRes, transfersRes, addressesRes]) {
    if (res.error) throw res.error;
  }

  const publishers = new Map((publishersRes.data ?? []).map((p) => [p.id, p]));
  const spaceRows = (spacesRes.data ?? []) as { user_id: string | null; shop_name: string | null; is_internal?: boolean; is_test?: boolean }[];
  const spaces = new Map(spaceRows.map((r) => [r.user_id, r]));
  const transfers = new Map((transfersRes.data ?? []).filter((t) => t.order_id).map((t) => [t.order_id as string, t]));

  const orders: OverviewOrder[] = ((ordersRes.data ?? []) as unknown as OrderRow[]).map((o) => {
    const publisher = o.magazine?.publisher_id ? publishers.get(o.magazine.publisher_id) : undefined;
    const t = transfers.get(o.id);
    return {
      id: o.id,
      ref: formatOrderRef(o.id),
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      status: o.status,
      quantity: o.quantity ?? 0,
      total: Number(o.total_price ?? 0),
      title: o.magazine?.title || "Untitled",
      issue: o.magazine?.issue_number || null,
      publisherId: o.magazine?.publisher_id ?? null,
      publisherName: publisher?.company_name || "Unknown publisher",
      publisherUserId: publisher?.user_id ?? null,
      publisherCanBePaid: !!publisher?.stripe_payouts_enabled,
      spaceId: o.retailer_id,
      spaceName: (o.retailer_id && spaces.get(o.retailer_id)?.shop_name) || "Unknown space",
      spaceIsInternal: !!(o.retailer_id && spaces.get(o.retailer_id)?.is_internal),
      hasAddress: hasAddress(o.shipping_address),
      carrier: o.carrier,
      trackingNumber: o.tracking_number,
      transfer: t
        ? {
            id: t.id,
            status: t.status,
            net: Number(t.net_amount),
            fee: Number(t.platform_fee),
            holdReason: t.hold_reason,
            failureReason: t.failure_reason,
            transferredAt: t.transferred_at,
          }
        : null,
    };
  });

  // Test accounts (is_test) aren't counted; they're hidden from Network too.
  const approved = ((publishersRes.data ?? []) as { id: string; stripe_payouts_enabled: boolean | null; application_status: string | null; is_test?: boolean }[])
    .filter((p) => p.application_status === "approved" && !p.is_test);
  const withAddress = new Set(
    (addressesRes.data ?? [])
      .filter((s) => (s.ships_from_address as { line1?: string } | null)?.line1)
      .map((s) => s.publisher_id),
  );

  const [pubWaiting, spaceWaiting, drafts, liveTitles] = await Promise.all([
    count(supabase.from("publisher_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "pending"])),
    count(supabase.from("retailer_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "pending"])),
    count(supabase.from("publisher_applications").select("id", { count: "exact", head: true }).eq("status", "draft")),
    supabase
      .from("magazines")
      .select("id, title, cover_image_url, wholesale_price, suggested_retail_price, weight_grams, inventory_count, fulfillment_method, is_active, publisher_id")
      .eq("is_active", true),
  ]);
  if (liveTitles.error) throw liveTitles.error;
  // Same rule as Catalog's "Needs attention" tab, so the two numbers match.
  const titlesNeedingAttention = (liveTitles.data ?? []).filter((m) =>
    needsAttention({
      id: m.id,
      title: m.title,
      issue: null,
      coverUrl: m.cover_image_url,
      publisherId: m.publisher_id,
      publisherName: "",
      isActive: m.is_active,
      wholesalePrice: m.wholesale_price,
      retailPrice: m.suggested_retail_price,
      weightGrams: m.weight_grams,
      inventory: m.inventory_count,
      publisherHandled: m.fulfillment_method !== "neesh_handled",
    }),
  ).length;

  return {
    orders,
    review: {
      applicationsWaiting: pubWaiting + spaceWaiting,
      applicationDrafts: drafts,
      publishersCantBePaid: approved.filter((p) => !p.stripe_payouts_enabled).length,
      publishersWithoutAddress: approved.filter((p) => !withAddress.has(p.id)).length,
      titlesNeedingAttention,
      spacesTotal: spaceRows.filter((r) => !r.is_test).length,
    },
  };
}

/** Orders, payouts and setup counts for the admin v2 screens. */
export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin-overview"],
    queryFn: fetchAdminOverview,
    staleTime: 30_000,
  });
}
