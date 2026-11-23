import { describe, expect, it } from "vitest";
import {
  buildSmsMarketingConsent,
  mobileNumberError,
  normalizeMobileNumber,
  SMS_MARKETING_CONSENT_TEXT,
  SMS_PHONE_ERROR,
} from "./sms-consent";

describe("normalizeMobileNumber", () => {
  it("reads ten digits as a US or Canada number", () => {
    expect(normalizeMobileNumber("(503) 555-1234")).toBe("+15035551234");
    expect(normalizeMobileNumber("503.555.1234")).toBe("+15035551234");
  });

  it("accepts a leading 1 or +1", () => {
    expect(normalizeMobileNumber("1 503 555 1234")).toBe("+15035551234");
    expect(normalizeMobileNumber("+1 503 555 1234")).toBe("+15035551234");
  });

  it("accepts international numbers with a +", () => {
    expect(normalizeMobileNumber("+44 7700 900123")).toBe("+447700900123");
  });

  it("rejects numbers it can't place", () => {
    expect(normalizeMobileNumber("")).toBeNull();
    expect(normalizeMobileNumber("555-1234")).toBeNull();
    expect(normalizeMobileNumber("044 7700 900123")).toBeNull();
    expect(normalizeMobileNumber("0035551234")).toBeNull();
    expect(normalizeMobileNumber("+1234567890123456")).toBeNull();
  });
});

describe("mobileNumberError", () => {
  it("allows a blank number, which means email only", () => {
    expect(mobileNumberError(true, "  ")).toBeUndefined();
  });

  it("flags a typed number that isn't valid", () => {
    expect(mobileNumberError(true, "555")).toBe(SMS_PHONE_ERROR);
  });

  it("ignores the number when the box is unticked", () => {
    expect(mobileNumberError(false, "555")).toBeUndefined();
  });
});

describe("buildSmsMarketingConsent", () => {
  it("records consent with the number, time and wording", () => {
    const consent = buildSmsMarketingConsent(true, "503 555 1234");
    expect(consent.smsMarketingOptIn).toBe(true);
    expect(consent.smsMarketingPhone).toBe("+15035551234");
    expect(consent.smsMarketingConsentText).toBe(SMS_MARKETING_CONSENT_TEXT);
    expect(Date.parse(consent.smsMarketingConsentAt ?? "")).not.toBeNaN();
  });

  it("records nothing when the box is unticked, even with a number", () => {
    expect(buildSmsMarketingConsent(false, "503 555 1234")).toEqual({
      smsMarketingOptIn: false,
      smsMarketingPhone: null,
      smsMarketingConsentAt: null,
      smsMarketingConsentText: null,
    });
  });

  it("records nothing for email only (ticked, no number)", () => {
    expect(buildSmsMarketingConsent(true, "").smsMarketingOptIn).toBe(false);
  });
});
