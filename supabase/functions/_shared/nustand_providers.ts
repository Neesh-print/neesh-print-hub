// Server-side place lookups for Nustand research. Provider keys live only in
// Supabase secrets; the GitHub runner receives candidate listings, never keys.
export type PlaceCandidate = {
  name: string;
  address: string | null;
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

export async function google(
  name: string,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<ProviderResult> {
  const response = await fetcher(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.businessStatus",
      },
      body: JSON.stringify({
        textQuery: name + ", New York, NY",
        pageSize: 3,
        locationBias: { rectangle: NYC },
      }),
    },
  );
  if (!response.ok) return { candidates: [], error: "google_" + response.status };
  const data = await response.json();
  const places = Array.isArray(data.places) ? data.places.slice(0, 3) : [];
  return {
    candidates: places
      .filter((p: Record<string, unknown>) => p.businessStatus !== "CLOSED_PERMANENTLY")
      .map((p: Record<string, any>) => ({
        name: text(p.displayName?.text, 200) ?? "",
        address: text(p.formattedAddress),
        website: web(p.websiteUri),
        phone: text(p.nationalPhoneNumber, 50),
        email: null,
        instagram: null,
        source_url:
          "https://www.google.com/maps/place/?q=place_id:" +
          encodeURIComponent(String(p.id ?? "")),
      })),
  };
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
