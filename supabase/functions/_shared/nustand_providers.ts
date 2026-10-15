// Server-side place lookups for Nustand research. Provider keys live only in
// Supabase secrets; the GitHub runner receives candidate listings, never keys.
export type PlaceCandidate = {
  name: string;
  place_id?: string | null;
  address: string | null;
  neighborhood?: string | null;
  borough?: string | null;
  postal_code?: string | null;
  primary_type?: string | null;
  primary_type_label?: string | null;
  types?: string[];
  reviews?: number | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  source_url: string;
};
export type ProviderResult = { candidates: PlaceCandidate[]; error?: string };

// New York City bounding box, matching the discovery areas.
const NYC = {
  low: { latitude: 40.49, longitude: -74.26 },
  high: { latitude: 40.92, longitude: -73.7 },
};
const text = (v: unknown, max = 500) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const web = (v: unknown) => {
  const s = text(v, 2000);
  return s && /^https?:\/\//i.test(s) ? s : null;
};

const FIELDS = [
  "id", "displayName", "formattedAddress", "addressComponents", "websiteUri",
  "nationalPhoneNumber", "businessStatus", "primaryType", "primaryTypeDisplayName", "types",
  "userRatingCount",
].map((f) => "places." + f).join(",") + ",nextPageToken";

// Borough boxes for discovery, matching the database's allowed areas.
export const AREAS: Record<string, { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } }> = {
  "New York": NYC,
  Manhattan: { low: { latitude: 40.68, longitude: -74.03 }, high: { latitude: 40.88, longitude: -73.9 } },
  Brooklyn: { low: { latitude: 40.56, longitude: -74.05 }, high: { latitude: 40.74, longitude: -73.83 } },
  Queens: { low: { latitude: 40.54, longitude: -73.97 }, high: { latitude: 40.81, longitude: -73.7 } },
  Bronx: { low: { latitude: 40.78, longitude: -73.94 }, high: { latitude: 40.92, longitude: -73.76 } },
  "Staten Island": { low: { latitude: 40.49, longitude: -74.26 }, high: { latitude: 40.65, longitude: -74.05 } },
};

// What to search for in each ICP segment. Each query costs one Google call
// per page of up to 20 results.
export const SEGMENT_QUERIES: Record<string, string[]> = {
  Wait: ["independent hair salon", "barbershop", "nail salon", "day spa", "dental office"],
  Presence: ["specialty coffee shop", "natural wine bar", "cocktail bar", "bakery cafe", "members club"],
  Dwell: ["independent clothing boutique", "home goods store", "furniture design store", "art gallery", "concept store"],
  Taste: ["boutique hotel", "coworking space", "design studio", "architecture firm", "creative agency"],
  Catalog: ["independent bookstore", "newsstand", "record store", "museum shop", "specialty grocery"],
};
export const PAGES_PER_QUERY = 2;
export const discoveryCalls = (segment: string) => (SEGMENT_QUERIES[segment]?.length ?? 0) * PAGES_PER_QUERY;

// Chains and franchises: not Neesh buyers. Matched on website domain.
const CHAIN_DOMAINS = new Set([
  "starbucks.com", "dunkindonuts.com", "bluebottlecoffee.com", "joeandthejuice.com", "pretamanger.com",
  "drybar.com", "supercuts.com", "greatclips.com", "europeanwax.com", "heyday.com", "ulta.com", "sephora.com",
  "aspendental.com", "marriott.com", "hilton.com", "hyatt.com", "ihg.com", "wework.com", "regus.com",
  "industriousoffice.com", "barnesandnoble.com", "hudsonbooksellers.com", "cvs.com", "walgreens.com",
  "duanereade.com", "zara.com", "hm.com", "uniqlo.com", "gap.com", "anthropologie.com", "urbanoutfitters.com",
  "westelm.com", "potterybarn.com", "crateandbarrel.com", "ikea.com", "wholefoodsmarket.com", "traderjoes.com",
]);
const domainOf = (url: string | null) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};
/** Drop chains (known domains, or one domain repeated across results) and rank independents first. */
export function targetIndependents(places: PlaceCandidate[]): PlaceCandidate[] {
  const counts = new Map<string, number>();
  for (const p of places) {
    const d = domainOf(p.website);
    if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const kept = places.filter((p) => {
    const d = domainOf(p.website);
    return !d || (!CHAIN_DOMAINS.has(d) && (counts.get(d) ?? 0) < 3);
  });
  // A website and an established-but-not-huge following read as independents worth contacting.
  const score = (p: PlaceCandidate) =>
    (p.website ? 2 : 0) + (p.phone ? 1 : 0) + ((p.reviews ?? 0) >= 20 && (p.reviews ?? 0) <= 2000 ? 1 : 0);
  return kept.sort((a, b) => score(b) - score(a));
}

function component(p: Record<string, any>, ...kinds: string[]): string | null {
  const parts = Array.isArray(p.addressComponents) ? p.addressComponents : [];
  for (const kind of kinds) {
    const hit = parts.find((c: Record<string, any>) => Array.isArray(c.types) && c.types.includes(kind));
    if (hit) return text(hit.longText, 100);
  }
  return null;
}

function mapGoogle(p: Record<string, any>): PlaceCandidate {
  return {
    name: text(p.displayName?.text, 200) ?? "",
    place_id: text(p.id, 200),
    address: text(p.formattedAddress),
    neighborhood: component(p, "neighborhood"),
    borough: component(p, "sublocality_level_1", "sublocality", "locality"),
    postal_code: component(p, "postal_code"),
    primary_type: text(p.primaryType, 80),
    primary_type_label: text(p.primaryTypeDisplayName?.text, 80),
    types: Array.isArray(p.types) ? p.types.filter((t: unknown) => typeof t === "string").slice(0, 12) : [],
    reviews: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    website: web(p.websiteUri),
    phone: text(p.nationalPhoneNumber, 50),
    email: null,
    instagram: null,
    source_url:
      "https://www.google.com/maps/place/?q=place_id:" + encodeURIComponent(String(p.id ?? "")),
  };
}

async function searchText(
  query: string,
  key: string,
  area: keyof typeof AREAS | string,
  pageSize: number,
  fetcher: typeof fetch,
  pageToken?: string,
): Promise<ProviderResult & { next?: string }> {
  const response = await fetcher("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({
      textQuery: query,
      pageSize,
      locationBias: { rectangle: AREAS[area as string] ?? NYC },
      ...(pageToken ? { pageToken } : {}),
    }),
  });
  if (!response.ok) return { candidates: [], error: "google_" + response.status };
  const data = await response.json();
  const places = Array.isArray(data.places) ? data.places.slice(0, pageSize) : [];
  return {
    candidates: places
      .filter((p: Record<string, unknown>) => !p.businessStatus || p.businessStatus === "OPERATIONAL")
      .map(mapGoogle),
    next: typeof data.nextPageToken === "string" ? data.nextPageToken : undefined,
  };
}

export function google(name: string, key: string, fetcher: typeof fetch = fetch) {
  return searchText(name + ", New York, NY", key, "New York", 3, fetcher);
}

/** Find spaces of one ICP segment in an area or neighborhood. One call per query. */
export async function discoverGoogle(
  segment: string,
  area: string,
  neighborhood: string,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<ProviderResult & { calls: number }> {
  const queries = SEGMENT_QUERIES[segment] ?? [];
  const where = [neighborhood, area === "New York" ? "" : area, "New York, NY"].filter(Boolean).join(", ");
  const seen = new Set<string>();
  const candidates: PlaceCandidate[] = [];
  const errors: string[] = [];
  let calls = 0;
  const runQuery = async (q: string) => {
    let token: string | undefined;
    for (let page = 0; page < PAGES_PER_QUERY; page++) {
      try {
        calls++;
        const result = await searchText(`${q} in ${where}`, key, area, 20, fetcher, token);
        if (result.error) errors.push(result.error);
        for (const c of result.candidates) {
          const id = c.place_id || c.name + "|" + c.address;
          if (!seen.has(id)) {
            seen.add(id);
            candidates.push(c);
          }
        }
        token = result.next;
        if (!token) break;
      } catch {
        errors.push("google_unavailable");
        break;
      }
    }
  };
  // Queries run side by side; pages within a query follow each other.
  await Promise.all(queries.map(runQuery));
  return { candidates: targetIndependents(candidates), error: errors[0], calls };
}

export async function foursquare(
  name: string,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<ProviderResult> {
  const params = new URLSearchParams({
    query: name,
    near: "New York, NY",
    limit: "3",
    fields: "fsq_place_id,name,location,website,tel,email,social_media,date_closed",
  });
  const response = await fetcher(
    "https://places-api.foursquare.com/places/search?" + params,
    {
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + key,
        "X-Places-Api-Version": "2025-06-17",
      },
    },
  );
  if (!response.ok) return { candidates: [], error: "foursquare_" + response.status };
  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results.slice(0, 3) : [];
  return {
    candidates: results
      .filter((p: Record<string, unknown>) => !p.date_closed)
      .map((p: Record<string, any>) => ({
        name: text(p.name, 200) ?? "",
        address: text(p.location?.formatted_address),
        website: web(p.website),
        phone: text(p.tel, 50),
        email: text(p.email, 320),
        instagram: text(p.social_media?.instagram, 100),
        source_url:
          "https://foursquare.com/v/" + encodeURIComponent(String(p.fsq_place_id ?? "")),
      })),
  };
}

export function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 1 && value.length <= 200;
}
