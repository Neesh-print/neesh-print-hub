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
