import { z } from "zod";

const text = z.string().max(20000);
const evidenceSchema = z
  .object({
    source_url: text.optional(),
    extract_method: text.optional(),
    excerpt_or_signal: text.optional(),
    observed_at: text.optional(),
  })
  .passthrough();
const contactSchema = z
  .object({
    id: z.string().min(1).max(200),
    kind: z.enum(["email", "phone", "instagram"]),
    value: z.string().min(1).max(500),
    extension: text.nullish(),
    quality_status: text,
    is_primary: z.boolean().optional(),
    relevance: z.number().int().min(0).max(99).optional(),
    review_reasons: z.array(text).default([]),
    evidence: z.array(evidenceSchema).default([]),
    last_checked_at: text.nullish(),
  })
  .passthrough();
export const prospectSchema = z
  .object({
    id: z.string().min(1).max(200),
    name: z.string().min(1).max(500),
    city: text.nullish(),
    neighborhood: text.nullish(),
    website: text.nullish(),
    do_not_contact: z.boolean(),
    original_record: z.record(z.unknown()),
    contacts: z.array(contactSchema).max(1000),
    job: z.object({ status: text, finished_at: text.optional() }).passthrough(),
    fit: z
      .object({
        score: z.number().min(0).max(100).nullable(),
        segment: text.nullish(),
        uncertainties: z.array(text).default([]),
      })
      .passthrough(),
    contact_score: z.number().optional(),
  })
  .passthrough()
  .superRefine((r, ctx) => {
    if (new Set(r.contacts.map((c) => c.id)).size !== r.contacts.length)
      ctx.addIssue({ code: "custom", message: "Duplicate contact IDs" });
  });
export const reviewSchema = z.object({
  stage: z
    .enum(["New", "Reviewing", "Qualified", "Contacted", "Closed"])
    .default("New"),
  notes: z.string().max(20000).default(""),
  segment: z
    .enum(["", "Wait", "Presence", "Dwell", "Taste", "Catalog"])
    .default(""),
  fit_score: z.number().int().min(0).max(100).nullable().default(null),
  next_follow_up: z
    .string()
    .regex(/^$|^\d{4}-\d{2}-\d{2}$/)
    .default(""),
  do_not_contact: z.boolean().default(false),
  contacts: z.record(z.enum(["accepted", "rejected"])).default({}),
});
export type Prospect = z.infer<typeof prospectSchema>;
export type Contact = Prospect["contacts"][number];
export type Review = z.infer<typeof reviewSchema>;
export type Row = { source: Prospect; review: Review; version: number };
export const emptyReview = (): Review => reviewSchema.parse({});
export function parsePilot(input: unknown): Row[] {
  const parsed = z
    .object({
      schema_version: z.literal("0.2.2"),
      records: z.array(prospectSchema).min(1).max(500),
    })
    .parse(input);
  if (new Set(parsed.records.map((r) => r.id)).size !== parsed.records.length)
    throw new Error("Duplicate prospect IDs. Import cancelled.");
  return parsed.records.map((source) => ({
    source,
    review: emptyReview(),
    version: 0,
  }));
}
const kindOrder = { email: 0, instagram: 1, phone: 2 } as const;
/** Contacts in review order: by kind, then the worker's relevance rank (lower is better),
 * with primaries first and unranked contacts last. */
export function orderedContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort(
    (a, b) =>
      kindOrder[a.kind] - kindOrder[b.kind] ||
      Number(!a.is_primary) - Number(!b.is_primary) ||
      (a.relevance ?? 50) - (b.relevance ?? 50) ||
      a.value.localeCompare(b.value),
  );
}
/** The best contact of one kind: primary if set, otherwise the highest ranked. */
export function bestContact(contacts: Contact[], kind: Contact["kind"]) {
  return orderedContacts(contacts.filter((c) => c.kind === kind))[0];
}

export function suppressed(row: Row) {
  return (
    row.source.do_not_contact ||
    row.source.original_record.do_not_contact === true ||
    row.review.do_not_contact
  );
}
export function acceptedContacts(row: Row) {
  return suppressed(row)
    ? []
    : row.source.contacts.filter(
        (c) => row.review.contacts[c.id] === "accepted",
      );
}
export function needsReview(row: Row) {
  return row.source.contacts.some((c) => !row.review.contacts[c.id]);
}
const RESEARCH_COOLDOWN_DAYS: Record<string, number> = {
  completed: 30,
  partial: 30,
  needs_website: 30,
  failed: 1,
  blocked: 180,
};
/** Whether the worker would accept this space for research now. The database
 * makes the final call; this only keeps the button count honest. */
export function researchEligible(row: Row, now = Date.now()): boolean {
  if (row.source.do_not_contact || row.review.do_not_contact) return false;
  const { status, finished_at } = row.source.job;
  if (status === "queued" || status === "running") return false;
  const days = RESEARCH_COOLDOWN_DAYS[status];
  if (!days || !finished_at) return true;
  const finished = Date.parse(finished_at);
  return Number.isNaN(finished) || now - finished >= days * 86_400_000;
}
/** True while a found website still needs the owner to confirm it is this space's. */
export function needsWebsiteConfirm(row: Row): boolean {
  const flag = (row.source as Record<string, unknown>).website_identity_review;
  return (flag === true || flag === "true") && !!safeUrl(row.source.website);
}
/** Research finished without finding any website for this space. */
export function noWebsiteFound(row: Row): boolean {
  return row.source.job.status === "needs_website" && !safeUrl(row.source.website);
}
export function websiteDomain(value?: string | null): string | undefined {
  const href = safeUrl(value);
  return href ? new URL(href).hostname.replace(/^www\./, "").toLowerCase() : undefined;
}
/** Other spaces that point at the same website (branches, or duplicate imports). */
export function sharedWebsite(rows: Row[]): Map<string, Row[]> {
  const byDomain = new Map<string, Row[]>();
  for (const row of rows) {
    const domain = websiteDomain(row.source.website);
    if (domain) byDomain.set(domain, [...(byDomain.get(domain) ?? []), row]);
  }
  const siblings = new Map<string, Row[]>();
  for (const group of byDomain.values())
    if (group.length > 1)
      for (const row of group)
        siblings.set(row.source.id, group.filter((r) => r !== row));
  return siblings;
}
/** A web search for the space, for finding a site the research missed. */
export function webSearchUrl(row: Row): string {
  const place = [row.source.name, row.source.neighborhood, row.source.city || "New York"]
    .filter(Boolean)
    .join(" ");
  return "https://www.google.com/search?q=" + encodeURIComponent(place);
}
export function safeUrl(value?: string | null): string | undefined {
  if (!value) return;
  try {
    const u = new URL(value);
    if (["http:", "https:"].includes(u.protocol) && !u.username && !u.password)
      return u.href;
  } catch {
    /* render invalid sources as plain text */
  }
}
const csvCell = (value: unknown) => {
  let s = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
export function exportContacts(rows: Row[]): string {
  const lines = [
    [
      "Name",
      "Neighborhood",
      "Email",
      "Phone",
      "Instagram",
      "Stage",
      "Next follow-up",
      "Note",
    ],
  ];
  // An address shared by several spaces (one shop's branches, or a duplicate
  // import) is exported once, so outreach never emails the same inbox twice.
  const emailedBy = new Map<string, string>();
  for (const row of rows) {
    const contacts = acceptedContacts(row);
    if (!contacts.length || row.review.stage !== "Qualified") continue;
    const shared: string[] = [];
    const kept = contacts.filter((c) => {
      if (c.kind !== "email") return true;
      const key = c.value.toLowerCase();
      const first = emailedBy.get(key);
      if (first) {
        shared.push(`${c.value} is listed under ${first}`);
        return false;
      }
      emailedBy.set(key, row.source.name);
      return true;
    });
    lines.push([
      row.source.name,
      row.source.neighborhood ?? "",
      ...(["email", "phone", "instagram"] as const).map((kind) =>
        kept
          .filter((c) => c.kind === kind)
          .map((c) => c.value + (c.extension ? ` ext ${c.extension}` : ""))
          .join("; "),
      ),
      row.review.stage,
      row.review.next_follow_up,
      shared.join("; "),
    ]);
  }
  return lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
}
export function mergeNewRows(existing: Row[], imported: Row[]) {
  const ids = new Set(existing.map((r) => r.source.id));
  return [...existing, ...imported.filter((r) => !ids.has(r.source.id))];
}
