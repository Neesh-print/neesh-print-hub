// Marketing SMS consent, collected on the publisher and retailer signup
// forms. The exact disclosure shown next to the checkbox is saved with the
// consent record, so carriers (and we) can see what someone agreed to.
// Keep it in line with the "Text messages (SMS)" section of the privacy
// policy on neesh.art.

// Shown under the checkbox, followed by links to the Terms and Privacy Policy.
export const SMS_MARKETING_DISCLOSURE =
  "Yes, text me news, new titles and offers from Neesh at this number. " +
  "Consent is not a condition of any purchase. Message frequency varies. " +
  "Message and data rates may apply. Reply STOP to opt out, HELP for help.";

// What's saved with the consent record: the disclosure plus the link text.
export const SMS_MARKETING_CONSENT_TEXT =
  `${SMS_MARKETING_DISCLOSURE} See our Terms of Service and Privacy Policy.`;

/**
 * Turns what someone typed into an E.164 number (+15035551234), or null if
 * it can't be one. Ten digits, or eleven starting with 1, are read as US and
 * Canada numbers; anything else needs a leading + and country code.
 */
export function normalizeMobileNumber(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 && digits[0] !== "0" ? `+${digits}` : null;
  }
  if (digits.length === 10 && !/^[01]/.test(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1" && !/^[01]/.test(digits.slice(1))) return `+${digits}`;
  return null;
}

export interface SmsMarketingConsent {
  smsMarketingOptIn: boolean;
  smsMarketingPhone: string | null;
  smsMarketingConsentAt: string | null;
  smsMarketingConsentText: string | null;
}

/** The record saved with an application. Empty unless the box was ticked with a valid number. */
export function buildSmsMarketingConsent(optIn: boolean, phone: string): SmsMarketingConsent {
  const normalized = optIn ? normalizeMobileNumber(phone) : null;
  if (!normalized) {
    return {
      smsMarketingOptIn: false,
      smsMarketingPhone: null,
      smsMarketingConsentAt: null,
      smsMarketingConsentText: null,
    };
  }
  return {
    smsMarketingOptIn: true,
    smsMarketingPhone: normalized,
    smsMarketingConsentAt: new Date().toISOString(),
    smsMarketingConsentText: SMS_MARKETING_CONSENT_TEXT,
  };
}

export const SMS_PHONE_ERROR = "Enter a mobile number, like 503 555 1234 or +44 7700 900123.";
