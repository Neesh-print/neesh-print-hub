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

import { cleanName, discoverGoogle, targetIndependents } from "./nustand_providers.ts";

Deno.test("discovery pages each query, maps tags, de-duplicates and drops chains", async () => {
  const seen: Request[] = [];
  const place = (id: string, name: string, website: string, extra: Record<string, unknown> = {}) => ({
    id, displayName: { text: name }, primaryType: "hair_salon", types: ["hair_salon"], userRatingCount: 120,
    addressComponents: [{ longText: "Fort Greene", types: ["neighborhood", "political"] }, { longText: "Brooklyn", types: ["sublocality_level_1", "sublocality"] }],
    websiteUri: website, businessStatus: "OPERATIONAL", ...extra,
  });
  const pages = [
    { places: [place("p1", "Salon Nordic", "https://salon.example"), place("c1", "Drybar", "https://www.drybar.com/x")], nextPageToken: "t2" },
    { places: [place("p1", "Salon Nordic", "https://salon.example"), place("closed", "Shut", "https://shut.example", { businessStatus: "CLOSED_TEMPORARILY" })] },
  ];
  let i = 0;
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input, init));
    const body = JSON.parse(String(init?.body));
    return Promise.resolve(new Response(JSON.stringify(body.pageToken ? pages[1] : pages[0]), { status: 200 }));
  }) as typeof fetch;
  const result = await discoverGoogle("Wait", "Brooklyn", "Fort Greene", "k", fetcher);
  assert(result.calls === 10 && seen.length === 10, "five queries x two pages");
  assert(result.candidates.length === 1 && result.candidates[0].name === "Salon Nordic", "chain, closed and duplicate dropped");
  const c = result.candidates[0];
  assert(c.neighborhood === "Fort Greene" && c.borough === "Brooklyn" && c.reviews === 120, "tags mapped");
  const first = JSON.parse(await seen[0].text());
  assert(first.textQuery.endsWith("in Fort Greene, Brooklyn, New York, NY") && first.pageSize === 20, "query shape");
  assert(seen[0].headers.get("X-Goog-FieldMask")!.includes("nextPageToken"), "page token requested");
  void i;
});

Deno.test("independents rank above listings with less to contact", () => {
  const ranked = targetIndependents([
    { name: "No site", address: null, website: null, phone: null, email: null, instagram: null, source_url: "" },
    { name: "Has site", address: null, website: "https://a.example", phone: "1", email: null, instagram: null, source_url: "", reviews: 80 },
    { name: "Repeated 1", address: null, website: "https://chain.example/1", phone: null, email: null, instagram: null, source_url: "" },
    { name: "Repeated 2", address: null, website: "https://chain.example/2", phone: null, email: null, instagram: null, source_url: "" },
    { name: "Repeated 3", address: null, website: "https://chain.example/3", phone: null, email: null, instagram: null, source_url: "" },
  ]);
  assert(ranked.map((p) => p.name).join(",") === "Has site,No site", "repeated domain treated as a chain");
});

Deno.test("booking-platform links are not websites; keyword-stuffed names are trimmed", async () => {
  const result = await google("x", "k", fake(200, { places: [
    { id: "a", displayName: { text: "ARYA HAIR SALON NYC, Highlights, Balayage Highlights, Hair Color, Color Correction" }, websiteUri: "https://www.vagaro.com/arya", businessStatus: "OPERATIONAL" },
    { id: "b", displayName: { text: "Vu Hair" }, websiteUri: "https://www.vuhair.com", businessStatus: "OPERATIONAL" },
  ] }));
  assert(result.candidates[0].website === null && result.candidates[0].name === "ARYA HAIR SALON NYC", "platform dropped, name trimmed");
  assert(result.candidates[1].website === "https://www.vuhair.com" && result.candidates[1].name === "Vu Hair", "own site kept");
  assert(cleanName("Smile Tonight - Dentist Office Dr. Michael C. Iott, DDS") === "Smile Tonight", "dash split");
});
