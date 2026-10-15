// Start the Nustand research worker now instead of waiting for its schedule.
// Owner-only: the caller's own session must pass the owner check in the
// database. The GitHub token can only start this one workflow.
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const WORKFLOW =
  "https://api.github.com/repos/Neesh-print/neesh-print-hub/actions/workflows/nustand-research.yml/dispatches";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function start(
  authorization: string | null,
  env: (name: string) => string | undefined,
  fetcher: typeof fetch = fetch,
  isOwner?: (authorization: string) => Promise<boolean>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!authorization?.startsWith("Bearer ")) return { status: 401, body: { error: "Sign in required" } };
  const owner = isOwner ??
    (async (auth: string) => {
      const client = createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // nustand_research_status raises for anyone but the Nustand owner.
      const { error } = await client.rpc("nustand_research_status");
      return !error;
    });
  if (!(await owner(authorization))) return { status: 403, body: { error: "Nustand access denied" } };
  const token = env("GITHUB_DISPATCH_TOKEN");
  if (!token) return { status: 200, body: { started: false, reason: "not_configured" } };
  const response = await fetcher(WORKFLOW, {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  // GitHub keeps at most one waiting run for this workflow, so repeat clicks are harmless.
  return response.status === 204
    ? { status: 200, body: { started: true } }
    : { status: 200, body: { started: false, reason: "github_" + response.status } };
}

if (import.meta.main) {
  Deno.serve(async (request: Request) => {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return reply(405, { error: "POST required" });
    try {
      const result = await start(request.headers.get("Authorization"), (n) => Deno.env.get(n));
      return reply(result.status, result.body);
    } catch {
      return reply(200, { started: false, reason: "unavailable" });
    }
  });
}
