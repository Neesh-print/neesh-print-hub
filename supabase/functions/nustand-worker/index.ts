import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { githubKeys, verifyWorkerToken } from "../_shared/nustand_oidc.ts";
import { foursquare, google, validName } from "../_shared/nustand_providers.ts";

const reply = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, { error: "POST required" });
  try {
    const token = request.headers
      .get("Authorization")
      ?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
    if (!token) return reply(401, { error: "Unauthorized worker" });
    await verifyWorkerToken(token, await githubKeys());
  } catch {
    return reply(401, { error: "Unauthorized worker" });
  }
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply(400, { error: "Missing payload" });
    let total = 0,
      body = "";
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 600000) {
        await reader.cancel();
        return reply(413, { error: "Payload too large" });
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const input = JSON.parse(body);
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    if (input.action === "lookup_website") {
      if (!validName(input.name)) return reply(400, { error: "Invalid lookup" });
      // Google only: the 25-space test showed Foursquare added no usable sites.
      // Set NUSTAND_FOURSQUARE=on to call it again as a second source.
      const keys = {
        google: Deno.env.get("GOOGLE_PLACES_API_KEY"),
        foursquare: Deno.env.get("NUSTAND_FOURSQUARE") === "on"
          ? Deno.env.get("FOURSQUARE_API_KEY")
          : undefined,
      };
      const enabled = (Object.keys(keys) as (keyof typeof keys)[]).filter((p) => keys[p]);
      if (!enabled.length) return reply(200, { data: {} });
      // One budget unit per provider call, enforced in the database.
      const { data: allowed, error: budgetError } = await client.rpc(
        "nustand_worker_provider_budget",
        { calls: enabled.length },
      );
      if (budgetError) return reply(409, { error: "Research operation rejected" });
      if (!allowed) return reply(200, { data: { budget_exhausted: true } });
      const lookups = { foursquare, google };
      const data: Record<string, unknown> = {};
      await Promise.all(
        enabled.map(async (provider) => {
          try {
            data[provider] = await lookups[provider](input.name.trim(), keys[provider]!);
          } catch {
            data[provider] = { candidates: [], error: provider + "_unavailable" };
          }
        }),
      );
      return reply(200, { data });
    }
    const operations: Record<string, [string, Record<string, unknown>]> = {
      claim: ["nustand_worker_claim", {}],
      place_budget: ["nustand_worker_place_budget", {}],
      finish: [
        "nustand_worker_finish",
        { job_id: input.job_id, lease_id: input.lease, payload: input.payload },
      ],
    };
    if (!Object.hasOwn(operations, input.action))
      return reply(400, { error: "Unknown operation" });
    const [name, args] = operations[input.action];
    const { data, error } = await client.rpc(name, args);
    if (error) return reply(409, { error: "Research operation rejected" });
    return reply(200, { data });
  } catch {
    return reply(400, { error: "Invalid research request" });
  }
});
