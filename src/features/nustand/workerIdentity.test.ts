import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { verifyWorkerToken } from "../../../supabase/functions/_shared/nustand_oidc";
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());
const b64 = (value: Uint8Array) => Buffer.from(value).toString("base64url");
async function fixture(overrides: Record<string, unknown> = {}) {
  const pair = await webcrypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = {
    ...(await webcrypto.subtle.exportKey("jwk", pair.publicKey)),
    kid: "fixture",
  };
  const now = 1000000;
  const claims = {
    iss: "https://token.actions.githubusercontent.com",
    aud: "nustand-research",
    repository: "Neesh-print/neesh-print-hub",
    repository_id: "1135441767",
    repository_visibility: "public",
    ref: "refs/heads/main",
    workflow_ref:
      "Neesh-print/neesh-print-hub/.github/workflows/nustand-research.yml@refs/heads/main",
    sub: "repo:Neesh-print/neesh-print-hub:ref:refs/heads/main",
    event_name: "schedule",
    iat: now,
    exp: now + 600,
    ...overrides,
  };
  const input =
    b64(
      new TextEncoder().encode(
        JSON.stringify({ alg: "RS256", kid: "fixture" }),
      ),
    ) +
    "." +
    b64(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await webcrypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    pair.privateKey,
    new TextEncoder().encode(input),
  );
  return {
    token: input + "." + b64(new Uint8Array(signature)),
    keys: [jwk],
    now,
  };
}
it("accepts the signed main worker identity", async () => {
  const f = await fixture();
  await expect(verifyWorkerToken(f.token, f.keys, f.now)).resolves.toBe(true);
});
it("rejects another repository, branch, workflow, audience, expired token and private runner", async () => {
  for (const override of [
    { repository: "other/repo" },
    { repository_id: "1" },
    { ref: "refs/heads/feature" },
    {
      workflow_ref:
        "Neesh-print/neesh-print-hub/.github/workflows/other.yml@refs/heads/main",
    },
    { aud: "other" },
    { exp: 999999 },
    { repository_visibility: "private" },
    { event_name: "pull_request" },
    { iat: 900000 },
  ]) {
    const f = await fixture(override);
    await expect(verifyWorkerToken(f.token, f.keys, f.now)).rejects.toThrow();
  }
});
it("rejects a forged signature or unknown key", async () => {
  const f = await fixture();
  await expect(
    verifyWorkerToken(f.token.slice(0, -10) + "AAAAAAAAAA", f.keys, f.now),
  ).rejects.toThrow();
  await expect(verifyWorkerToken(f.token, [], f.now)).rejects.toThrow();
});
