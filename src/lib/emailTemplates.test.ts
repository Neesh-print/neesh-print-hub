import { describe, expect, it } from "vitest";
import {
  html,
  lineItems,
  renderEmail,
  stats,
  titleList,
} from "../../supabase/functions/_shared/email";
import { generateConfirmEmail } from "../../supabase/functions/_shared/retailer-emails";
import {
  EMAIL_SUBJECTS,
  generateApplicationReceivedEmail,
  generateApprovalEmail,
  generateRejectionEmail,
} from "./emailTemplates";

const EMOJI = /\p{Extended_Pictographic}/u;

describe("renderEmail", () => {
  it("escapes interpolated text but keeps html fragments", () => {
    const out = renderEmail({
      preheader: "Preview <b>",
      label: "Test",
      eyebrow: "Eyebrow",
      heading: 'Shop "<script>alert(1)</script>"',
      intro: html`Hi ${"<img src=x>"}, ${html`<strong>bold</strong>`}`,
      blocks: [],
    });
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("Hi &lt;img src=x&gt;, <strong>bold</strong>");
    expect(out).toContain("Preview &lt;b&gt;");
  });

  it("uses the design system palette, not the old one", () => {
    const out = renderEmail({ preheader: "p", label: "l", heading: "h", blocks: [] });
    expect(out).toContain("#efeef6");
    expect(out).toContain("NEESH");
    expect(out).not.toMatch(/#C49A6C|#1A1A1A|#F5F5F0|box-shadow/i);
  });
});

describe("blocks", () => {
  it("renders line items with a total", () => {
    const out = lineItems(
      [{ title: "Mag & Co", subtitle: "Pub", quantity: 2, amount: 40.7 }],
      { total: { label: "Total", amount: 40.7 } },
    ).value;
    expect(out).toContain("Mag &amp; Co");
    expect(out).toContain("$40.70");
  });

  it("renders stats and a cover placeholder when there is no cover", () => {
    expect(stats([{ label: "Total", value: "$1.00" }]).value).toContain("$1.00");
    const list = titleList([{ title: "No cover", coverUrl: null }]).value;
    expect(list).not.toContain("<img");
  });
});

describe("application and retailer emails", () => {
  const emails = [
    generateApprovalEmail({
      firstName: "Ada",
      businessName: "Shop",
      role: "retailer",
      recoveryLinkUrl: "https://neesh.art/reset-password?token_hash=a&type=recovery",
      forgotPasswordUrl: "https://neesh.art/forgot-password",
    }),
    generateRejectionEmail({ firstName: "Ada", businessName: "Shop", role: "publisher", reason: "Not a fit" }),
    generateApplicationReceivedEmail({ firstName: "Ada", businessName: "Shop", role: "publisher" }),
    generateApplicationReceivedEmail({ firstName: "Ada", businessName: "Shop", role: "publisher", claimTitle: "Mag" }),
    generateConfirmEmail({ firstName: "", shopName: null, verifyEmailUrl: "https://neesh.art/verify-email?token=t", welcome: false }),
    generateConfirmEmail({ firstName: "Ada", shopName: "Shop", verifyEmailUrl: "https://neesh.art/verify-email?token=t", welcome: true }),
  ];

  it("contain no emoji", () => {
    for (const e of emails) expect(e).not.toMatch(EMOJI);
    for (const subject of [EMAIL_SUBJECTS.approval("Shop"), EMAIL_SUBJECTS.rejection("Shop")]) {
      expect(subject).not.toMatch(EMOJI);
    }
  });

  it("put the action links in", () => {
    expect(emails[0]).toContain("token_hash=a&amp;type=recovery");
    expect(emails[4]).toContain("https://neesh.art/verify-email?token=t");
    expect(emails[4]).not.toContain("Hi ,");
  });
});
