import { describe, expect, it } from "vitest";
import { getLinkError } from "./auth-link";

describe("getLinkError", () => {
  it("reads an expired link from the hash", () => {
    expect(
      getLinkError("", "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired")
    ).toBe("otp_expired");
  });

  it("reads errors from the query string", () => {
    expect(getLinkError("?error=access_denied", "")).toBe("access_denied");
  });

  it("returns null for a normal recovery link", () => {
    expect(getLinkError("?token_hash=abc&type=recovery", "")).toBeNull();
    expect(getLinkError("", "#access_token=x&type=recovery")).toBeNull();
  });
});
