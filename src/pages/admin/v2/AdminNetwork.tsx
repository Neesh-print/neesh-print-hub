import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Check, Loader2, Search, X } from "lucide-react";
import { AdminV2Layout } from "@/components/admin/v2/AdminV2Layout";
import { Badge, type BadgeTone } from "@/components/admin/v2/badges";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAdminOverview } from "@/hooks/useAdminOverview";
import { useAdminNetwork, type NetworkPublisher, type NetworkSpace } from "@/hooks/useAdminNetwork";
import {
  PUBLISHER_STAGE_LABEL,
  SPACE_STAGE_LABEL,
  activityByPublisher,
  activityBySpace,
  activityOf,
  missingSetup,
  publisherStageOf,
  spaceStageOf,
  type Activity,
  type PublisherStage,
  type SpaceStage,
} from "@/lib/adminNetwork";
import { money } from "@/lib/adminOverview";
import { cn } from "@/lib/utils";

const btn =
  "inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 font-display text-[13px] font-semibold [font-variation-settings:'wdth'_114]";
const btnDark = `${btn} bg-foreground text-background hover:bg-foreground/90`;
const btnLine = `${btn} border border-border bg-background text-foreground hover:border-[#b79adb]`;

const PUBLISHER_STAGES: { stage: PublisherStage; sub: string }[] = [
  { stage: "setting_up", sub: "approved, not ready" },
  { stage: "ready", sub: "no orders yet" },
  { stage: "selling", sub: "ordered in 90 days" },
  { stage: "lapsed", sub: "no order in 90 days" },
];
const SPACE_STAGES: { stage: SpaceStage; sub: string }[] = [
  { stage: "never", sub: "approved, no orders" },
  { stage: "ordering", sub: "ordered in 90 days" },
  { stage: "lapsed", sub: "no order in 90 days" },
];
const STAGE_TONE: Record<PublisherStage | SpaceStage, BadgeTone> = {
  setting_up: "neutral",
  ready: "accent",
  selling: "success",
  ordering: "success",
  lapsed: "pending",
  never: "neutral",
};

const lastOrder = (a: Activity) => (a.lastOrderAt ? format(new Date(a.lastOrderAt), "MMM d, yyyy") : "—");

type PublisherRow = NetworkPublisher & { activity: Activity; stage: PublisherStage; missing: string[] };
type SpaceRow = NetworkSpace & { activity: Activity; stage: SpaceStage };

const StageCard = ({ label, n, sub, selected, onClick }: { label: string; n: number; sub: string; selected: boolean; onClick: () => void }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={cn(
      "min-h-11 rounded-lg border px-4 py-3.5 text-left",
      selected ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-secondary",
    )}
  >
    <span className="block font-mono text-[11px] tracking-[0.14em] opacity-75">{label.toUpperCase()}</span>
    <span className="mt-1 block font-display text-[28px] font-bold leading-tight [font-variation-settings:'wdth'_114]">{n}</span>
    <span className="block text-xs opacity-80">{sub}</span>
  </button>
);

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="rounded-lg bg-secondary px-2 py-3 text-center">
    <div className="font-display text-xl font-bold [font-variation-settings:'wdth'_114]">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

const CheckItem = ({ ok, label, note }: { ok: boolean; label: string; note?: string }) => (
  <li className="flex items-center gap-2.5 text-sm">
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full",
        ok ? "bg-status-success text-status-success-text" : "bg-status-error text-status-error-text",
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    </span>
    <span className="flex-1">
      {label}
      <span className="sr-only">{ok ? " done" : " missing"}</span>
    </span>
    {note && <span className="text-xs text-muted-foreground">{note}</span>}
  </li>
);

const PublisherPanel = ({ p }: { p: PublisherRow }) => (
  <SheetContent className="flex w-full flex-col gap-5 overflow-y-auto sm:max-w-md">
    <SheetHeader className="text-left">
      <div>
        <Badge tone={STAGE_TONE[p.stage]}>{PUBLISHER_STAGE_LABEL[p.stage]}</Badge>
      </div>
      <SheetTitle className="font-display text-2xl font-semibold tracking-tight [font-variation-settings:'wdth'_114]">{p.name}</SheetTitle>
      <SheetDescription>{p.email || "No email on file"}</SheetDescription>
    </SheetHeader>
    <div className="grid grid-cols-3 gap-2">
      <Stat value={money(p.activity.sales)} label="sales" />
      <Stat value={String(p.activity.orders)} label="orders" />
      <Stat value={money(p.activity.owed)} label="owed to them" />
    </div>
    <div>
      <h3 className="mb-2 font-mono text-xs font-medium tracking-[0.14em] text-muted-foreground">SETUP</h3>
      <ul className="flex flex-col gap-2">
        <CheckItem ok={p.approved} label="Approved" />
        <CheckItem ok={p.liveTitles > 0} label="Live titles" note={String(p.liveTitles)} />
        <CheckItem
          ok={p.payoutsEnabled}
          label="Stripe payouts"
          note={p.payoutsEnabled ? undefined : p.stripeDue.slice(0, 2).join(", ") || (p.hasStripeAccount ? "not finished" : "not started")}
        />
        <CheckItem ok={p.hasAddress} label="Ships-from address" note={p.hasAddress ? undefined : "needed for quotes"} />
      </ul>
    </div>
    <p className="text-[13px] text-muted-foreground">
      Last order {lastOrder(p.activity)} · joined {p.createdAt ? format(new Date(p.createdAt), "MMM yyyy") : "—"}
    </p>
    <div className="flex flex-wrap gap-2">
      <Link to="/admin/messages" className={cn(btnDark, "flex-1")}>
        {p.missing.length > 0 ? "Message about setup" : "Message"}
      </Link>
      <Link to={`/admin/publishers/${p.id}`} className={btnLine}>
        Full profile
      </Link>
    </div>
  </SheetContent>
);

const SpacePanel = ({ s }: { s: SpaceRow }) => (
  <SheetContent className="flex w-full flex-col gap-5 overflow-y-auto sm:max-w-md">
    <SheetHeader className="text-left">
      <div>
        <Badge tone={STAGE_TONE[s.stage]}>{SPACE_STAGE_LABEL[s.stage]}</Badge>
      </div>
      <SheetTitle className="font-display text-2xl font-semibold tracking-tight [font-variation-settings:'wdth'_114]">{s.name}</SheetTitle>
      <SheetDescription>{s.email || "No email on file"}</SheetDescription>
    </SheetHeader>
    <div className="grid grid-cols-3 gap-2">
      <Stat value={money(s.activity.sales)} label="spent" />
      <Stat value={String(s.activity.orders)} label="orders" />
      <Stat value={s.activity.lastOrderAt ? format(new Date(s.activity.lastOrderAt), "MMM d") : "—"} label="last order" />
    </div>
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Location</dt>
      <dd>{s.location || "—"}</dd>
      <dt className="text-muted-foreground">Type</dt>
      <dd className="capitalize">{s.type?.replace(/[-_]/g, " ") || "—"}</dd>
      <dt className="text-muted-foreground">Joined</dt>
      <dd>{s.createdAt ? format(new Date(s.createdAt), "MMM yyyy") : "—"}</dd>
    </dl>
    <div className="flex flex-wrap gap-2">
      <Link to="/admin/messages" className={cn(btnDark, "flex-1")}>
        Message
      </Link>
      <Link to={`/admin/retailers/${s.id}`} className={btnLine}>
        Full profile
      </Link>
    </div>
  </SheetContent>
);

export const AdminNetwork = () => {
  const overview = useAdminOverview();
  const network = useAdminNetwork();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const type = params.get("type") === "spaces" ? "spaces" : "publishers";
  const stage = params.get("stage");
  const setup = params.get("setup");
  const openId = params.get("id");
  const now = useMemo(() => new Date(overview.dataUpdatedAt || Date.now()), [overview.dataUpdatedAt]);

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const publishers = useMemo<PublisherRow[]>(() => {
    if (!network.data || !overview.data) return [];
    const activity = activityByPublisher(overview.data.orders);
    return network.data.publishers
      .filter((p) => p.approved)
      .map((p) => {
        const a = activityOf(activity, p.id);
        return { ...p, activity: a, stage: publisherStageOf(p, a, now), missing: missingSetup(p) };
      })
      .sort((a, b) => b.activity.sales - a.activity.sales || a.name.localeCompare(b.name));
  }, [network.data, overview.data, now]);

  const spaces = useMemo<SpaceRow[]>(() => {
    if (!network.data || !overview.data) return [];
    const activity = activityBySpace(overview.data.orders);
    return network.data.spaces
      .map((s) => {
        const a = activityOf(activity, s.userId);
        return { ...s, activity: a, stage: spaceStageOf(a, now) };
      })
      .sort((a, b) => b.activity.sales - a.activity.sales || a.name.localeCompare(b.name));
  }, [network.data, overview.data, now]);

  const q = search.trim().toLowerCase();
  const matches = (r: { name: string; email: string }) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);

  const publisherRows = publishers.filter(
    (p) =>
      (!stage || p.stage === stage) &&
      (setup !== "payouts" || !p.payoutsEnabled) &&
      (setup !== "address" || !p.hasAddress) &&
      matches(p),
  );
  const spaceRows = spaces.filter((s) => (!stage || s.stage === stage) && matches(s));

  const openPublisher = type === "publishers" ? publishers.find((p) => p.id === openId) : undefined;
  const openSpace = type === "spaces" ? spaces.find((s) => s.id === openId) : undefined;
  const isLoading = overview.isLoading || network.isLoading;
  const error = overview.error || network.error;
  const applicationsWaiting = overview.data?.review.applicationsWaiting ?? 0;

  return (
    <AdminV2Layout>
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl font-bold tracking-tight [font-variation-settings:'wdth'_114]">Network</h1>
          <div role="group" aria-label="Account type" className="flex rounded-full border border-border p-1">
            {(["publishers", "spaces"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setParam({ type: t === "spaces" ? "spaces" : null, stage: null, setup: null, id: null })}
                className={cn(
                  "min-h-9 rounded-full px-4 text-sm font-semibold capitalize",
                  type === t ? "bg-foreground text-background" : "text-foreground/80 hover:bg-secondary",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading network
          </div>
        ) : error ? (
          <p className="text-destructive">Couldn't load the network: {error instanceof Error ? error.message : "unknown error"}</p>
        ) : (
          <>
            <div role="group" aria-label="Filter by stage" className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
              {type === "publishers" && (
                <Link
                  to="/admin/applications"
                  className="min-h-11 rounded-lg border border-border px-4 py-3.5 hover:bg-secondary"
                >
                  <span className="block font-mono text-[11px] tracking-[0.14em] opacity-75">APPLIED</span>
                  <span className="mt-1 block font-display text-[28px] font-bold leading-tight [font-variation-settings:'wdth'_114]">
                    {applicationsWaiting}
                  </span>
                  <span className="block text-xs opacity-80">waiting on you</span>
                </Link>
              )}
              {(type === "publishers" ? PUBLISHER_STAGES : SPACE_STAGES).map((s) => (
                <StageCard
                  key={s.stage}
                  label={type === "publishers" ? PUBLISHER_STAGE_LABEL[s.stage as PublisherStage] : SPACE_STAGE_LABEL[s.stage as SpaceStage]}
                  n={
                    type === "publishers"
                      ? publishers.filter((p) => p.stage === s.stage).length
                      : spaces.filter((x) => x.stage === s.stage).length
                  }
                  sub={s.sub}
                  selected={stage === s.stage}
                  onClick={() => setParam({ stage: stage === s.stage ? null : s.stage })}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-10 w-full max-w-xs items-center gap-2 rounded-full border border-border px-3.5">
                <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Search {type}</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or email"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
              {type === "publishers" &&
                [
                  { key: "payouts", label: "Can't be paid", n: publishers.filter((p) => !p.payoutsEnabled).length },
                  { key: "address", label: "No ships-from address", n: publishers.filter((p) => !p.hasAddress).length },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={setup === f.key}
                    onClick={() => setParam({ setup: setup === f.key ? null : f.key })}
                    className={cn(
                      "whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold",
                      setup === f.key ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary",
                    )}
                  >
                    {f.label} <span className="font-medium opacity-70">{f.n}</span>
                  </button>
                ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[11px] tracking-[0.12em] text-muted-foreground">
                    <th scope="col" className="px-4 py-3 font-medium">{type === "publishers" ? "PUBLISHER" : "SPACE"}</th>
                    <th scope="col" className="px-4 py-3 font-medium">STAGE</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">{type === "publishers" ? "SALES ↓" : "SPENT ↓"}</th>
                    <th scope="col" className="px-4 py-3 font-medium">LAST ORDER</th>
                    <th scope="col" className="px-4 py-3 font-medium">{type === "publishers" ? "SETUP" : "LOCATION"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(type === "publishers" ? publisherRows : spaceRows).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        No {type} here.
                      </td>
                    </tr>
                  )}
                  {type === "publishers"
                    ? publisherRows.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => setParam({ id: p.id })}
                          className={cn(
                            "cursor-pointer border-b border-border/50 last:border-b-0 hover:bg-secondary/60",
                            p.id === openId && "bg-secondary shadow-[inset_3px_0_0_hsl(var(--accent))]",
                          )}
                        >
                          <td className="px-4 py-3">
                            <button type="button" className="text-left" onClick={() => setParam({ id: p.id })}>
                              <span className="block font-semibold">{p.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                {p.liveTitles} live title{p.liveTitles === 1 ? "" : "s"}
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={STAGE_TONE[p.stage]}>{PUBLISHER_STAGE_LABEL[p.stage]}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{money(p.activity.sales)}</td>
                          <td className="px-4 py-3">{lastOrder(p.activity)}</td>
                          <td className="px-4 py-3 text-[13px]">
                            {p.missing.length === 0 ? (
                              <span className="text-muted-foreground">Complete</span>
                            ) : (
                              <span>Missing: {p.missing.join(", ").toLowerCase()}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    : spaceRows.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => setParam({ id: s.id })}
                          className={cn(
                            "cursor-pointer border-b border-border/50 last:border-b-0 hover:bg-secondary/60",
                            s.id === openId && "bg-secondary shadow-[inset_3px_0_0_hsl(var(--accent))]",
                          )}
                        >
                          <td className="px-4 py-3">
                            <button type="button" className="text-left" onClick={() => setParam({ id: s.id })}>
                              <span className="block font-semibold">{s.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                {s.activity.orders} order{s.activity.orders === 1 ? "" : "s"}
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={STAGE_TONE[s.stage]}>{SPACE_STAGE_LABEL[s.stage]}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{money(s.activity.sales)}</td>
                          <td className="px-4 py-3">{lastOrder(s.activity)}</td>
                          <td className="px-4 py-3 text-[13px] text-muted-foreground">{s.location || "—"}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Sheet open={!!(openPublisher || openSpace)} onOpenChange={(isOpen) => !isOpen && setParam({ id: null })}>
        {openPublisher && <PublisherPanel p={openPublisher} />}
        {openSpace && <SpacePanel s={openSpace} />}
      </Sheet>
    </AdminV2Layout>
  );
};

export default AdminNetwork;
