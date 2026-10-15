// Server-side place lookups for Nustand research. Provider keys live only in
// Supabase secrets; the GitHub runner receives candidate listings, never keys.
export type PlaceCandidate = {
  name: string;
  place_id?: string | null;
  address: string | null;
  neighborhood?: string | null;
  borough?: string | null;
  primary_type?: string | null;
  primary_type_label?: string | null;
  types?: string[];
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
].map((f) => "places." + f).join(",");

// Borough boxes for discovery, matching the database's allowed areas.
export const AREAS: Record<string, { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } }> = {
  "New York": NYC,
  Manhattan: { low: { latitude: 40.68, longitude: -74.03 }, high: { latitude: 40.88, longitude: -73.9 } },
  Brooklyn: { low: { latitude: 40.56, longitude: -74.05 }, high: { latitude: 40.74, longitude: -73.83 } },
  Queens: { low: { latitude: 40.54, longitude: -73.97 }, high: { latitude: 40.81, longitude: -73.7 } },
  Bronx: { low: { latitude: 40.78, longitude: -73.94 }, high: { latitude: 40.92, longitude: -73.76 } },
  "Staten Island": { low: { latitude: 40.49, longitude: -74.26 }, high: { latitude: 40.65, longitude: -74.05 } },
};

// What to search for in each ICP segment. Kept short: one Google call each.
export const SEGMENT_QUERIES: Record<string, string[]> = {
  Wait: ["hair salon", "day spa", "dentist office"],
  Presence: ["specialty coffee shop", "wine bar", "members club"],
  Dwell: ["clothing boutique", "furniture design store", "art gallery"],
  Taste: ["boutique hotel", "coworking space", "design studio"],
  Catalog: ["independent bookstore", "newsstand magazines", "record store"],
};

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
    primary_type: text(p.primaryType, 80),
    primary_type_label: text(p.primaryTypeDisplayName?.text, 80),
    types: Array.isArray(p.types) ? p.types.filter((t: unknown) => typeof t === "string").slice(0, 12) : [],
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
): Promise<ProviderResult> {
  const response = await fetcher("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({
      textQuery: query,
      pageSize,
      locationBias: { rectangle: AREAS[area as string] ?? NYC },
    }),
  });
  if (!response.ok) return { candidates: [], error: "google_" + response.status };
  const data = await response.json();
  const places = Array.isArray(data.places) ? data.places.slice(0, pageSize) : [];
  return {
    candidates: places
      .filter((p: Record<string, unknown>) => p.businessStatus !== "CLOSED_PERMANENTLY")
      .map(mapGoogle),
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
  for (const q of queries) {
    try {
      const result = await searchText(`${q} in ${where}`, key, area, 20, fetcher);
      if (result.error) errors.push(result.error);
      for (const c of result.candidates) {
        const id = c.place_id || c.name + "|" + c.address;
        if (!seen.has(id)) {
          seen.add(id);
          candidates.push(c);
        }
      }
    } catch {
      errors.push("google_unavailable");
    }
  }
  return { candidates, error: errors[0], calls: queries.length };
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
