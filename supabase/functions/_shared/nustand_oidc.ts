// Authenticate one repository's main-branch worker with short-lived GitHub OIDC.
// No database credential is placed in GitHub or sent to the runner.
const issuer = "https://token.actions.githubusercontent.com";
export const audience = "nustand-research";
const repository = "Neesh-print/neesh-print-hub";
const decode = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
export async function verifyWorkerToken(
  token: string,
  keys: JsonWebKey[],
  now = Date.now() / 1000,
) {
  if (token.length > 16000) throw new Error("Unauthorized worker");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Unauthorized worker");
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  if (header.alg !== "RS256" || typeof header.kid !== "string")
    throw new Error("Unauthorized worker");
  const jwk = keys.find(
    (k) =>
      (k as JsonWebKey & { kid?: string }).kid === header.kid &&
      k.kty === "RSA",
  );
  if (!jwk) throw new Error("Unauthorized worker");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decode(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1]),
    ))
  )
    throw new Error("Unauthorized worker");
  const p = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if (
    p.iss !== issuer ||
    p.aud !== audience ||
    p.repository !== repository ||
    String(p.repository_id) !== "1135441767" ||
    p.repository_visibility !== "public" ||
    p.ref !== "refs/heads/main" ||
    p.workflow_ref !==
      repository + "/.github/workflows/nustand-research.yml@refs/heads/main" ||
    p.sub !== "repo:" + repository + ":ref:refs/heads/main" ||
    !["schedule", "workflow_dispatch"].includes(p.event_name) ||
    typeof p.exp !== "number" ||
    p.exp <= now ||
    p.exp > now + 1200 ||
    typeof p.iat !== "number" ||
    p.iat > now + 60 ||
    p.iat < now - 1200 ||
    (typeof p.nbf === "number" && p.nbf > now + 60)
  )
    throw new Error("Unauthorized worker");
  return true;
}
let cached: { keys: JsonWebKey[]; expires: number } | null = null;
export async function githubKeys() {
  if (cached && cached.expires > Date.now()) return cached.keys;
  const response = await fetch(issuer + "/.well-known/jwks", {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Worker identity provider unavailable");
  const payload = await response.json();
  if (!Array.isArray(payload.keys) || payload.keys.length > 20)
    throw new Error("Invalid worker identity keys");
  cached = { keys: payload.keys, expires: Date.now() + 300000 };
  return cached.keys;
}
