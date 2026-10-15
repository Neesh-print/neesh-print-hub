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
import { emptyReview, prospectSchema, safeUrl, type Row } from "./model";

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
    [segment, setSegment] = useState("Catalog"),
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
  const available = candidates.filter(
    (c) => !rows.some((r) => r.source.id === c.id),
  );
  const possibleDuplicate = (name: string, city?: string | null) =>
    rows.some(
      (r) =>
        r.source.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        (!city ||
          city.includes("unverified") ||
          !r.source.city ||
          r.source.city?.trim().toLowerCase() === city?.trim().toLowerCase()),
    );
  async function discover() {
    setBusy(true);
    setError("");
    try {
      await discoverSpaces(area, segment, neighborhood.trim());
      setMessage(
        "Discovery queued. Results appear here when the worker finishes.",
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setBusy(false);
    }
  }
  async function add() {
    setBusy(true);
    setError("");
    try {
      const chosen = available.filter((c) => selected.includes(c.id));
      await importRows(
        chosen.map((source) => ({ source, review: emptyReview(), version: 0 })),
      );
      const n = await queueResearch(chosen.map((c) => c.id));
      setSelected([]);
      setMessage(`${chosen.length} spaces added; ${n} research jobs queued.`);
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
      id="nustand-discover"
      aria-label="Discovery and research"
      className="p-4 sm:px-8 border-b bg-neutral-50 space-y-4"
    >
      <div>
        <h1 className="text-xl font-semibold">Find your next newsstands</h1>
        <p className="text-sm">
          Discover physical spaces, research their public websites, then review
          the best contact candidates and evidence of fit.
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
          Segment
          <select
            aria-label="Discovery segment"
            className="block border p-2"
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
          >
            {["Wait", "Presence", "Dwell", "Taste", "Catalog"].map((a) => (
              <option key={a}>{a}</option>
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
          Discover spaces
        </Button>
      </div>
      <p className="text-sm">
        {enabled
          ? `${pending.length} jobs queued or running. Research continues after you close this page; this view refreshes every 20 seconds. Workers usually check the queue every five minutes, but may be delayed.`
          : "Research worker is not enabled yet."}
      </p>
      <p className="text-xs">
        Area searches use bounding boxes and may include boundary-adjacent
        places. Neighborhood matching depends on available tags; an empty result
        does not mean no suitable spaces exist.
      </p>
      {message && <p role="status">{message}</p>}
      {latestDiscovery && (
        <p className="text-sm">
          Discovery completed for {String(latestDiscovery.input.area)} /{" "}
          {String(latestDiscovery.input.segment)}: {candidates.length}{" "}
          candidates, {available.length} not already loaded by source ID.{" "}
          {candidates.length === 0 &&
            "Try a broader area or leave neighborhood blank."}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {available.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">
            Discovered candidates — review before adding
          </h2>
          <Button
            variant="outline"
            onClick={() =>
              setSelected(
                available
                  .filter((c) => !possibleDuplicate(c.name, c.city))
                  .map((c) => c.id),
              )
            }
          >
            Select candidates without name/city matches
          </Button>
          <div className="max-h-80 overflow-auto space-y-3">
            {available.map((c) => (
              <label key={c.id} className="block border p-3">
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked
                        ? [...prev, c.id]
                        : prev.filter((id) => id !== c.id),
                    )
                  }
                />{" "}
                {c.name} —{" "}
                {String(c.original_record.address || "Address unavailable")}
                {possibleDuplicate(c.name, c.city) && (
                  <span className="block text-sm">
                    Possible existing space: review identity before adding.
                  </span>
                )}
                {safeUrl(c.website) && (
                  <a
                    href={safeUrl(c.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block underline text-sm"
                  >
                    Candidate website
                  </a>
                )}
              </label>
            ))}
          </div>
          <Button
            onClick={() => void add()}
            disabled={busy || !selected.length}
          >
            Add selected and research
          </Button>
        </div>
      )}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs underline"
      >
        Place discovery: © OpenStreetMap contributors, ODbL. Coverage and
        contact freshness vary.
      </a>
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
