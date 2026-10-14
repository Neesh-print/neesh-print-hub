import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { prospectSchema, reviewSchema, type Row, type Review } from "./model";
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
export async function loadRows(): Promise<Row[]> {
  return z
    .array(
      z.object({
        source: prospectSchema,
        review: reviewSchema,
        version: z.number().int(),
      }),
    )
    .parse(await call("nustand_list"))
    .map((r) => ({ source: r.source, review: r.review, version: r.version }));
}
export async function importRows(rows: Row[]): Promise<number> {
  return z
    .number()
    .parse(
      await call("nustand_import", { records: rows.map((r) => r.source) }),
    );
}
export async function saveReview(row: Row, review: Review): Promise<number> {
  return z
    .number()
    .parse(
      await call("nustand_review", {
        prospect_id: row.source.id,
        expected_version: row.version,
        next_review: reviewSchema.parse(review),
      }),
    );
}
