import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";
import { AdminV2Layout } from "@/components/admin/v2/AdminV2Layout";
import { Switch } from "@/components/ui/switch";
import { useAdminOverview } from "@/hooks/useAdminOverview";
import { change, periodFor, summarizeInsights, type Ranked } from "@/lib/adminInsights";
import { money } from "@/lib/adminOverview";
import { cn } from "@/lib/utils";

const RANGES = [
  { range: "7d", label: "7 days" },
  { range: "30d", label: "30 days" },
  { range: "90d", label: "90 days" },
  { range: "all", label: "All time" },
] as const;
type Range = (typeof RANGES)[number]["range"];

const readExclude = () => {
  try {
    return localStorage.getItem("admin.excludeInternal") === "1";
  } catch {
    return false;
  }
};

const Delta = ({ now, before }: { now: number; before: number }) => {
  const pct = change(now, before);
  if (pct === null) return <span className="text-muted-foreground">no earlier data</span>;
  return (
    <span className={cn(pct > 0 ? "text-status-success-text" : pct < 0 ? "text-destructive" : "text-muted-foreground")}>
      {pct > 0 ? "+" : ""}
      {pct}% vs previous
    </span>
  );
};

const RankTable = ({ title, rows, extra }: { title: string; rows: (Ranked & { publisher?: string })[]; extra?: boolean }) => (
  <section aria-label={title} className="min-w-0 flex-1 basis-80 rounded-lg border border-border">
    <h2 className="border-b border-border px-5 py-4 font-display text-xl font-semibold tracking-tight [font-variation-settings:'wdth'_114]">{title}</h2>
    {rows.length === 0 ? (
      <p className="px-5 py-4 text-sm text-muted-foreground">No sales in this period.</p>
    ) : (
      <ol>
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-baseline gap-3 border-b border-border/50 px-5 py-3 text-sm last:border-b-0">
            <span className="w-5 font-mono text-xs text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{r.name}</span>
              <span className="block text-xs text-muted-foreground">
                {extra && r.publisher ? `${r.publisher} · ` : ""}
                {r.orders} order{r.orders === 1 ? "" : "s"} · {r.units} copies
              </span>
            </span>
            <span className="font-semibold">{money(r.sales)}</span>
          </li>
        ))}
      </ol>
    )}
  </section>
);

export const AdminInsights = () => {
  const { data, isLoading, error, dataUpdatedAt } = useAdminOverview();
  const [params, setParams] = useSearchParams();
  const range = (RANGES.some((r) => r.range === params.get("range")) ? params.get("range") : "30d") as Range;
  const [excludeInternal, setExcludeInternal] = useState(readExclude);
  const now = useMemo(() => new Date(dataUpdatedAt || Date.now()), [dataUpdatedAt]);

  const toggleInternal = (on: boolean) => {
    setExcludeInternal(on);
    try {
      localStorage.setItem("admin.excludeInternal", on ? "1" : "0");
    } catch {
      // Storage can be blocked; the switch still works for this visit.
    }
  };

  const insights = useMemo(() => {
    if (!data) return null;
    const first = data.orders.reduce<string | undefined>((min, o) => (!min || o.createdAt < min ? o.createdAt : min), undefined);
    return summarizeInsights(data.orders, periodFor(range, now, first), { excludeInternal });
  }, [data, range, now, excludeInternal]);

  const cards = insights
    ? [
        { label: "SALES", value: money(insights.totals.sales), now: insights.totals.sales, before: insights.previous.sales },
        { label: "NEESH FEES", value: money(insights.totals.fees), now: insights.totals.fees, before: insights.previous.fees, sub: "10% from each side" },
        { label: "ORDERS", value: String(insights.totals.orders), now: insights.totals.orders, before: insights.previous.orders },
        { label: "AVG ORDER", value: money(insights.totals.avgOrder), now: insights.totals.avgOrder, before: insights.previous.avgOrder },
        { label: "SPACES BUYING", value: String(insights.totals.spaces), now: insights.totals.spaces, before: insights.previous.spaces },
        { label: "PUBLISHERS SELLING", value: String(insights.totals.publishers), now: insights.totals.publishers, before: insights.previous.publishers },
      ]
    : [];

  return (
    <AdminV2Layout>
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl font-bold tracking-tight [font-variation-settings:'wdth'_114]">Insights</h1>
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Period" className="flex rounded-full border border-border p-1">
              {RANGES.map((r) => (
                <button
                  key={r.range}
                  type="button"
                  aria-pressed={range === r.range}
                  onClick={() => setParams(r.range === "30d" ? {} : { range: r.range }, { replace: true })}
                  className={cn(
                    "min-h-9 rounded-full px-3.5 text-sm font-semibold",
                    range === r.range ? "bg-foreground text-background" : "text-foreground/80 hover:bg-secondary",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold">
              <Switch checked={excludeInternal} onCheckedChange={toggleInternal} />
              Exclude internal
            </label>
          </div>
        </header>

        {isLoading || !insights ? (
          error ? (
            <p className="text-destructive">Couldn't load insights: {error instanceof Error ? error.message : "unknown error"}</p>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading insights
            </div>
          )
        ) : (
          <>
            <section aria-label="Totals" className="grid grid-cols-2 overflow-hidden rounded-lg border border-border md:grid-cols-3">
              {cards.map((c) => (
                <div key={c.label} className="border-b border-r border-border px-5 py-4">
                  <div className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground">{c.label}</div>
                  <div className="mt-1.5 font-display text-2xl font-bold tracking-tight [font-variation-settings:'wdth'_114]">{c.value}</div>
                  <div className="text-[13px]">
                    {range === "all" ? <span className="text-muted-foreground">{c.sub ?? "since the first order"}</span> : <Delta now={c.now} before={c.before} />}
                  </div>
                </div>
              ))}
            </section>

            <section aria-label="Sales over time" className="rounded-lg border border-border p-5">
              <h2 className="mb-4 font-display text-xl font-semibold tracking-tight [font-variation-settings:'wdth'_114]">Sales</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insights.series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={48} tickFormatter={(v: number) => `$${v}`} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--secondary))" }}
                      formatter={(value: number, name: string) => (name === "sales" ? [money(value), "Sales"] : [value, "Orders"])}
                    />
                    <Bar dataKey="sales" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="flex flex-wrap gap-6">
              <RankTable title="Top publishers" rows={insights.topPublishers} />
              <RankTable title="Top spaces" rows={insights.topSpaces} />
            </div>
            <RankTable title="Top titles" rows={insights.topTitles} extra />
          </>
        )}
      </div>
    </AdminV2Layout>
  );
};

export default AdminInsights;
