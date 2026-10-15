import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import {
  prospectSchema,
  reviewSchema,
  type Row,
  type Review,
  exportContacts,
} from "./model";
// Narrow adapter until the reviewed SQL is applied and generated types refreshed.
// Uses the existing authenticated client; never a service-role client.
const rpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;
/** Ask the worker to start now. Best effort: if it can't, the 5-minute schedule picks the job up. */
export async function startWorker(): Promise<boolean> {
  try {
    const { data } = await supabase.functions.invoke("nustand-start", { body: {} });
    return Boolean((data as { started?: boolean } | null)?.started);
  } catch {
    return false;
  }
}
async function call(name: string, args?: Record<string, unknown>) {
  const result = await rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
function parseRows(data: unknown): Row[] {
  return z
    .array(
      z.object({
        source: prospectSchema,
        review: reviewSchema,
        version: z.number().int(),
      }),
    )
    .parse(data)
    .map((r) => ({ source: r.source, review: r.review, version: r.version }));
}
export async function loadRows(): Promise<Row[]> {
  return parseRows(await call("nustand_list"));
}
export async function importRows(rows: Row[]): Promise<number> {
  return z
    .number()
    .parse(
      await call("nustand_import", { records: rows.map((r) => r.source) }),
    );
}
export async function saveReview(row: Row, review: Review): Promise<number> {
  return z.number().parse(
    await call("nustand_review", {
      prospect_id: row.source.id,
      expected_version: row.version,
      next_review: reviewSchema.parse(review),
    }),
  );
}

// Always resolve contact actions against current saved decisions, not tab memory.
export async function exportCurrentContacts(ids: string[]): Promise<string> {
  return exportContacts(
    parseRows(await call("nustand_export", { prospect_ids: ids })),
  );
}
export async function copyCurrentContact(
  id: string,
  contactId: string,
): Promise<string> {
  return z
    .string()
    .min(1)
    .max(21000)
    .parse(
      await call("nustand_contact_value", {
        prospect_id: id,
        contact_id: contactId,
      }),
    );
}

export type ResearchJob = {
  id: string;
  prospect_id: string | null;
  kind: "research" | "discovery";
  status: string;
  error: string | null;
  pages: number;
  requests: number;
  finished_at: string | null;
  input: Record<string, unknown>;
  result?: { candidates?: unknown[]; attribution?: string } | null;
};
export async function researchStatus(): Promise<{
  enabled: boolean;
  jobs: ResearchJob[];
}> {
  return z
    .object({
      enabled: z.boolean(),
      jobs: z.array(
        z.object({
          id: z.string(),
          prospect_id: z.string().nullable(),
          kind: z.enum(["research", "discovery"]),
          status: z.string(),
          error: z.string().nullable(),
          pages: z.number(),
          requests: z.number(),
          finished_at: z.string().nullable(),
          input: z.record(z.unknown()),
          result: z
            .object({
              candidates: z.array(z.unknown()).optional(),
              attribution: z.string().optional(),
            })
            .nullable()
            .optional(),
        }),
      ),
    })
    .parse(await call("nustand_research_status"));
}
export async function queueResearch(ids: string[]): Promise<number> {
  const queued = z
    .number()
    .int()
    .parse(await call("nustand_research_queue", { prospect_ids: ids }));
  if (queued > 0) void startWorker();
  return queued;
}
export async function discoverSpaces(
  area: string,
  segment: string,
  neighborhood: string,
): Promise<string> {
  const id = z
    .string()
    .parse(
      await call("nustand_discovery_queue", { area, segment, neighborhood }),
    );
  void startWorker();
  return id;
}
export async function setWebsite(id: string, website: string): Promise<void> {
  await call("nustand_set_website", { prospect_id: id, website });
}
export async function confirmWebsites(ids: string[]): Promise<number> {
  return z
    .number()
    .int()
    .parse(await call("nustand_confirm_websites", { prospect_ids: ids }));
}
