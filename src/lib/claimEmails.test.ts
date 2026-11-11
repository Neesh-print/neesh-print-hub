import { describe, expect, it } from "vitest";
import {
  generateApplicationReceivedEmail,
  generateApprovalEmail,
  generateClaimApprovalEmail,
  generateSellApprovalEmail,
  EMAIL_SUBJECTS,
} from "./emailTemplates";

describe("claim-only emails", () => {
  it("claim received: no password, no orders, says selling is separate", () => {
    const html = generateApplicationReceivedEmail({
      firstName: "Ana",
      businessName: "Chew Co",
      role: "publisher",
      claimTitle: "CHEW",
      claimOnly: true,
    });
    expect(html).toContain("We got your claim for CHEW.");
    expect(html).toContain("No password needed");
    expect(html).toContain("does not sign you up to sell");
    expect(html).not.toMatch(/set your password/i);
    expect(html).not.toMatch(/start selling your magazines to stores/i);
  });

  it("claim approval: Edit your page button is the sign-in link, no password", () => {
    const html = generateClaimApprovalEmail({
      firstName: "Ana",
      titleName: "CHEW",
      editPageUrl: "https://app.neesh.art/auth/callback?token_hash=abc&type=magiclink&next=%2Fpublisher%2Findex-listing",
      loginUrl: "https://app.neesh.art/login",
      startSellingUrl: "https://app.neesh.art/apply/publisher?sell=1",
    });
    expect(html).toContain("Your claim-only account is ready.");
    expect(html).toContain("claim-only account");
    expect(html).toMatch(/does <strong[^>]*>not<\/strong> list your titles for sale/);
    expect(html).toContain("Edit your page");
    expect(html).toContain("token_hash=abc");
    expect(html).toContain("Email me a sign-in link");
    expect(html).toContain("apply/publisher?sell=1");
    expect(html).not.toMatch(/set your password/i);
  });

  it("claim approval subject says claim-only", () => {
    expect(EMAIL_SUBJECTS.claimApproval("CHEW")).toBe("Your claim-only account for CHEW on the Neesh Index");
  });

  it("seller approval mentions email sign-in when a login URL is given", () => {
    const html = generateApprovalEmail({
      firstName: "Ana",
      businessName: "Chew Co",
      role: "publisher",
      recoveryLinkUrl: "https://app.neesh.art/reset-password?token_hash=x&type=recovery",
      forgotPasswordUrl: "https://app.neesh.art/forgot-password",
      loginUrl: "https://app.neesh.art/login",
    });
    expect(html).toContain("Set your password");
    expect(html).toContain("Email me a sign-in link");
  });

  it("start-selling approval signs them in to the dashboard", () => {
    const html = generateSellApprovalEmail({
      firstName: "Ana",
      businessName: "Chew Co",
      dashboardUrl: "https://app.neesh.art/auth/callback?token_hash=y&type=magiclink&next=%2Fpublisher",
      loginUrl: "https://app.neesh.art/login",
    });
    expect(html).toContain("You can now sell on Neesh, Ana.");
    expect(html).toContain("Connect Stripe");
  });
});
