import { useMemo, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import wordmark from "@/assets/nustand.svg";
import {
  acceptedContacts,
  exportContacts,
  mergeNewRows,
  needsReview,
  reviewSchema,
  safeUrl,
  suppressed,
  type Row,
  type Review,
} from "./model";
import { MAX_SPACES, parseImport } from "./import";

export type WorkspaceProps = {
  initialRows?: Row[];
  onSave?: (row: Row, review: Review) => Promise<number>;
  onImport?: (rows: Row[]) => Promise<Row[]>;
  onExport?: (ids: string[]) => Promise<string>;
  onCopy?: (id: string, contactId: string) => Promise<string>;
  onResearch?: (ids: string[]) => Promise<number>;
  onWebsite?: (id: string, website: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
};
const EMPTY_ROWS: Row[] = [];
function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function SourceLink({
  url,
  children,
}: {
  url?: string | null;
  children: React.ReactNode;
}) {
  const href = safeUrl(url);
  return href ? (
    <a
      className="underline underline-offset-4 break-all"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}
export function Workspace({
  initialRows = EMPTY_ROWS,
  onSave,
  onImport,
  onExport,
  onCopy,
  onResearch,
  onWebsite,
  onRefresh,
}: WorkspaceProps) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [rows, setRows] = useState(initialRows);
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Review | null>(null);
  const [websiteDraft, setWebsiteDraft] = useState("");
  useEffect(() => {
    setWebsiteDraft(selected?.source.website || "");
  }, [selected?.source.id, selected?.source.website]);
  const [pendingImport, setPendingImport] = useState<Row[] | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [query, segment, filter, rows.length]);
  const today = new Date().toLocaleDateString("en-CA");
  const filtered = useMemo(
    () =>
      rows
        .filter((r) => {
          const searchable = [
            r.source.name,
            r.source.city,
            r.source.neighborhood,
            r.source.original_record.address,
          ]
            .join(" ")
            .toLowerCase();
          return (
            searchable.includes(query.toLowerCase()) &&
            (!segment ||
              (r.review.segment || r.source.fit.segment) === segment) &&
            (filter === "all" ||
              (filter === "unresearched" &&
                ["not_started", "pending"].includes(r.source.job.status)) ||
              (filter === "researching" &&
                ["queued", "running"].includes(r.source.job.status)) ||
              (filter === "researched" &&
                ["completed", "partial"].includes(r.source.job.status)) ||
              (filter === "attention" &&
                ["failed", "blocked", "needs_website"].includes(
                  r.source.job.status,
                )) ||
              (filter === "review" && needsReview(r)) ||
              (filter === "email" &&
                acceptedContacts(r).some((c) => c.kind === "email")) ||
              (filter === "missing" &&
                !r.source.contacts.some((c) => c.kind === "email")) ||
              (filter === "due" &&
                !!r.review.next_follow_up &&
                r.review.next_follow_up <= today &&
                !suppressed(r)) ||
              (filter === "suppressed" && suppressed(r)))
          );
        })
        .sort(
          (a, b) =>
            (b.review.fit_score ?? b.source.fit.score ?? -1) -
              (a.review.fit_score ?? a.source.fit.score ?? -1) ||
            (b.source.contact_score ?? 0) - (a.source.contact_score ?? 0),
        ),
    [rows, query, segment, filter, today],
  );
  const counts = [
    ["Spaces", rows.length],
    [
      "Email candidates",
      rows.filter((r) => r.source.contacts.some((c) => c.kind === "email"))
        .length,
    ],
    [
      "Accepted emails",
      rows.filter((r) => acceptedContacts(r).some((c) => c.kind === "email"))
        .length,
    ],
    ["Need contact review", rows.filter(needsReview).length],
  ];
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * 25, (currentPage + 1) * 25);
  async function exportQualified() {
    setBusy(true);
    setError("");
    try {
      if (onSave && !onExport)
        throw new Error("Live export is unavailable. Please try again later.");
      const csv = onExport
        ? await onExport(filtered.map((r) => r.source.id))
        : exportContacts(filtered);
      if (!active.current) return;
      download("Nustand_qualified_contacts.csv", csv, "text/csv");
      setMessage(
        "Exported currently qualified contacts. Latest saved suppression decisions were applied.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not verify contacts. No export was created.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function readFile(file?: File) {
    if (!file) return;
    setPendingImport(null);
    setError("");
    try {
      if (file.size > 10_000_000)
        throw new Error("Choose a CSV or JSON file under 10 MB.");
      const imported = await parseImport(file.name, await file.text());
      if (active.current) setPendingImport(imported);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not read this pilot file.",
      );
    }
  }
  async function researchSpaces(ids: string[]) {
    if (!onResearch) return;
    setBusy(true);
    setError("");
    try {
      const count = await onResearch(ids);
      setMessage(
        `${count} research jobs queued. Already active, suppressed or recently checked spaces were skipped.`,
      );
      await onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research could not start.");
    } finally {
      setBusy(false);
    }
  }
  async function saveWebsite() {
    if (!selected || !onWebsite || !safeUrl(websiteDraft)) return;
    setBusy(true);
    setError("");
    try {
      await onWebsite(selected.source.id, websiteDraft);
      setSelected(null);
      setDraft(null);
      await onRefresh?.();
      setMessage("Website saved. Select the space and start research.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Website could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  async function confirmImport() {
    if (!pendingImport) return;
    setBusy(true);
    setError("");
    try {
      const newCount = pendingImport.filter(
        (p) => !rows.some((r) => r.source.id === p.source.id),
      ).length;
      if (rows.length + newCount > MAX_SPACES)
        throw new Error(
          `Workspace capacity is ${MAX_SPACES} spaces. Existing records will not be removed.`,
        );
      const next = onImport
        ? await onImport(pendingImport)
        : mergeNewRows(rows, pendingImport);
      const added = next.length - rows.length;
      setRows(next);
      setPendingImport(null);
      setMessage(
        `${added} spaces added. Existing records and review decisions were preserved.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!selected || !draft) return;
    setBusy(true);
    setError("");
    try {
      const review = reviewSchema.parse(draft);
      const version = onSave
        ? await onSave(selected, review)
        : selected.version + 1;
      setRows((current) =>
        current.map((r) =>
          r.source.id === selected.source.id ? { ...r, review, version } : r,
        ),
      );
      setSelected(null);
      setDraft(null);
      setMessage(
        onSave
          ? "Review saved."
          : "Review updated for this session. Download a backup before closing.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your edits are still open.",
      );
    } finally {
      setBusy(false);
    }
  }
  const selectedSuppressed =
    selected && draft ? suppressed({ ...selected, review: draft }) : false;
  return (
    <section className="p-4 sm:p-8 text-black bg-white min-h-screen space-y-6">
      <header className="flex flex-wrap justify-between items-end gap-4 border-b border-black pb-6">
        <div>
          <img src={wordmark} alt="Nustand" className="w-56 -ml-3" />
          <p className="text-sm text-neutral-600">
            Spaces are the new newsstands.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onResearch && (
            <Button
              onClick={() =>
                void researchSpaces(filtered.map((r) => r.source.id))
              }
              disabled={busy || !filtered.length}
            >
              Research {filtered.length} spaces
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() =>
              download(
                "Nustand_review_backup.json",
                JSON.stringify({ version: 1, rows }, null, 2),
                "application/json",
              )
            }
            disabled={!rows.length}
          >
            Download review backup
          </Button>
          <Button
            onClick={exportQualified}
            disabled={
              busy ||
              !filtered.some(
                (r) =>
                  r.review.stage === "Qualified" &&
                  acceptedContacts(r).length > 0,
              )
            }
          >
            Export qualified contacts
          </Button>
        </div>
      </header>
      {!onSave && (
        <p className="border border-neutral-300 bg-neutral-50 p-3 text-sm">
          Local review session. Records stay in memory; download your review
          backup before closing. Nothing is saved to the live database.
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-neutral-200 divide-x divide-neutral-200">
        {counts.map(([label, count]) => (
          <div className="p-4" key={label}>
            <p className="text-xs uppercase tracking-wider text-neutral-600">
              {label}
            </p>
            <p className="text-3xl font-semibold mt-2">{count}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex-1 min-w-48 text-sm">
          Find a space or neighborhood
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search spaces"
            className="mt-1"
          />
        </label>
        <label className="text-sm">
          Segment
          <select
            className="block border rounded-md p-2 h-10 mt-1"
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
          >
            <option value="">All segments</option>
            {["Wait", "Presence", "Dwell", "Taste", "Catalog"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Show
          <select
            className="block border rounded-md p-2 h-10 mt-1"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              ["all", "All spaces"],
              ["unresearched", "Not researched"],
              ["researching", "Queued or researching"],
              ["researched", "Researched prospects"],
              ["attention", "Research needs attention"],
              ["review", "Needs contact review"],
              ["email", "Accepted email"],
              ["missing", "No email candidate"],
              ["due", "Follow-up due"],
              ["suppressed", "Do not contact"],
            ].map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Import spaces
          <input
            aria-label="Import spaces"
            className="block max-w-60 mt-1 text-xs"
            type="file"
            accept=".csv,text/csv,.json,application/json"
            onChange={(e) => {
              void readFile(e.target.files?.[0]);
              e.target.value = "";
            }}
            disabled={busy}
          />
        </label>
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-sm text-red-800 border border-red-300 p-3 whitespace-pre-wrap"
        >
          {error}
        </p>
      )}
      <p className="text-xs text-neutral-600">
        {filtered.length} of {rows.length} spaces. Exports include only
        qualified, nonsuppressed spaces with manually accepted contacts. Ranked
        by supported fit, then contact availability. Unknown fit stays
        unassessed.
      </p>
      {!rows.length ? (
        <div className="py-16 text-center border border-dashed border-neutral-300">
          <h1 className="text-xl font-semibold">
            Your next newsstands start here.
          </h1>
          <p className="text-neutral-600 mt-2">
            Import a CSV list or pilot results JSON to start reviewing spaces.
          </p>
        </div>
      ) : !filtered.length ? (
        <p className="py-12 text-center">No spaces match these filters.</p>
      ) : (
        <div>
          <div className="md:hidden space-y-3">
            {visible.map((row) => (
              <article
                key={row.source.id}
                className="border border-neutral-200 p-4 space-y-2"
              >
                <h2 className="font-semibold">{row.source.name}</h2>
                <p className="text-xs text-neutral-600">
                  {row.source.neighborhood || "Neighborhood unknown"} ·{" "}
                  {row.review.segment ||
                    row.source.fit.segment ||
                    "Segment unassigned"}
                </p>
                <p className="text-sm">
                  {row.source.contacts.filter((c) => c.kind === "email").length}{" "}
                  email candidates ·{" "}
                  {
                    acceptedContacts(row).filter((c) => c.kind === "email")
                      .length
                  }{" "}
                  accepted
                </p>
                <p className="text-xs">
                  Research: {row.source.job.status.replace(/_/g, " ")}
                </p>
                {(["email", "phone", "instagram"] as const).map((kind) => {
                  const contact =
                    row.source.contacts.find(
                      (c) => c.kind === kind && c.is_primary,
                    ) || row.source.contacts.find((c) => c.kind === kind);
                  return contact ? (
                    <p className="text-sm break-all" key={kind}>
                      {kind}: {contact.value}{" "}
                      <span className="text-xs">
                        {row.review.contacts[contact.id] === "accepted"
                          ? "Accepted"
                          : "Candidate — review source"}
                      </span>
                    </p>
                  ) : null;
                })}
                <p className="text-sm">
                  {suppressed(row) ? "Do not contact" : row.review.stage} · Fit:{" "}
                  {row.review.fit_score ?? row.source.fit.score ?? "Unassessed"}
                </p>
                {row.review.next_follow_up && (
                  <p className="text-xs">
                    Follow-up: {row.review.next_follow_up}
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelected(row);
                    setDraft(structuredClone(row.review));
                    setError("");
                  }}
                >
                  Review<span className="sr-only"> {row.source.name}</span>
                </Button>
              </article>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto border border-neutral-200">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 border-b">
                <tr>
                  {["Space", "Email", "Phone", "Fit", "Review", ""].map(
                    (h, i) => (
                      <th key={i} className="p-3 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const email = row.source.contacts.filter(
                    (c) => c.kind === "email",
                  );
                  const phone =
                    row.source.contacts.find(
                      (c) => c.kind === "phone" && c.is_primary,
                    ) || row.source.contacts.find((c) => c.kind === "phone");
                  const acceptedEmail = acceptedContacts(row).filter(
                    (c) => c.kind === "email",
                  );
                  return (
                    <tr
                      key={row.source.id}
                      className="border-b last:border-0 hover:bg-neutral-50 align-top"
                    >
                      <td className="p-3 min-w-44">
                        <p className="font-semibold">{row.source.name}</p>
                        {safeUrl(row.source.website) && (
                          <SourceLink url={row.source.website}>
                            Website
                          </SourceLink>
                        )}
                        {row.source.website_identity_review === true && (
                          <p className="text-xs">
                            Confirm website belongs to this location.
                          </p>
                        )}
                        <p className="text-neutral-500 text-xs mt-1">
                          {row.source.neighborhood || "Neighborhood unknown"}
                        </p>
                        <p className="text-xs mt-1">
                          {row.review.segment ||
                            row.source.fit.segment ||
                            "Segment unassigned"}
                        </p>
                      </td>
                      <td className="p-3 min-w-40">
                        {acceptedEmail.length ? (
                          <>
                            <p>{acceptedEmail[0].value}</p>
                            <span className="text-xs">Accepted</span>
                          </>
                        ) : (
                          <>
                            <p>
                              {email.length
                                ? email[0].value
                                : row.source.job.status === "not_started"
                                  ? "Not researched"
                                  : "No email candidate"}
                            </p>
                            <span className="text-xs text-neutral-500">
                              {email.length
                                ? "Review before use"
                                : `Crawl: ${row.source.job.status}`}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="p-3 min-w-36">
                        {phone ? (
                          <>
                            <p>
                              {phone.value}
                              {phone.extension ? ` ext ${phone.extension}` : ""}
                            </p>
                            <span className="text-xs text-neutral-500">
                              {phone.quality_status.replace(/_/g, " ")}
                            </span>
                          </>
                        ) : (
                          "Not found"
                        )}
                      </td>
                      <td className="p-3">
                        {row.review.fit_score ??
                          row.source.fit.score ??
                          "Unassessed"}
                        <p className="text-xs text-neutral-500">
                          {row.review.fit_score !== null
                            ? "Manual"
                            : "Provisional"}
                        </p>
                        <p className="text-xs">
                          Contact availability:{" "}
                          {row.source.contact_score ?? "Unassessed"}
                        </p>
                      </td>
                      <td className="p-3">
                        {suppressed(row) ? "Do not contact" : row.review.stage}
                        <p className="text-xs text-neutral-500">
                          {row.review.next_follow_up &&
                            `Due ${row.review.next_follow_up}`}
                        </p>
                      </td>
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelected(row);
                            setDraft(structuredClone(row.review));
                            setError("");
                          }}
                        >
                          Review
                          <span className="sr-only"> {row.source.name}</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {filtered.length > 25 && (
        <nav aria-label="Space pages" className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span>
            Page {currentPage + 1} of {pages}
          </span>
          <Button
            variant="outline"
            disabled={currentPage + 1 >= pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </nav>
      )}
      <Dialog
        open={!!pendingImport}
        onOpenChange={(open) => {
          if (!open && !busy) setPendingImport(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review this import</DialogTitle>
            <DialogDescription>
              {pendingImport?.length} records parsed. Matching source IDs will
              be skipped; existing notes, decisions and suppressions stay
              intact.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {
              pendingImport?.filter((p) =>
                rows.some((r) => r.source.id === p.source.id),
              ).length
            }{" "}
            already loaded. Contacts arrive as unapproved candidates.
          </p>
          <p className="text-sm">
            CSV needs Name and either Address, City or ID. Notes and Website are
            preserved. Maximum {MAX_SPACES} spaces in the workspace. CSV imports
            do not run enrichment.
          </p>
          <p className="text-sm">
            For repeat CSV imports, keep names and location fields consistent,
            or supply the same ID. Records from different sources are not
            automatically merged.
          </p>
          <ul className="text-sm space-y-1">
            {pendingImport?.slice(0, 5).map((r) => (
              <li key={r.source.id}>
                {r.source.name} — {r.source.city || "City not supplied"}
              </li>
            ))}
          </ul>
          <Button onClick={confirmImport} disabled={busy}>
            {busy ? "Importing…" : "Add new spaces"}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setSelected(null);
            setDraft(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && draft && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.source.name}</DialogTitle>
                <DialogDescription>
                  {String(
                    selected.source.original_record.address ||
                      selected.source.city ||
                      "",
                  )}
                </DialogDescription>
              </DialogHeader>
              <SourceLink url={selected.source.website}>
                Open business website
              </SourceLink>
              <div className="text-sm border p-3">
                <strong>Evidence and fit</strong>
                <p>
                  Observed fit: {selected.source.fit.score ?? "Unassessed"}.
                  Crawl: {selected.source.job.status}.
                </p>
                {onResearch && (
                  <Button
                    variant="outline"
                    disabled={busy || suppressed(selected)}
                    onClick={() => void researchSpaces([selected.source.id])}
                  >
                    Research this space
                  </Button>
                )}
                {onWebsite && (
                  <div className="space-y-2">
                    <label className="text-sm">
                      Business website
                      <Input
                        aria-label="Business website"
                        value={websiteDraft}
                        onChange={(e) => setWebsiteDraft(e.target.value)}
                        placeholder="https://business.example"
                      />
                    </label>
                    <Button
                      variant="outline"
                      disabled={busy || !safeUrl(websiteDraft)}
                      onClick={() => void saveWebsite()}
                    >
                      Save website
                    </Button>
                    <p className="text-xs">
                      If open-data lookup cannot identify the site, supply its
                      official business website here.
                    </p>
                  </div>
                )}
                <p className="text-neutral-600">
                  Unknowns:{" "}
                  {selected.source.fit.uncertainties
                    .map((s) => s.replace(/_/g, " "))
                    .join(", ") || "None recorded"}
                </p>
                <details className="mt-2">
                  <summary>View original fit evidence</summary>
                  <pre className="whitespace-pre-wrap break-all text-xs mt-2">
                    {JSON.stringify(selected.source.fit, null, 2)}
                  </pre>
                </details>
              </div>
              <h2 className="font-semibold">Contact evidence</h2>
              <p className="text-sm text-neutral-600">
                Accept only contacts that belong to this location. Published
                does not mean deliverability verified.
              </p>
              {!selected.source.contacts.length && (
                <p>
                  No contacts found. A failed crawl does not establish that none
                  exist.
                </p>
              )}
              {selected.source.contacts.map((contact) => (
                <article className="border p-3 space-y-2" key={contact.id}>
                  <div className="flex flex-wrap gap-2 justify-between">
                    <div>
                      <p className="text-xs uppercase text-neutral-500">
                        {contact.kind}
                      </p>
                      <p className="font-medium break-all">
                        {contact.value}
                        {contact.extension ? ` ext ${contact.extension}` : ""}
                      </p>
                    </div>
                    <label className="text-sm">
                      Decision
                      <select
                        aria-label={`Decision for ${contact.value}`}
                        className="block border rounded p-1"
                        value={draft.contacts[contact.id] || ""}
                        onChange={(e) => {
                          const contacts = { ...draft.contacts };
                          if (e.target.value)
                            contacts[contact.id] = e.target.value as
                              "accepted" | "rejected";
                          else delete contacts[contact.id];
                          setDraft({ ...draft, contacts });
                        }}
                      >
                        <option value="">Needs review</option>
                        <option value="accepted">Accept</option>
                        <option value="rejected">Reject</option>
                      </select>
                    </label>
                  </div>
                  <p className="text-xs">
                    {contact.quality_status.replace(/_/g, " ")} · Checked{" "}
                    {contact.last_checked_at || "unknown"}
                  </p>
                  {contact.review_reasons.length > 0 && (
                    <p className="text-xs font-medium">
                      Review flags:{" "}
                      {contact.review_reasons
                        .map((s) => s.replace(/_/g, " "))
                        .join("; ")}
                    </p>
                  )}
                  {contact.evidence.length ? (
                    contact.evidence.map((e, i) => (
                      <div
                        className="text-xs border-l-2 pl-3 space-y-1"
                        key={i}
                      >
                        <SourceLink url={e.source_url}>
                          {e.source_url || "Source unavailable"}
                        </SourceLink>
                        <p>{e.excerpt_or_signal}</p>
                        <p className="text-neutral-500">
                          {e.extract_method} · {e.observed_at}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-neutral-500">
                      Imported contact. No website evidence captured.
                    </p>
                  )}
                  {draft.contacts[contact.id] === "accepted" &&
                    selected.review.contacts[contact.id] === "accepted" &&
                    !selectedSuppressed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            if (onSave && !onCopy)
                              throw new Error(
                                "Live contact checks are unavailable.",
                              );
                            const value = onCopy
                              ? await onCopy(selected.source.id, contact.id)
                              : contact.value +
                                (contact.extension
                                  ? ` ext ${contact.extension}`
                                  : "");
                            if (!active.current) return;
                            await navigator.clipboard.writeText(value);
                            setMessage("Contact copied.");
                          } catch (e) {
                            setError(
                              e instanceof Error
                                ? e.message
                                : "Contact could not be verified or copied.",
                            );
                          }
                        }}
                      >
                        Copy accepted contact
                      </Button>
                    )}
                </article>
              ))}
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm">
                  Stage
                  <select
                    className="block border rounded p-2 w-full mt-1"
                    value={draft.stage}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        stage: e.target.value as Review["stage"],
                      })
                    }
                  >
                    {[
                      "New",
                      "Reviewing",
                      "Qualified",
                      "Contacted",
                      "Closed",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Segment
                  <select
                    className="block border rounded p-2 w-full mt-1"
                    value={draft.segment}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        segment: e.target.value as Review["segment"],
                      })
                    }
                  >
                    <option value="">Use observed segment</option>
                    {["Wait", "Presence", "Dwell", "Taste", "Catalog"].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </label>
                <label className="text-sm">
                  Manual fit score (optional)
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={draft.fit_score ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fit_score:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-sm">
                  Next follow-up
                  <Input
                    type="date"
                    value={draft.next_follow_up}
                    onChange={(e) =>
                      setDraft({ ...draft, next_follow_up: e.target.value })
                    }
                  />
                </label>
              </div>
              <label className="text-sm">
                Review notes
                <Textarea
                  value={draft.notes}
                  maxLength={20000}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                />
              </label>
              <details className="text-sm">
                <summary>Original notes and history</summary>
                <pre className="text-xs whitespace-pre-wrap break-all p-2">
                  {JSON.stringify(
                    {
                      notes: selected.source.original_record.notes,
                      history: selected.source.original_record.status_history,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedSuppressed}
                  disabled={
                    selected.source.do_not_contact ||
                    selected.source.original_record.do_not_contact === true
                  }
                  onChange={(e) =>
                    setDraft({ ...draft, do_not_contact: e.target.checked })
                  }
                />
                Do not contact — exclude from contact actions and exports
              </label>
              {error && (
                <p role="alert" className="text-red-800 text-sm">
                  {error}
                </p>
              )}
              <Button onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save review"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
