import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminV2Layout } from "@/components/admin/v2/AdminV2Layout";
import { Badge, type BadgeTone } from "@/components/admin/v2/badges";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  PROBLEM_LABEL,
  displayTitle,
  inCatalogView,
  needsAttention,
  problemsOf,
  statusOf,
  type CatalogTitle,
  type CatalogView,
  type TitleStatus,
} from "@/lib/adminCatalog";
import { money } from "@/lib/adminOverview";
import { SALE_STATUSES } from "@/lib/orderStatus";
import { fetchAll } from "@/lib/fetchAll";
import { cn } from "@/lib/utils";

const btn =
  "inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 font-display text-[13px] font-semibold [font-variation-settings:'wdth'_114] disabled:opacity-50";
const btnDark = `${btn} bg-foreground text-background hover:bg-foreground/90`;
const btnLine = `${btn} border border-border bg-background text-foreground hover:border-[#b79adb]`;
const btnDanger = `${btn} border border-destructive/40 bg-background text-destructive hover:bg-destructive/10`;

const VIEWS: { view: CatalogView; label: string }[] = [
  { view: "all", label: "All" },
  { view: "live", label: "Live" },
  { view: "needs_attention", label: "Needs attention" },
  { view: "low_stock", label: "Low stock" },
  { view: "suspended", label: "Suspended" },
  { view: "archived", label: "Archived" },
];

const STATUS_LABEL: Record<TitleStatus, string> = { live: "Live", suspended: "Suspended", archived: "Archived" };
const STATUS_TONE: Record<TitleStatus, BadgeTone> = { live: "success", suspended: "pending", archived: "neutral" };

type Sales = { units: number; revenue: number };
type Row = CatalogTitle & { sales: Sales };

async function fetchCatalog(): Promise<Row[]> {
  type MagRow = {
    id: string;
    title: string | null;
    issue_number: string | null;
    cover_image_url: string | null;
    publisher_id: string;
    is_active: boolean | null;
    wholesale_price: number | string | null;
    suggested_retail_price: number | string | null;
    weight_grams: number | null;
    inventory_count: number | null;
    fulfillment_method: string | null;
    publisher: { company_name: string | null; user_id: string | null; is_test?: boolean } | null;
  };
  type OrderRow = { magazine_id: string | null; quantity: number | null; total_price: number | string | null; status: string; payment_status: string | null };
  const [mags, orders, apps] = await Promise.all([
    fetchAll<MagRow>((from, to) =>
      supabase
        .from("magazines")
        .select(
          // publishers(*) so is_test comes through; the generated types predate it.
          "id, title, issue_number, cover_image_url, publisher_id, is_active, wholesale_price, suggested_retail_price, weight_grams, inventory_count, fulfillment_method, publisher:publishers(*)",
        )
        .order("title")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: MagRow[] | null; error: unknown }>,
    ),
    fetchAll<OrderRow>((from, to) =>
      supabase.from("orders").select("magazine_id, quantity, total_price, status, payment_status").order("id").range(from, to),
    ),
    supabase.from("publisher_applications").select("user_id, business_name"),
  ]);
  if (apps.error) throw apps.error;
  const businessName = new Map((apps.data ?? []).filter((a) => a.user_id && a.business_name).map((a) => [a.user_id as string, a.business_name as string]));

  const sales = new Map<string, Sales>();
  for (const o of orders) {
    // Same rule as the other admin screens: refunded or written-off isn't a sale.
    if (!o.magazine_id || !SALE_STATUSES.includes(o.status) || ["refunded", "written_off"].includes(o.payment_status ?? "")) continue;
    const s = sales.get(o.magazine_id) ?? { units: 0, revenue: 0 };
    s.units += o.quantity ?? 0;
    s.revenue += Number(o.total_price ?? 0);
    sales.set(o.magazine_id, s);
  }

  return mags
    // Titles from test accounts stay out of the catalog, as they do in Network.
    .filter((m) => !m.publisher?.is_test)
    .map((m) => ({
      id: m.id,
      title: m.title,
      issue: m.issue_number || null,
      coverUrl: m.cover_image_url,
      publisherId: m.publisher_id,
      publisherName:
        m.publisher?.company_name || (m.publisher?.user_id && businessName.get(m.publisher.user_id)) || "Unknown publisher",
      isActive: m.is_active,
      wholesalePrice: m.wholesale_price == null ? null : Number(m.wholesale_price),
      retailPrice: m.suggested_retail_price == null ? null : Number(m.suggested_retail_price),
      weightGrams: m.weight_grams,
      inventory: m.inventory_count,
      publisherHandled: m.fulfillment_method !== "neesh_handled",
      sales: sales.get(m.id) ?? { units: 0, revenue: 0 },
    }));
}

const TitlePanel = ({ t, onClose }: { t: Row; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<boolean | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const status = statusOf(t.isActive);
  const problems = problemsOf(t);

  const setStatus = async (isActive: boolean | null) => {
    setBusy(true);
    const { error } = await supabase
      .from("magazines")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", t.id);
    setBusy(false);
    setConfirm(undefined);
    if (error) {
      toast.error(`Couldn't update the title: ${error.message}`);
      return;
    }
    toast.success(isActive === true ? "Title is live" : isActive === false ? "Title archived" : "Title suspended");
    queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    onClose();
  };

  const actionLabel = (v: boolean | null) => (v === true ? "Make live" : v === false ? "Archive" : "Suspend");

  return (
    <SheetContent className="flex w-full flex-col gap-5 overflow-y-auto sm:max-w-md">
      <SheetHeader className="text-left">
        <div>
          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
        </div>
        <SheetTitle className="font-display text-2xl font-semibold tracking-tight [font-variation-settings:'wdth'_114]">
          {displayTitle(t)}
        </SheetTitle>
        <SheetDescription>
          {t.issue ? `${t.issue} · ` : ""}
          {t.publisherName}
        </SheetDescription>
      </SheetHeader>

      <div className="flex gap-4">
        {t.coverUrl ? (
          <img src={t.coverUrl} alt="" className="h-32 w-24 shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded bg-secondary text-xs text-muted-foreground">No cover</div>
        )}
        <dl className="grid flex-1 grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Wholesale</dt>
          <dd>{t.wholesalePrice == null ? "—" : money(t.wholesalePrice)}</dd>
          <dt className="text-muted-foreground">Retail</dt>
          <dd>{t.retailPrice == null ? "—" : money(t.retailPrice)}</dd>
          <dt className="text-muted-foreground">Weight</dt>
          <dd>{t.weightGrams ? `${t.weightGrams} g` : "—"}</dd>
          <dt className="text-muted-foreground">In stock</dt>
          <dd>
            {t.inventory ?? "—"}
            {!t.publisherHandled && <span className="text-muted-foreground"> (held by Neesh)</span>}
          </dd>
          <dt className="text-muted-foreground">Sold</dt>
          <dd>
            {t.sales.units} · {money(t.sales.revenue)}
          </dd>
        </dl>
      </div>

      {problems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {problems.map((p) => (
            <Badge key={p} tone={p === "low_stock" || p === "no_cover" || p === "no_retail_price" ? "pending" : "error"}>
              {PROBLEM_LABEL[p]}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link to={`/publisher/titles/${t.id}/edit`} className={cn(btnDark, "flex-1")}>
          Edit title
        </Link>
        <Link to={`/admin/publishers/${t.publisherId}`} className={btnLine}>
          Publisher
        </Link>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="font-mono text-xs font-medium tracking-[0.14em] text-muted-foreground">STATUS</h3>
        {confirm === undefined ? (
          <div className="flex flex-wrap gap-2">
            {status !== "live" && (
              <button type="button" className={btnLine} onClick={() => setConfirm(true)}>
                Make live
              </button>
            )}
            {status !== "suspended" && (
              <button type="button" className={btnLine} onClick={() => setConfirm(null)}>
                Suspend
              </button>
            )}
            {status !== "archived" && (
              <button type="button" className={btnDanger} onClick={() => setConfirm(false)}>
                Archive
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary p-3 text-sm">
            <span className="flex-1">
              {confirm === true
                ? "Spaces will be able to order it again."
                : confirm === false
                  ? "It leaves the catalog. The publisher can restore it themselves."
                  : "It's hidden while you look into it. Only an admin can make it live again."}
            </span>
            <button type="button" className={btnLine} onClick={() => setConfirm(undefined)}>
              Cancel
            </button>
            <button type="button" className={btnDark} disabled={busy} onClick={() => setStatus(confirm)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {actionLabel(confirm)}
            </button>
          </div>
        )}
      </div>
    </SheetContent>
  );
};

export const AdminCatalog = () => {
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-catalog"], queryFn: fetchCatalog, staleTime: 60_000 });
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const view = (params.get("view") as CatalogView) || "all";
  const openId = params.get("id");

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const titles = useMemo(() => data ?? [], [data]);
  const counts = useMemo(
    () => Object.fromEntries(VIEWS.map((v) => [v.view, titles.filter((t) => inCatalogView(t, v.view)).length])),
    [titles],
  );
  const q = search.trim().toLowerCase();
  const rows = titles
    .filter((t) => inCatalogView(t, view))
    .filter((t) => !q || [t.title ?? "", t.issue ?? "", t.publisherName].some((f) => f.toLowerCase().includes(q)))
    // Problems first in "All", so nothing that needs fixing hides at the bottom.
    .sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)) || displayTitle(a).localeCompare(displayTitle(b)));
  const open = titles.find((t) => t.id === openId) ?? null;

  return (
    <AdminV2Layout>
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl font-bold tracking-tight [font-variation-settings:'wdth'_114]">Catalog</h1>
          <label className="flex h-10 w-full max-w-xs items-center gap-2 rounded-full border border-border px-3.5">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Search titles</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title, issue or publisher"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        </header>

        <div role="tablist" aria-label="Views" className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.view}
              type="button"
              role="tab"
              aria-selected={view === v.view}
              onClick={() => setParam("view", v.view === "all" ? null : v.view)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold",
                view === v.view ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-secondary",
              )}
            >
              {v.label} <span className="font-medium opacity-70">{counts[v.view] ?? 0}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the catalog
          </div>
        ) : error ? (
          <p className="text-destructive">Couldn't load the catalog: {error instanceof Error ? error.message : "unknown error"}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[11px] tracking-[0.12em] text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">TITLE</th>
                  <th scope="col" className="px-4 py-3 font-medium">PUBLISHER</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">WHOLESALE / RETAIL</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">STOCK</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">SOLD</th>
                  <th scope="col" className="px-4 py-3 font-medium">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      No titles here.
                    </td>
                  </tr>
                )}
                {rows.map((t) => {
                  const status = statusOf(t.isActive);
                  const problems = problemsOf(t).filter((p) => p !== "no_cover" && p !== "no_retail_price");
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setParam("id", t.id)}
                      className={cn(
                        "cursor-pointer border-b border-border/50 last:border-b-0 hover:bg-secondary/60",
                        status !== "live" && "text-muted-foreground",
                        t.id === openId && "bg-secondary shadow-[inset_3px_0_0_hsl(var(--accent))]",
                      )}
                    >
                      <td className="px-4 py-3">
                        <button type="button" className="flex items-center gap-3 text-left" onClick={() => setParam("id", t.id)}>
                          {t.coverUrl ? (
                            <img src={t.coverUrl} alt="" className="h-12 w-9 shrink-0 rounded-sm object-cover" />
                          ) : (
                            <span className="h-12 w-9 shrink-0 rounded-sm bg-secondary" aria-hidden="true" />
                          )}
                          <span>
                            <span className={cn("block font-semibold", !t.title?.trim() && "text-destructive")}>{displayTitle(t)}</span>
                            {t.issue && <span className="block text-xs text-muted-foreground">{t.issue}</span>}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">{t.publisherName}</td>
                      <td className="px-4 py-3 text-right">
                        {t.wholesalePrice == null ? "—" : money(t.wholesalePrice)}
                        <span className="text-muted-foreground"> / {t.retailPrice == null ? "—" : money(t.retailPrice)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{t.inventory ?? "—"}</td>
                      <td className="px-4 py-3 text-right">{t.sales.units}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                          {status === "live" &&
                            problems.map((p) => (
                              <Badge key={p} tone={p === "low_stock" ? "pending" : "error"}>
                                {PROBLEM_LABEL[p]}
                              </Badge>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={!!open} onOpenChange={(isOpen) => !isOpen && setParam("id", null)}>
        {open && <TitlePanel t={open} onClose={() => setParam("id", null)} />}
      </Sheet>
    </AdminV2Layout>
  );
};

export default AdminCatalog;
