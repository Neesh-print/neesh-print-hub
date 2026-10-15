import { foursquare, google } from "./nustand_providers.ts";

const assert = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg); };
const fake = (status: number, body: unknown, seen: Request[] = []) =>
  ((input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input, init));
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as typeof fetch;

Deno.test("google maps fields, drops closed places and unsafe sites", async () => {
  const seen: Request[] = [];
  const result = await google("McNally Jackson", "k", fake(200, { places: [
    { id: "a", displayName: { text: "McNally Jackson Books" }, websiteUri: "https://mcnallyjackson.com", nationalPhoneNumber: "(718) 555-0100", businessStatus: "OPERATIONAL" },
    { id: "b", displayName: { text: "Old Shop" }, websiteUri: "https://old.example", businessStatus: "CLOSED_PERMANENTLY" },
    { id: "c", displayName: { text: "Bad" }, websiteUri: "javascript:alert(1)" },
  ] }, seen));
  assert(result.candidates.length === 2, "closed place removed");
  assert(result.candidates[0].website === "https://mcnallyjackson.com", "website kept");
  assert(result.candidates[1].website === null, "unsafe website dropped");
  assert(seen[0].headers.get("X-Goog-FieldMask")!.includes("places.websiteUri"), "field mask set");
});

Deno.test("foursquare maps fields and reports HTTP errors", async () => {
  const seen: Request[] = [];
  const ok = await foursquare("Fugazi", "k", fake(200, { results: [
    { fsq_place_id: "x", name: "Fugazi", website: "https://fugazi.example", tel: "212", email: "hi@fugazi.example", social_media: { instagram: "fugazi" }, location: { formatted_address: "1 Main St" } },
  ] }, seen));
  assert(ok.candidates[0].email === "hi@fugazi.example" && ok.candidates[0].instagram === "fugazi", "contacts mapped");
  assert(seen[0].headers.get("Authorization") === "Bearer k", "bearer auth");
  assert(seen[0].headers.get("X-Places-Api-Version") === "2025-06-17", "version header");
  const bad = await foursquare("Fugazi", "k", fake(401, {}));
  assert(bad.error === "foursquare_401" && bad.candidates.length === 0, "error surfaced");
});
