import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { differenceInCalendarDays, format } from "date-fns";
import { useNudge, type NudgeTarget } from "@/hooks/useNudge";
import { lateOrderNudge, setupNudge } from "@/lib/adminNudges";
import { Loader2 } from "lucide-react";
import { AdminV2Layout } from "@/components/admin/v2/AdminV2Layout";
import { Badge } from "@/components/admin/v2/badges";
import { useAdminOverview } from "@/hooks/useAdminOverview";
import { useAdminOrderActions } from "@/hooks/useAdminOrderActions";
import {
  ageInDays,
  money,
  needsYouCount,
  problemsOf,
  summarizeToday,
  type OverviewOrder,
} from "@/lib/adminOverview";

const btn =
  "inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 font-display text-[13px] font-semibold [font-variation-settings:'wdth'_114] disabled:opacity-50";
const btnDark = `${btn} bg-foreground text-background hover:bg-foreground/90`;
const btnLine = `${btn} border border-border bg-background text-foreground hover:border-[#b79adb]`;
const btnAccent = `${btn} bg-accent text-accent-foreground hover:bg-accent/90`;

const SectionHead = ({ title, count, sub, action }: { title: string; count?: number; sub?: string; action?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
    <div>
      <h2 className="font-display text-xl font-semibold tracking-tight [font-variation-settings:'wdth'_114]">
        {title} {count !== undefined && <span className="font-medium text-muted-foreground">{count}</span>}
      </h2>
      {sub && <p className="mt-0.5 text-[13px] text-muted-foreground">{sub}</p>}
    </div>
    {action}
  </div>
);

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border/50 px-5 py-3.5 last:border-b-0">{children}</div>
);

const OrderLine = ({ order }: { order: OverviewOrder }) => (
  <div className="min-w-0 flex-1 basis-64">
    <div className="text-sm font-semibold">
      {order.title} <span className="font-medium text-muted-foreground">× {order.quantity}</span>
    </div>
    <div className="text-[13px] text-muted-foreground">
      {order.publisherName} → {order.spaceName} · <span className="font-mono text-xs">{order.ref}</span>
    </div>
  </div>
);

const publisherOf = (o: OverviewOrder): NudgeTarget => ({
  userId: o.publisherUserId,
  id: o.publisherId,
  name: o.publisherName,
  type: "publisher",
});

export const AdminToday = () => {
  const { data, isLoading, error, dataUpdatedAt } = useAdminOverview();
  const { releasePayouts, setOrderStatus, busy } = useAdminOrderActions();
  const nudge = useNudge();
  // Ages and "today" are measured from when the data was loaded.
  const now = useMemo(() => new Date(dataUpdatedAt || Date.now()), [dataUpdatedAt]);
  // Off by default; remembered per browser. Only the 7-day numbers change.
  const [excludeInternal, setExcludeInternal] = useState(() => {
    try {
      return localStorage.getItem("admin.excludeInternal") === "1";
    } catch {
      return false;
    }
  });
  const toggleInternal = (on: boolean) => {
    setExcludeInternal(on);
    try {
      localStorage.setItem("admin.excludeInternal", on ? "1" : "0");
    } catch {
      // Private windows can block storage; the switch still works for this visit.
    }
  };
  const today = useMemo(
    () => (data ? summarizeToday(data.orders, now, { excludeInternal }) : null),
    [data, now, excludeInternal],
  );

  if (isLoading || !data || !today) {
    return (
      <AdminV2Layout>
        {error ? (
          <p className="text-destructive">Couldn't load today: {error instanceof Error ? error.message : "unknown error"}</p>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading today
          </div>
        )}
      </AdminV2Layout>
    );
  }

  const { review } = data;
  const total = needsYouCount(today, review.applicationsWaiting);
  const readyTotal = today.ready.reduce((s, o) => s + (o.transfer?.net ?? 0), 0);
  const payoutCount = today.ready.length + today.failed.length + today.blocked.length;

  const pulse = [
    { label: "SALES · 7 DAYS", value: money(today.pulse.sales7d), sub: `${today.pulse.orders7d} orders`, to: "/admin/analytics" },
    { label: "NEESH FEES", value: money(today.pulse.fees7d), sub: "10% from each side", to: "/admin/analytics" },
    {
      label: "PAID OUT · 7 DAYS",
      value: money(today.pulse.paidOut7d),
      sub: today.pulse.paidOutTo.join(", ") || "Nothing yet",
      to: "/admin/orders?view=all",
    },
    {
      label: "SPACES ORDERING",
      value: `${today.pulse.spacesOrdering90d} of ${review.spacesTotal - (excludeInternal ? review.internalSpaces : 0)}`,
      sub: "in the last 90 days",
      to: "/admin/network?type=spaces",
    },
  ];

  const reviewItems = [
    {
      n: review.applicationsWaiting,
      what: "Applications waiting",
      sub: `${review.applicationDrafts} draft${review.applicationDrafts === 1 ? "" : "s"} not submitted`,
      to: "/admin/applications",
    },
    { n: review.publishersCantBePaid, what: "Publishers can't be paid", sub: "Stripe setup not finished", to: "/admin/network?setup=payouts" },
    { n: review.publishersWithoutAddress, what: "No ships-from address", sub: "Shipping can't be quoted for their titles", to: "/admin/network?setup=address" },
    { n: review.titlesNeedingAttention, what: "Titles need attention", sub: "Missing title, price or weight, or out of stock", to: "/admin/magazines?view=needs_attention" },
  ];

  return (
    <AdminV2Layout>
      <div className="flex flex-col gap-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs font-medium tracking-[0.14em] text-accent">{format(now, "EEEE, MMM d").toUpperCase()}</div>
            <h1 className="mt-1.5 font-display text-4xl font-bold tracking-tight [font-variation-settings:'wdth'_114]">Today</h1>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              {total === 0 ? "Nothing needs you. Everything is running." : `${total} thing${total === 1 ? "" : "s"} need${total === 1 ? "s" : ""} you.`}
            </p>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <Switch checked={excludeInternal} onCheckedChange={toggleInternal} />
            Exclude internal
          </label>
        </header>

        <section aria-label="Last 7 days" className="grid grid-cols-2 overflow-hidden rounded-lg border border-border lg:grid-cols-4">
          {pulse.map((p) => (
            <Link key={p.label} to={p.to} className="border-b border-r border-border px-5 py-4 hover:bg-secondary lg:border-b-0">
              <div className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground">{p.label}</div>
              <div className="mt-1.5 font-display text-2xl font-bold tracking-tight [font-variation-settings:'wdth'_114]">{p.value}</div>
              <div className="truncate text-[13px] text-muted-foreground">{p.sub}</div>
            </Link>
          ))}
        </section>

        <div className="flex flex-wrap items-start gap-7">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-7">
            <section aria-label="To ship" className="rounded-lg border border-border">
              <SectionHead
                title="To ship"
                count={today.toShip.length}
                sub="Publishers ship. Step in when they're late."
                action={
                  <Link to="/admin/orders?view=to_ship" className="text-[13px] font-semibold text-accent">
                    Open in Orders
                  </Link>
                }
              />
              {today.toShip.length + today.stuckPacked.length === 0 && (
                <p className="px-5 py-4 text-sm text-muted-foreground">Nothing waiting to ship.</p>
              )}
              {today.toShip.map((o) => {
                const problems = problemsOf(o, now);
                const age = ageInDays(o, now);
                return (
                  <Row key={o.id}>
                    <OrderLine order={o} />
                    {problems.includes("no_address") ? (
                      <Badge tone="error">No address</Badge>
                    ) : (
                      <Badge tone={problems.includes("late") ? "pending" : "neutral"}>
                        {age <= 0 ? "Today" : `${age} day${age === 1 ? "" : "s"}`}
                      </Badge>
                    )}
                    <div className="flex gap-2">
                      {problems.includes("no_address") ? (
                        <Link to={`/admin/orders/${o.id}`} className={btnDark}>
                          Open order
                        </Link>
                      ) : (
                        <>
                          {problems.includes("late") && (
                            <button type="button" className={btnLine} onClick={() => nudge(publisherOf(o), lateOrderNudge(o, age))}>
                              Nudge publisher
                            </button>
                          )}
                          <Link to={`/admin/orders?order=${o.id}`} className={btnLine}>
                            Open
                          </Link>
                          <button
                            type="button"
                            className={btnDark}
                            disabled={busy === o.id}
                            onClick={() => setOrderStatus(o.id, o.status, "processing")}
                          >
                            Mark packed
                          </button>
                        </>
                      )}
                    </div>
                  </Row>
                );
              })}
              {today.stuckPacked.length > 0 && (
                <div className="flex items-center justify-between gap-3 border-y border-border bg-secondary/50 px-5 py-2.5">
                  <span className="text-[13px] font-semibold">
                    Packed, no carrier scan for {"3+"} days <span className="font-medium text-muted-foreground">{today.stuckPacked.length}</span>
                  </span>
                  <Link to="/admin/orders?view=problems" className="text-[13px] font-semibold text-accent">
                    Open in Problems
                  </Link>
                </div>
              )}
              {today.stuckPacked.map((o) => (
                <Row key={o.id}>
                  <OrderLine order={o} />
                  <Badge tone="pending">Packed, no scan</Badge>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={btnLine}
                      onClick={() =>
                        nudge(publisherOf(o), lateOrderNudge(o, differenceInCalendarDays(now, new Date(o.updatedAt ?? o.createdAt)), true))
                      }
                    >
                      Nudge publisher
                    </button>
                    <button type="button" className={btnDark} disabled={busy === o.id} onClick={() => setOrderStatus(o.id, o.status, "shipped")}>
                      Mark shipped
                    </button>
                  </div>
                </Row>
              ))}
            </section>

            <section aria-label="Payouts" className="rounded-lg border border-border">
              <SectionHead
                title="Payouts"
                count={payoutCount}
                sub="Ready as soon as an order is packed with tracking."
                action={
                  today.ready.length > 0 ? (
                    <button
                      type="button"
                      className={btnAccent}
                      disabled={busy === "release-all"}
                      onClick={() => releasePayouts(today.ready.map((o) => o.transfer!.id), "release-all")}
                    >
                      {busy === "release-all" && <Loader2 className="h-4 w-4 animate-spin" />}
                      Release {today.ready.length} · {money(readyTotal)}
                    </button>
                  ) : undefined
                }
              />
              {payoutCount === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">No payouts waiting on you.</p>}
              {today.ready.map((o) => (
                <Row key={o.id}>
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="text-sm font-semibold">
                      {o.publisherName} <span className="font-bold">{money(o.transfer!.net)}</span>
                    </div>
                    <div className="text-[13px] text-muted-foreground">
                      {o.title} × {o.quantity} · <span className="font-mono text-xs">{o.ref}</span>
                    </div>
                  </div>
                  <Badge tone="success">Ready</Badge>
                  <button
                    type="button"
                    className={btnLine}
                    disabled={busy === o.transfer!.id}
                    onClick={() => releasePayouts([o.transfer!.id], o.transfer!.id)}
                  >
                    Release
                  </button>
                </Row>
              ))}
              {today.failed.map((o) => (
                <Row key={o.id}>
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="text-sm font-semibold">
                      {o.publisherName} <span className="font-bold">{money(o.transfer!.net)}</span>
                    </div>
                    <div className="text-[13px] text-muted-foreground">{o.transfer!.failureReason ?? "Stripe rejected the transfer"}</div>
                  </div>
                  <Badge tone="error">Failed</Badge>
                  <Link to={`/admin/orders?order=${o.id}`} className={btnLine}>
                    Open
                  </Link>
                </Row>
              ))}
              {today.blocked.map((b) => (
                <Row key={b.publisherId ?? b.publisherName}>
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="text-sm font-semibold">
                      {b.publisherName} <span className="font-bold">{money(b.amount)}</span>
                    </div>
                    <div className="text-[13px] text-muted-foreground">
                      {b.orderCount} order{b.orderCount === 1 ? "" : "s"} · Stripe setup not finished
                    </div>
                  </div>
                  <Badge tone="pending">Blocked</Badge>
                  <button
                    type="button"
                    className={btnLine}
                    onClick={() =>
                      nudge(
                        { userId: b.publisherUserId, id: b.publisherId, name: b.publisherName, type: "publisher" },
                        setupNudge(["Stripe payouts"], b.amount, b.orderCount),
                      )
                    }
                  >
                    Nudge
                  </button>
                </Row>
              ))}
            </section>
          </div>

          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-7">
            <section aria-label="Review" className="flex flex-col gap-3.5 rounded-lg border border-border px-5 py-4">
              <h2 className="font-display text-xl font-semibold tracking-tight [font-variation-settings:'wdth'_114]">Review</h2>
              {reviewItems.map((r) => (
                <Link key={r.what} to={r.to} className="flex items-baseline gap-3 border-b border-border/50 pb-3 last:border-b-0 hover:text-accent">
                  <span className="min-w-[34px] font-display text-[22px] font-bold [font-variation-settings:'wdth'_114]">{r.n}</span>
                  <span className="text-sm leading-snug">
                    <strong>{r.what}</strong>
                    <br />
                    <span className="text-[13px] text-muted-foreground">{r.sub}</span>
                  </span>
                </Link>
              ))}
            </section>

            <section aria-label="Today so far" className="flex flex-col gap-3 rounded-lg bg-secondary px-5 py-4">
              <h2 className="font-mono text-xs font-medium tracking-[0.14em] text-muted-foreground">TODAY SO FAR</h2>
              {today.activity.length === 0 && <p className="text-[13px] text-muted-foreground">No shipments or payouts yet today.</p>}
              {today.activity.map((a) => (
                <div key={`${a.at}-${a.text}`} className="flex gap-3 text-[13px] leading-snug">
                  <span className="min-w-[64px] font-mono text-xs text-muted-foreground">{format(new Date(a.at), "h:mm a")}</span>
                  <span>{a.text}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
    </AdminV2Layout>
  );
};

export default AdminToday;
