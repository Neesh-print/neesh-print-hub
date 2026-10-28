import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatOrderRef } from "@/lib/orderStatus";
import type { OverviewOrder } from "@/lib/adminOverview";

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
    supabase.from("publishers").select("id, company_name, stripe_payouts_enabled, application_status"),
    supabase.from("retailers").select("user_id, shop_name"),
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
  const spaces = new Map((spacesRes.data ?? []).map((r) => [r.user_id, r.shop_name]));
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
      publisherCanBePaid: !!publisher?.stripe_payouts_enabled,
      spaceId: o.retailer_id,
      spaceName: (o.retailer_id && spaces.get(o.retailer_id)) || "Unknown space",
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

  const approved = (publishersRes.data ?? []).filter((p) => p.application_status === "approved");
  const withAddress = new Set(
    (addressesRes.data ?? [])
      .filter((s) => (s.ships_from_address as { line1?: string } | null)?.line1)
      .map((s) => s.publisher_id),
  );

  const [pubWaiting, spaceWaiting, drafts, titlesMissingData, titlesNoName] = await Promise.all([
    count(supabase.from("publisher_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "pending"])),
    count(supabase.from("retailer_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "pending"])),
    count(supabase.from("publisher_applications").select("id", { count: "exact", head: true }).eq("status", "draft")),
    count(
      supabase
        .from("magazines")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .or("wholesale_price.is.null,weight_grams.is.null"),
    ),
    count(supabase.from("magazines").select("id", { count: "exact", head: true }).eq("is_active", true).or("title.is.null,title.eq.")),
  ]);

  return {
    orders,
    review: {
      applicationsWaiting: pubWaiting + spaceWaiting,
      applicationDrafts: drafts,
      publishersCantBePaid: approved.filter((p) => !p.stripe_payouts_enabled).length,
      publishersWithoutAddress: approved.filter((p) => !withAddress.has(p.id)).length,
      titlesNeedingAttention: titlesMissingData + titlesNoName,
      spacesTotal: spacesRes.data?.length ?? 0,
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
