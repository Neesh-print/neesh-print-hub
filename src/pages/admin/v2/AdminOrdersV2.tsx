import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { differenceInCalendarDays, format } from "date-fns";
import { useNudge } from "@/hooks/useNudge";
import { lateOrderNudge } from "@/lib/adminNudges";
import { Loader2, Search } from "lucide-react";
import { AdminV2Layout } from "@/components/admin/v2/AdminV2Layout";
import { Badge, PayoutBadge, StageBadge } from "@/components/admin/v2/badges";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAdminOverview } from "@/hooks/useAdminOverview";
import { useAdminOrderActions } from "@/hooks/useAdminOrderActions";
import {
  ageInDays,
  inView,
  money,
  payoutStateOf,
  problemsOf,
  stageOf,
  type OrderProblem,
  type OrderStage,
  type OrderView,
  type OverviewOrder,
} from "@/lib/adminOverview";
import { trackingUrl } from "@/lib/tracking";
import { cn } from "@/lib/utils";

const VIEWS: { view: OrderView; label: string }[] = [
  { view: "all", label: "All" },
  { view: "to_ship", label: "To ship" },
  { view: "packed", label: "Packed" },
  { view: "shipped", label: "Shipped" },
  { view: "delivered", label: "Delivered" },
  { view: "payout_ready", label: "Payout ready" },
  { view: "problems", label: "Problems" },
];

const PROBLEM_LABEL: Record<OrderProblem, string> = {
  no_address: "No address",
  late: "Late",
  stuck_packed: "Packed, no scan",
  payout_failed: "Payout failed",
  payment_issue: "Payment issue",
};

const btn =
  "inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 font-display text-[13px] font-semibold [font-variation-settings:'wdth'_114] disabled:opacity-50";
const btnDark = `${btn} bg-foreground text-background hover:bg-foreground/90`;
const btnLine = `${btn} border border-border bg-background text-foreground hover:border-[#b79adb]`;
const btnAccent = `${btn} bg-accent text-accent-foreground hover:bg-accent/90`;

const STEPS: { stage: OrderStage; label: string }[] = [
  { stage: "to_ship", label: "Paid" },
  { stage: "packed", label: "Packed" },
  { stage: "shipped", label: "Shipped" },
  { stage: "delivered", label: "Delivered" },
];
const RANK: Partial<Record<OrderStage, number>> = { to_ship: 0, packed: 1, shipped: 2, delivered: 3 };

const NEXT_STEP: Partial<Record<OrderStage, { status: "processing" | "shipped" | "delivered"; label: string }>> = {
  to_ship: { status: "processing", label: "Mark packed" },
  packed: { status: "shipped", label: "Mark shipped" },
  shipped: { status: "delivered", label: "Mark delivered" },
};

const OrderPanel = ({ order, onClose }: { order: OverviewOrder; onClose: () => void }) => {
  const { releasePayouts, setOrderStatus, busy } = useAdminOrderActions();
  const nudge = useNudge();
  const stage = stageOf(order.status);
  const payout = payoutStateOf(order);
  const rank = RANK[stage] ?? -1;
  const next = NEXT_STEP[stage];
  const t = order.transfer;

  const trackUrl = trackingUrl(order.carrier, order.trackingNumber);
  const stepNote = (s: OrderStage): React.ReactNode => {
    if (s === "to_ship") return `${format(new Date(order.createdAt), "MMM d")} · ${order.spaceName}`;
    if (s === "packed" && order.trackingNumber) {
      return (
        <>
          {order.carrier ?? "Carrier"} ·{" "}
          {trackUrl ? (
            <a href={trackUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent underline">
              {order.trackingNumber}
            </a>
          ) : (
            `tracking ${order.trackingNumber}`
          )}
        </>
      );
    }
    if (s === "packed") return "Label and tracking added";
    if (s === "shipped") return "First carrier scan";
    return "Updates from the carrier";
  };

  return (
    <SheetContent className="flex w-full flex-col gap-5 overflow-y-auto sm:max-w-md">
      <SheetHeader className="text-left">
        <div className="font-mono text-xs tracking-[0.14em] text-accent">{order.ref}</div>
        <SheetTitle className="font-display text-2xl font-semibold tracking-tight [font-variation-settings:'wdth'_114]">
          {order.title} × {order.quantity}
        </SheetTitle>
        <SheetDescription>
          {order.issue ? `${order.issue} · ` : ""}
          {order.publisherName} → {order.spaceName}
          {order.spaceIsInternal ? " (internal)" : ""}
        </SheetDescription>
      </SheetHeader>

      {problemsOf(order, new Date()).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {problemsOf(order, new Date()).map((p) => (
            <Badge key={p} tone={p === "payout_failed" || p === "no_address" ? "error" : "pending"}>
              {PROBLEM_LABEL[p]}
            </Badge>
          ))}
        </div>
      )}

      <ol className="flex flex-col">
        {STEPS.map((s, i) => {
          const done = RANK[s.stage]! <= rank;
          return (
            <li key={s.stage} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "mt-1 h-3 w-3 rounded-full",
                    done ? "bg-foreground" : "border-2 border-border bg-background",
                  )}
                />
                <span className="my-1 w-0.5 flex-1 bg-border" />
              </div>
              <div className="pb-4">
                <div className={cn("text-sm font-bold", !done && "text-muted-foreground")}>{s.label}</div>
                <div className="text-[13px] text-muted-foreground">{done || i === rank + 1 ? stepNote(s.stage) : ""}</div>
              </div>
            </li>
          );
        })}
        <li className="flex gap-3.5">
          <span
            className={cn(
              "mt-1 h-3 w-3 rounded-full",
              payout === "paid_out" ? "bg-foreground" : "border-2 border-accent bg-background",
            )}
          />
          <div>
            <div className="text-sm font-bold">Paid out</div>
            <div className="text-[13px] text-muted-foreground">
              {payout === "paid_out" && t?.transferredAt
                ? format(new Date(t.transferredAt), "MMM d, h:mm a")
                : payout === "failed"
                  ? t?.failureReason ?? "Stripe rejected the transfer"
                  : <PayoutBadge state={payout} />}
            </div>
          </div>
        </li>
      </ol>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-secondary p-4 text-sm">
        <dt className="text-muted-foreground">Space paid</dt>
        <dd className="text-right font-semibold">{money(order.total)}</dd>
        <dt className="text-muted-foreground">Neesh fees</dt>
        <dd className="text-right font-semibold">{t ? money(t.fee) : "—"}</dd>
        <dt className="text-muted-foreground">Publisher gets</dt>
        <dd className="text-right font-bold">{t ? money(t.net) : "—"}</dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        {payout === "ready" && t && (
          <button type="button" className={cn(btnAccent, "flex-1")} disabled={busy === t.id} onClick={() => releasePayouts([t.id], t.id)}>
            {busy === t.id && <Loader2 className="h-4 w-4 animate-spin" />}
            Release {money(t.net)}
          </button>
        )}
        {next && (
          <button type="button" className={btnDark} disabled={busy === order.id} onClick={() => setOrderStatus(order.id, order.status, next.status)}>
            {next.label}
          </button>
        )}
        <button
          type="button"
          className={btnLine}
          onClick={() => {
            const problems = problemsOf(order, new Date());
            const draft = problems.includes("late")
              ? lateOrderNudge(order, ageInDays(order, new Date()))
              : problems.includes("stuck_packed")
                ? lateOrderNudge(order, differenceInCalendarDays(new Date(), new Date(order.updatedAt ?? order.createdAt)), true)
                : "";
            nudge({ userId: order.publisherUserId, id: order.publisherId, name: order.publisherName, type: "publisher" }, draft);
          }}
        >
          Message publisher
        </button>
        <Link to={`/admin/orders/${order.id}`} className={btnLine} onClick={onClose}>
          Tracking, refunds
        </Link>
      </div>
    </SheetContent>
  );
};

export const AdminOrdersV2 = () => {
  const { data, isLoading, error, dataUpdatedAt } = useAdminOverview();
  const [params, setParams] = useSearchParams();
  // ?q= prefills the search, so a publisher or space page can link to its orders.
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const view = (params.get("view") as OrderView) || "all";
  const openId = params.get("order");
  // Ages are measured from when the data was loaded.
  const now = useMemo(() => new Date(dataUpdatedAt || Date.now()), [dataUpdatedAt]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const orders = useMemo(() => data?.orders ?? [], [data]);
  const counts = useMemo(
    () => Object.fromEntries(VIEWS.map((v) => [v.view, orders.filter((o) => inView(o, v.view, now)).length])),
    [orders, now],
  );
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => inView(o, view, now))
      .filter(
        (o) =>
          !q ||
          [o.ref, o.title, o.publisherName, o.spaceName].some((field) => field.toLowerCase().includes(q.replace(/^#/, ""))),
      );
  }, [orders, view, search, now]);
  const open = orders.find((o) => o.id === openId) ?? null;

  return (
    <AdminV2Layout>
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl font-bold tracking-tight [font-variation-settings:'wdth'_114]">Orders</h1>
          <div className="flex flex-wrap items-center gap-2">
            {view === "to_ship" && rows.length > 0 && (
              <Link to={`/admin/fulfillment/print?orders=${rows.map((o) => o.id).join(",")}`} className={btnLine}>
                Print {rows.length} packing slip{rows.length === 1 ? "" : "s"}
              </Link>
            )}
            <label className="flex h-10 w-full max-w-xs items-center gap-2 rounded-full border border-border px-3.5">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Search orders</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order #, title, publisher, space"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>
        </header>

        <div role="tablist" aria-label="Saved views" className="flex flex-wrap gap-2">
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
            <Loader2 className="h-4 w-4 animate-spin" /> Loading orders
          </div>
        ) : error ? (
          <p className="text-destructive">Couldn't load orders: {error instanceof Error ? error.message : "unknown error"}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[11px] tracking-[0.12em] text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">ORDER</th>
                  <th scope="col" className="px-4 py-3 font-medium">PUBLISHER → SPACE</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">TOTAL</th>
                  <th scope="col" className="px-4 py-3 font-medium">STATUS</th>
                  <th scope="col" className="px-4 py-3 font-medium">PAYOUT</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No orders here.
                    </td>
                  </tr>
                )}
                {rows.map((o) => {
                  const stage = stageOf(o.status);
                  const problems = problemsOf(o, now);
                  const age = ageInDays(o, now);
                  return (
                    <tr
                      key={o.id}
                      className={cn(
                        "cursor-pointer border-b border-border/50 last:border-b-0 hover:bg-secondary/60",
                        o.id === openId && "bg-secondary shadow-[inset_3px_0_0_hsl(var(--accent))]",
                      )}
                      onClick={() => setParam("order", o.id)}
                    >
                      <td className="px-4 py-3.5">
                        <button type="button" className="text-left" onClick={() => setParam("order", o.id)}>
                          <span className="block font-semibold">
                            {o.title} <span className="font-medium text-muted-foreground">× {o.quantity}</span>
                          </span>
                          <span className="block font-mono text-xs text-muted-foreground">
                            {o.ref} · {format(new Date(o.createdAt), "MMM d")}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        {o.publisherName} <span className="text-muted-foreground">→</span> {o.spaceName}
                        {o.spaceIsInternal && <span className="ml-1.5 text-xs text-muted-foreground">internal</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold">{money(o.total)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StageBadge stage={stage} />
                          {problems
                            .filter((p) => p !== "payout_failed")
                            .map((p) => (
                              <Badge key={p} tone={p === "no_address" ? "error" : "pending"}>
                                {PROBLEM_LABEL[p]}
                              </Badge>
                            ))}
                          {stage === "to_ship" && problems.length === 0 && (
                            <span className="text-xs text-muted-foreground">{age <= 0 ? "today" : `${age}d`}</span>
                          )}
                          {(stage === "packed" || stage === "shipped" || stage === "delivered") &&
                            (trackingUrl(o.carrier, o.trackingNumber) ? (
                              <a
                                href={trackingUrl(o.carrier, o.trackingNumber)!}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-semibold text-accent underline"
                              >
                                Track{o.carrier ? ` (${o.carrier})` : ""}
                              </a>
                            ) : (
                              o.carrier && <span className="text-xs text-muted-foreground">{o.carrier}</span>
                            ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <PayoutBadge state={payoutStateOf(o)} />
                          {o.transfer && <span className="text-[13px] text-muted-foreground">{money(o.transfer.net)}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          To ship → Packed (tracking added, not scanned yet) → Shipped (first carrier scan) → Delivered. The payout is ready at Packed.
        </p>
      </div>

      <Sheet open={!!open} onOpenChange={(isOpen) => !isOpen && setParam("order", null)}>
        {open && <OrderPanel order={open} onClose={() => setParam("order", null)} />}
      </Sheet>
    </AdminV2Layout>
  );
};

export default AdminOrdersV2;
