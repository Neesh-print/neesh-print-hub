// Neesh dataLayer helpers for Google Tag Manager.
//
// Each function pushes one custom event onto window.dataLayer. The GTM
// container ("Neesh Web") carries a Custom Event trigger per event name with
// a GA4 event tag behind it, so nothing here talks to GA4 directly. Call
// these on success callbacks, not on button presses; trackPackCtaClick is
// the one click event by definition.

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function push(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

/**
 * A curated pack was paid for. Fire on the Stripe checkout success return
 * for a pack, never on the buy click. `value` is the order total in whole
 * currency units (200 for a pack, 300 with the stand); GTM forwards value
 * and currency to GA4 as the conversion value.
 */
export function trackPackPurchase(value: number, currency = 'USD'): void {
  push('pack_purchase', { value, currency });
}

/**
 * A new space (retailer) completed signup. Fire once the account has been
 * created, not on login and not on a repeat visit.
 */
export function trackSpaceSignup(referralSource?: string): void {
  push('space_signup_complete', referralSource ? { referral_source: referralSource } : {});
}

/**
 * A publisher application was submitted for review. Fire once the submit
 * has been saved, not on the button press. `referral_source` is the answer
 * to "How did you hear about Neesh?".
 */
export function trackPublisherApplication(referralSource: string): void {
  push('publisher_application_submitted', { referral_source: referralSource });
}

/**
 * The buy CTA on the curated packs page was clicked, i.e. the click that
 * leaves for Stripe.
 */
export function trackPackCtaClick(): void {
  push('pack_cta_click');
}

/**
 * A message to a publisher was sent. Fire when the send resolves
 * successfully, not on submit.
 */
export function trackPublisherMessage(): void {
  push('publisher_message_sent');
}

/**
 * A title request was confirmed. Fire on the confirmation state after the
 * request has been accepted, not on submit.
 */
export function trackTitleRequest(): void {
  push('title_request_submitted');
}
