// Marketing consent on the publisher and retailer signup forms. One optional,
// unticked box covers marketing email and text; texts only go to people who
// tick it and add a mobile number. The exact wording shown is saved with the
// SMS consent record, so carriers (and we) can see what someone agreed to.
// Keep it in line with the "Text messages (SMS)" section of the privacy
// policy on neesh.art.

export const MARKETING_OPT_IN_LABEL = "Send me Neesh news, insights and offers by email and text";

// Shown under the checkbox, followed by links to the Terms and Privacy Policy.
export const SMS_MARKETING_DISCLOSURE =
  "Add a mobile number to get them by text too. Consent is not a condition of any purchase. " +
  "Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help.";

// What's saved with the consent record: the label, the disclosure and the link text.
export const SMS_MARKETING_CONSENT_TEXT =
  `${MARKETING_OPT_IN_LABEL}. ${SMS_MARKETING_DISCLOSURE} See our Terms of Service and Privacy Policy.`;

export const SMS_PHONE_ERROR = "Enter a mobile number, like 503 555 1234 or +44 7700 900123, or leave it blank.";

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

/** The number is optional (blank means email only), but a typed one has to be valid. */
export function mobileNumberError(optIn: boolean, phone: string): string | undefined {
  if (!optIn || phone.trim() === "") return undefined;
  return normalizeMobileNumber(phone) ? undefined : SMS_PHONE_ERROR;
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
