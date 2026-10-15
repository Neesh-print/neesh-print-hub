import { start } from "./start.ts";

const assert = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg); };
const env = (vars: Record<string, string>) => (n: string) => vars[n];
const github = (status: number, seen: Request[] = []) =>
  ((input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input, init));
    return Promise.resolve(new Response(null, { status }));
  }) as typeof fetch;

Deno.test("only the owner can start the worker", async () => {
  const seen: Request[] = [];
  const denied = await start("Bearer x", env({ GITHUB_DISPATCH_TOKEN: "t" }), github(204, seen), async () => false);
  assert(denied.status === 403 && seen.length === 0, "non-owner blocked before GitHub");
  const anon = await start(null, env({}), github(204, seen), async () => true);
  assert(anon.status === 401 && seen.length === 0, "no session blocked");
});

Deno.test("starts the one research workflow on main", async () => {
  const seen: Request[] = [];
  const ok = await start("Bearer x", env({ GITHUB_DISPATCH_TOKEN: "t" }), github(204, seen), async () => true);
  assert(ok.body.started === true, "started");
  assert(seen[0].url.endsWith("/workflows/nustand-research.yml/dispatches"), "right workflow");
  assert(JSON.parse(await seen[0].text()).ref === "main", "main branch");
});

Deno.test("degrades quietly without a token or when GitHub refuses", async () => {
  const none = await start("Bearer x", env({}), github(204), async () => true);
  assert(none.body.started === false && none.body.reason === "not_configured", "no token");
  const refused = await start("Bearer x", env({ GITHUB_DISPATCH_TOKEN: "t" }), github(403), async () => true);
  assert(refused.body.reason === "github_403", "refusal reported");
});
