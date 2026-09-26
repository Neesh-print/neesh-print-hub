// marketing-data: a private read/write proxy to GA4 and Google Ads.
//
// Called only from the database (admin_ops.marketing), never from the app.
// Auth: the gateway checks the anon JWT; this function then requires
// x-marketing-key to match the vault secret 'marketing_proxy_key'.
// Google credentials live in the vault and are read through the
// service-role-only RPC get_marketing_secrets().
//
// Actions (body: { action, payload }):
//   status        -> which credentials are present, and a live check of each
//   ga4_report    -> GA4 Data API runReport (payload is the request body;
//                    optional payload.property, default 503986632)
//   ga4_realtime  -> GA4 Data API runRealtimeReport
//   gads_search   -> Google Ads GAQL search; payload { query, customer_id?,
//                    version?, max_rows? }
//   gads_mutate   -> Google Ads mutate; payload { resource, operations,
//                    customer_id?, version?, validate_only? } where resource
//                    is e.g. 'campaigns', 'adGroupCriteria', 'campaignBudgets'.
//                    validate_only defaults to TRUE; pass false to apply.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DEFAULT_PROPERTY = "503986632";
const DEFAULT_CUSTOMER = "1995266772";
// v22 sunsets in autumn 2026; v24 is supported into 2027. Override per call
// with payload.version when a newer one is needed.
const DEFAULT_ADS_VERSION = "v24";

type Secrets = Partial<Record<
  | "ga4_service_account"
  | "gads_developer_token"
  | "gads_client_id"
  | "gads_client_secret"
  | "gads_refresh_token"
  | "gads_login_customer_id",
  string
>>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

class HttpError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
}

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

// ---------- GA4: service-account JWT -> access token ----------

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function ga4Token(saJson: string): Promise<string> {
  let sa: { client_email: string; private_key: string; token_uri?: string };
  try {
    sa = JSON.parse(saJson);
  } catch {
    throw new HttpError(500, "ga4_service_account is not valid JSON");
  }
  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${
    b64url(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }))
  }`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64url(sig)}`,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new HttpError(502, { step: "ga4_token", google: body });
  return body.access_token;
}

async function ga4(
  secrets: Secrets,
  method: "runReport" | "runRealtimeReport",
  payload: Record<string, unknown>,
) {
  if (!secrets.ga4_service_account) {
    throw new HttpError(412, "ga4_service_account is not in the vault yet");
  }
  const { property, ...request } = payload;
  const prop = digits(property) || DEFAULT_PROPERTY;
  const token = await ga4Token(secrets.ga4_service_account);
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${prop}:${method}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  const body = await res.json();
  if (!res.ok) throw new HttpError(res.status, { step: method, google: body });
  return body;
}

// ---------- Google Ads: refresh token -> access token ----------

async function adsToken(s: Secrets): Promise<string> {
  const missing = [
    "gads_developer_token",
    "gads_client_id",
    "gads_client_secret",
    "gads_refresh_token",
  ].filter((k) => !s[k as keyof Secrets]);
  if (missing.length) {
    throw new HttpError(412, `missing in vault: ${missing.join(", ")}`);
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: s.gads_client_id!,
      client_secret: s.gads_client_secret!,
      refresh_token: s.gads_refresh_token!,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new HttpError(502, { step: "gads_token", google: body });
  return body.access_token;
}

function adsHeaders(s: Secrets, token: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": s.gads_developer_token!,
    "Content-Type": "application/json",
  };
  const login = digits(s.gads_login_customer_id);
  if (login) h["login-customer-id"] = login;
  return h;
}

async function gadsSearch(s: Secrets, p: Record<string, unknown>) {
  const query = String(p.query ?? "").trim();
  if (!query) throw new HttpError(400, "payload.query (GAQL) is required");
  const cid = digits(p.customer_id) || DEFAULT_CUSTOMER;
  const ver = String(p.version ?? DEFAULT_ADS_VERSION);
  const maxRows = Math.min(Number(p.max_rows ?? 5000), 50000);
  const token = await adsToken(s);
  const headers = adsHeaders(s, token);

  const rows: unknown[] = [];
  let pageToken: string | undefined;
  let fieldMask: unknown;
  do {
    const res = await fetch(
      `https://googleads.googleapis.com/${ver}/customers/${cid}/googleAds:search`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
      },
    );
    const body = await res.json();
    if (!res.ok) {
      throw new HttpError(res.status, { step: "gads_search", google: body });
    }
    rows.push(...(body.results ?? []));
    fieldMask ??= body.fieldMask;
    pageToken = body.nextPageToken;
  } while (pageToken && rows.length < maxRows);

  return {
    customer_id: cid,
    row_count: rows.length,
    truncated: Boolean(pageToken),
    fieldMask,
    results: rows.slice(0, maxRows),
  };
}

async function gadsMutate(s: Secrets, p: Record<string, unknown>) {
  const resource = String(p.resource ?? "");
  if (!/^[a-zA-Z]+$/.test(resource)) {
    throw new HttpError(400, "payload.resource is required, e.g. 'campaigns'");
  }
  if (!Array.isArray(p.operations) || p.operations.length === 0) {
    throw new HttpError(400, "payload.operations must be a non-empty array");
  }
  const cid = digits(p.customer_id) || DEFAULT_CUSTOMER;
  const ver = String(p.version ?? DEFAULT_ADS_VERSION);
  const validateOnly = p.validate_only !== false;
  const token = await adsToken(s);
  const res = await fetch(
    `https://googleads.googleapis.com/${ver}/customers/${cid}/${resource}:mutate`,
    {
      method: "POST",
      headers: adsHeaders(s, token),
      body: JSON.stringify({
        operations: p.operations,
        validateOnly,
        partialFailure: Boolean(p.partial_failure),
      }),
    },
  );
  const body = await res.json();
  if (!res.ok) throw new HttpError(res.status, { step: "gads_mutate", google: body });
  return { validate_only: validateOnly, customer_id: cid, ...body };
}

// ---------- status ----------

async function status(s: Secrets) {
  const present = Object.fromEntries(
    [
      "ga4_service_account",
      "gads_developer_token",
      "gads_client_id",
      "gads_client_secret",
      "gads_refresh_token",
      "gads_login_customer_id",
    ].map((k) => [k, Boolean(s[k as keyof Secrets])]),
  );
  const out: Record<string, unknown> = { present };
  try {
    const r = await ga4(s, "runReport", {
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      metrics: [{ name: "sessions" }],
    });
    out.ga4 = { ok: true, sessions_7d: r.rows?.[0]?.metricValues?.[0]?.value ?? "0" };
  } catch (e) {
    out.ga4 = { ok: false, error: e instanceof HttpError ? e.detail : String(e) };
  }
  try {
    const r = await gadsSearch(s, {
      query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1",
    });
    out.gads = { ok: true, customer: r.results[0] ?? null };
  } catch (e) {
    out.gads = { ok: false, error: e instanceof HttpError ? e.detail : String(e) };
  }
  return out;
}

// ---------- handler ----------

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const key = req.headers.get("x-marketing-key") ?? "";
  if (!key) return json({ error: "unauthorized" }, 401);
  const { data: ok, error: keyErr } = await admin.rpc(
    "verify_marketing_proxy_key",
    { p_key: key },
  );
  if (keyErr || ok !== true) return json({ error: "unauthorized" }, 401);

  let action = "";
  let payload: Record<string, unknown> = {};
  try {
    const body = await req.json();
    action = String(body.action ?? "");
    payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  } catch {
    return json({ error: "body must be JSON { action, payload }" }, 400);
  }

  const { data: secrets, error: secErr } = await admin.rpc("get_marketing_secrets");
  if (secErr) return json({ error: "could not read secrets" }, 500);
  const s = (secrets ?? {}) as Secrets;

  try {
    switch (action) {
      case "status":
        return json(await status(s));
      case "ga4_report":
        return json(await ga4(s, "runReport", payload));
      case "ga4_realtime":
        return json(await ga4(s, "runRealtimeReport", payload));
      case "gads_search":
        return json(await gadsSearch(s, payload));
      case "gads_mutate":
        return json(await gadsMutate(s, payload));
      default:
        return json({
          error: "unknown action",
          actions: ["status", "ga4_report", "ga4_realtime", "gads_search", "gads_mutate"],
        }, 400);
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.detail }, e.status);
    return json({ error: String(e) }, 500);
  }
});
