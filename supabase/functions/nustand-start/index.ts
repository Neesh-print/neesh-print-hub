import { start } from "./start.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

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
