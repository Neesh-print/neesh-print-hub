import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  discoverSpaces,
  importRows,
  queueResearch,
  researchStatus,
  type ResearchJob,
} from "./api";
import {
  emptyReview,
  prospectSchema,
  safeUrl,
  websiteDomain,
  type Row,
} from "./model";

const ICP_HINTS: Record<string, string> = {
  Wait: "salons, spas, clinics",
  Presence: "cafes, wine bars, members clubs",
  Dwell: "boutiques, furniture, galleries",
  Taste: "boutique hotels, coworking, studios",
  Catalog: "bookstores, newsstands, record stores",
};
const plainName = (name: string) =>
  name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

export function ResearchPanel({
  rows,
  onRefresh,
}: {
  rows: Row[];
  onRefresh: () => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(false),
    [jobs, setJobs] = useState<ResearchJob[]>([]),
    [error, setError] = useState("");
  const [area, setArea] = useState("New York"),
    [segment, setSegment] = useState("Wait"),
    [neighborhood, setNeighborhood] = useState("");
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const active = useRef(true),
    signature = useRef("");
  const refresh = useCallback(async () => {
    try {
      const state = await researchStatus();
      if (!active.current) return;
      setEnabled(state.enabled);
      setJobs(state.jobs);
      const next = JSON.stringify(
        state.jobs.map((j) => [j.id, j.status, j.finished_at]),
      );
      if (signature.current && signature.current !== next) await onRefresh();
      signature.current = next;
    } catch {
      if (active.current)
        setError(
          "Research is not available yet. Your imported records are safe.",
        );
    }
  }, [onRefresh]);
  useEffect(() => {
    active.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), 20000);
    return () => {
      active.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  const pending = jobs.filter((j) => ["queued", "running"].includes(j.status));
  const latestDiscovery = jobs.find(
    (j) =>
      j.kind === "discovery" &&
      j.status === "completed" &&
      j.result?.candidates,
  );
  const candidates = (latestDiscovery?.result?.candidates || []).flatMap(
    (raw) => {
      const parsed = prospectSchema.safeParse(raw);
      return parsed.success ? [parsed.data] : [];
    },
  );
  // Leads you already have (same ID, name or website) are not shown again.
  const known = {
    ids: new Set(rows.map((r) => r.source.id)),
    names: new Set(rows.map((r) => plainName(r.source.name))),
    domains: new Set(
      rows.flatMap((r) => websiteDomain(r.source.website) ?? []),
    ),
  };
  const available = candidates.filter((c) => {
    const domain = websiteDomain(c.website);
    return (
      !known.ids.has(c.id) &&
      !known.names.has(plainName(c.name)) &&
      !(domain && known.domains.has(domain))
    );
  });
  const alreadyHave = candidates.length - available.length;
  const fromGoogle = latestDiscovery?.result?.attribution === "Google Places";
  async function discover() {
    setBusy(true);
    setError("");
    try {
      await discoverSpaces(area, segment, neighborhood.trim());
      setMessage(
        `Searching for ${segment} spaces in ${neighborhood.trim() || area}. New leads appear here within a few minutes.`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setBusy(false);
    }
  }
  async function add(ids: string[] = selected) {
    setBusy(true);
    setError("");
    try {
      const chosen = available.filter((c) => ids.includes(c.id));
      await importRows(
        chosen.map((source) => ({ source, review: emptyReview(), version: 0 })),
      );
      const n = await queueResearch(chosen.map((c) => c.id));
      setSelected([]);
      setMessage(
        `${chosen.length} new lead${chosen.length === 1 ? "" : "s"} added. Finding their contacts now (${n} queued); they appear in the list below as research finishes.`,
      );
      await onRefresh();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add these spaces");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Discovery and research"
      className="p-4 sm:px-8 border-b bg-neutral-50 space-y-4"
    >
      <div>
        <h1 className="text-xl font-semibold">Find new leads</h1>
        <p className="text-sm">
          Pick an ICP and a neighborhood. Nustand finds matching spaces you
          don&apos;t have yet, tags them, and finds their contacts.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          Area
          <select
            aria-label="Discovery area"
            className="block border p-2"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            {[
              "New York",
              "Manhattan",
              "Brooklyn",
              "Queens",
              "Bronx",
              "Staten Island",
            ].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          ICP
          <select
            aria-label="Discovery segment"
            className="block border p-2"
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
          >
            {Object.entries(ICP_HINTS).map(([value, hint]) => (
              <option key={value} value={value}>
                {value}: {hint}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Neighborhood (optional)
          <Input
            aria-label="Discovery neighborhood"
            maxLength={100}
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            placeholder="e.g. Greenpoint"
          />
        </label>
        <Button onClick={() => void discover()} disabled={!enabled || busy}>
          Find leads
        </Button>
      </div>
      <p className="text-sm">
        {enabled
          ? `${pending.length} jobs queued or running. Research continues after you close this page; this view refreshes every 20 seconds. Workers usually check the queue every five minutes, but may be delayed.`
          : "Research worker is not enabled yet."}
      </p>
      <p className="text-xs">
        Each search uses three Google lookups and returns up to about 60
        places. Up to 10 searches a day; lookups stay inside the free monthly
        allowance.
      </p>
      {message && <p role="status">{message}</p>}
      {latestDiscovery && (
        <p className="text-sm">
          Last search: {String(latestDiscovery.input.segment)} in{" "}
          {String(latestDiscovery.input.neighborhood || latestDiscovery.input.area)}.{" "}
          {candidates.length === 0
            ? "No places found. Try leaving the neighborhood blank or another ICP."
            : `${available.length} new lead${available.length === 1 ? "" : "s"}${alreadyHave ? `, ${alreadyHave} you already have` : ""}.`}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {available.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <h2 className="font-semibold">New leads</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void add()}
                disabled={busy || !selected.length}
              >
                Add {selected.length || ""} selected
              </Button>
              <Button
                onClick={() => void add(available.map((c) => c.id))}
                disabled={busy}
              >
                Add all {available.length} and find contacts
              </Button>
            </div>
          </div>
          <div className="max-h-96 overflow-auto divide-y border bg-white">
            {available.map((c) => (
              <label key={c.id} className="flex gap-3 p-3 items-start">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(c.id)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked
                        ? [...prev, c.id]
                        : prev.filter((id) => id !== c.id),
                    )
                  }
                />
                <span className="text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="block text-neutral-600">
                    {[
                      String((c as Record<string, unknown>).space_type ?? ""),
                      c.neighborhood,
                      c.fit.segment ? `ICP: ${c.fit.segment}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {String(c.original_record.address || "")}
                  </span>
                  {safeUrl(c.website) && (
                    <a
                      href={safeUrl(c.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-xs"
                    >
                      {websiteDomain(c.website)}
                    </a>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-neutral-600">
        {fromGoogle ? (
          "Places from Google. Tags are a starting point; confirm fit before outreach."
        ) : (
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Place data: © OpenStreetMap contributors, ODbL.
          </a>
        )}
      </p>
      {jobs.some(
        (j) =>
          j.status === "failed" ||
          j.status === "needs_website" ||
          j.status === "blocked",
      ) && (
        <div className="text-sm">
          Some jobs need attention. Use the research-status filter below to
          inspect missing websites, failures or blocks.
          <ul>
            {jobs
              .filter((j) => j.error)
              .slice(0, 5)
              .map((j) => (
                <li key={j.id}>
                  {j.kind === "discovery"
                    ? "Discovery"
                    : rows.find((r) => r.source.id === j.prospect_id)?.source
                        .name || "Space research"}
                  : {j.error?.replace(/_/g, " ")}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
