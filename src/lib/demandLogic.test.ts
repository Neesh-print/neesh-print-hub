import { describe, expect, it } from "vitest";
import {
  confidenceFor,
  decideDraft,
  findTitle,
  matchKey,
  pageText,
  placePhrase,
  publisherDraft,
  sameShop,
  spamReason,
  requesterDraft,
  storeNearPostcode,
  businessDomain,
  domainStem,
  inferSegment,
  unsubscribeLine,
  type TitleDemand,
} from "../../supabase/functions/_shared/demand-logic";

const base: TitleDemand = {
  title_id: "t1",
  title_name: "Heavy Traffic",
  title_slug: "heavy-traffic",
  publisher_id: "p1",
  publisher_name: "Heavy Traffic Press",
  title_state: "unclaimed",
  publisher_email: "ed@example.com",
  do_not_contact: false,
  distributor_exclusive: false,
  open_reader_30d: 2,
  open_space_30d: 0,
  reader_30d: 2,
  space_30d: 0,
  postcodes_90d: ["11211", "10003"],
  publisher_outreach_count: 0,
  publisher_last_emailed_at: null,
};
const now = new Date("2026-11-23T15:00:00Z");
const opts = { now, publisherHasPending: false, recipientSent: 0 };

describe("shop matching", () => {
  it("normalises like directory_stores.match_key", () => {
    expect(matchKey("MagCulture – Serpentine")).toBe("magcultureserpentine");
    expect(matchKey("Café Ünïcode")).toBe("cafeunicode");
  });
  it("treats close names as the same shop", () => {
    expect(sameShop("Magculture", "magCulture")).toBe(true);
    expect(sameShop("The Paradis Superstore", "Paradis Superstore")).toBe(true);
    expect(sameShop("Paradis Superstore", "Paradis Superstor")).toBe(true);
    expect(sameShop("Paradis Superstore", "Paradiso")).toBe(false);
    expect(sameShop("Ace", "Ace Hotel")).toBe(false);
  });
});

describe("spam filter", () => {
  it("rejects junk names", () => {
    expect(spamReason("", "Brussels")).toBe("empty name");
    expect(spamReason("www.cheap-pills.com", "Brussels")).toBe("URL in name");
    expect(spamReason("12345", "Brussels")).toBe("no letters in name");
    expect(spamReason("aaaaaaaaa", "Brussels")).toBe("repeated characters");
  });
  it("keeps real names", () => {
    expect(spamReason("Do You Read Me?!", "Berlin")).toBeNull();
    expect(spamReason("Paradis Superstore", "Brussels")).toBeNull();
  });
});

describe("title search", () => {
  const text = pageText("<html><script>var Slanted=1</script><p>New in: Slanted&nbsp;#43 and MacGuffin</p></html>");
  it("finds the title in visible text", () => {
    expect(findTitle(text, "Slanted")).toContain("Slanted #43");
    expect(findTitle(text, "macguffin")).not.toBeNull();
  });
  it("needs a whole-word match", () => {
    expect(findTitle("unslanted views", "Slanted")).toBeNull();
    expect(findTitle(text, "Magazine B")).toBeNull();
  });
  it("sets confidence from what matched", () => {
    expect(confidenceFor(true, true)).toBe("confirmed");
    expect(confidenceFor(true, false)).toBe("likely");
    expect(confidenceFor(false, false)).toBe("unverified");
  });
});

describe("publisher draft decision", () => {
  it("drafts A for an unclaimed title with 2 readers", () => {
    expect(decideDraft(base, opts)).toEqual({ action: "draft", template: "A" });
  });
  it("needs 2 readers or 1 space", () => {
    expect(decideDraft({ ...base, open_reader_30d: 1 }, opts)).toMatchObject({ action: "skip" });
    expect(decideDraft({ ...base, open_reader_30d: 0, open_space_30d: 1 }, opts)).toEqual({ action: "draft", template: "A" });
  });
  it("B only fires on space requests", () => {
    expect(decideDraft({ ...base, title_state: "claimed" }, opts)).toMatchObject({ action: "skip" });
    expect(decideDraft({ ...base, title_state: "claimed", open_space_30d: 1 }, opts)).toEqual({ action: "draft", template: "B" });
  });
  it("C for out of stock, nothing for selling", () => {
    expect(decideDraft({ ...base, title_state: "out_of_stock" }, opts)).toEqual({ action: "draft", template: "C" });
    expect(decideDraft({ ...base, title_state: "selling" }, opts)).toMatchObject({ action: "skip" });
  });
  it("applies every skip rule", () => {
    expect(decideDraft({ ...base, do_not_contact: true }, opts)).toMatchObject({ action: "skip" });
    expect(decideDraft({ ...base, distributor_exclusive: true }, opts)).toMatchObject({ action: "skip" });
    expect(decideDraft({ ...base, publisher_email: null }, opts)).toEqual({ action: "needs_contact" });
    expect(decideDraft({ ...base, publisher_outreach_count: 2 }, opts)).toMatchObject({ reason: "publisher cap reached" });
    expect(decideDraft(base, { ...opts, recipientSent: 2 })).toMatchObject({ reason: "recipient cap reached" });
    expect(decideDraft(base, { ...opts, publisherHasPending: true })).toMatchObject({ reason: "draft already waiting" });
    expect(decideDraft({ ...base, publisher_last_emailed_at: "2026-11-01T00:00:00Z" }, opts)).toMatchObject({
      reason: "emailed in the last 45 days",
    });
    expect(decideDraft({ ...base, publisher_last_emailed_at: "2026-09-01T00:00:00Z" }, opts)).toEqual({
      action: "draft",
      template: "A",
    });
  });
});

describe("publisher copy", () => {
  it("says where only when the postcodes allow it", () => {
    expect(placePhrase(["11211", "10003"])).toBe(" in New York");
    expect(placePhrase(["11211", "60614"])).toBe(" in the US");
    expect(placePhrase(["1000", "11211"])).toBe("");
    expect(placePhrase([])).toBe("");
  });

  it("follows the copy rules in every template", () => {
    for (const [template, d] of [
      ["A", base],
      ["B", { ...base, title_state: "claimed", open_space_30d: 1 }],
      ["C", { ...base, title_state: "out_of_stock" }],
    ] as const) {
      const { subject, body } = publisherDraft(template, d);
      const all = subject + body;
      expect(all).not.toMatch(/—/);
      expect(all).not.toMatch(/\b(carry|supply|wholesale)\b/i);
      expect(all).toContain("utm_source=email&utm_medium=outreach&utm_campaign=demand&utm_content=" + template);
      expect(body.endsWith("Gem")).toBe(true);
      if (template !== "C") expect(body).toMatch(/distributor/);
    }
  });

  it("fills template A", () => {
    const { subject, body } = publisherDraft("A", base);
    expect(subject).toBe("Readers are asking where to find Heavy Traffic");
    expect(body).toMatch(/^2 readers in New York asked where they can buy Heavy Traffic in person this month\./);
    expect(body).toContain("https://app.neesh.art/apply/publisher?title=Heavy+Traffic&claim=heavy-traffic&publisher=Heavy+Traffic+Press");
  });

  it("uses the singular for one space in template B", () => {
    const { subject, body } = publisherDraft("B", { ...base, title_state: "claimed", open_space_30d: 1 });
    expect(subject).toBe("A new stockist wants to order Heavy Traffic directly");
    expect(body.startsWith("A space in New York wants to order Heavy Traffic directly from you.")).toBe(true);
  });
});

describe("requester copy (D to G)", () => {
  const cases = [
    requesterDraft("D", { title: "MacGuffin", titleSlug: "macguffin", shop: "Paradis Superstore", city: "Brussels" }),
    requesterDraft("E", { title: "Slanted", shop: "Casa Magazines", area: "Manhattan", storeSlug: "casa-magazines-new-york" }),
    requesterDraft("F", { title: "Anchoa", magazineId: "m1" }),
    requesterDraft("G", { title: "Anchoa", magazineId: "m1", qty: 12 }),
  ];
  it("follows the spec wording", () => {
    expect(cases[0].subject).toBe("Paradis Superstore is now on the Neesh Index for MacGuffin");
    expect(cases[0].body).toMatch(/^Thanks for the tip\. Paradis Superstore in Brussels now shows up as a place to find MacGuffin\./);
    expect(cases[1].body).toMatch(/^You asked where to find Slanted in person\. Casa Magazines in Manhattan has it\./);
    expect(cases[2].subject).toBe("You can order Anchoa on Neesh now");
    expect(cases[3].body).toMatch(/^Anchoa is back in stock on Neesh, 12 copies available\./);
  });
  it("signs Neesh, tags links, no em dashes or pricing", () => {
    for (const [i, c] of cases.entries()) {
      expect(c.body.endsWith("Neesh")).toBe(true);
      expect(c.body).toContain("utm_content=" + "DEFG"[i]);
      expect(c.subject + c.body).not.toMatch(/\u2014|\$|price|fee|%/i);
    }
  });
  it("has a one-line unsubscribe", () => {
    expect(unsubscribeLine("https://x.test/u")).not.toContain("\n");
  });
});

describe("near you", () => {
  const nyc = { city: "New York", country: "US", address: null };
  it("matches inside New York City", () => {
    expect(storeNearPostcode("11211", nyc)).toBe(true);
    expect(storeNearPostcode("10003", { city: null, country: "US", address: "1 Main St, Brooklyn, NY 11201" })).toBe(true);
  });
  it("matches the same ZIP3 elsewhere", () => {
    expect(storeNearPostcode("87501", { city: "Santa Fe", country: "US", address: "2 Plaza, Santa Fe, NM 87505" })).toBe(true);
    expect(storeNearPostcode("87501", { city: "Santa Fe", country: "US", address: null })).toBe(false);
    expect(storeNearPostcode("02912", nyc)).toBe(false);
  });
  it("never matches outside the US or without a postcode", () => {
    expect(storeNearPostcode("11211", { city: "London", country: "GB", address: "11211" })).toBe(false);
    expect(storeNearPostcode(null, nyc)).toBe(false);
  });
});

describe("space routing", () => {
  it("only uses real business domains", () => {
    expect(businessDomain("Owner@FlowersForSantaFe.com")).toBe("flowersforsantafe.com");
    expect(businessDomain("someone@gmail.com")).toBeNull();
    expect(businessDomain("x@evil.com),contact_email.ilike.%")).toBeNull();
    expect(businessDomain(null)).toBeNull();
  });
  it("searches Places by the domain stem", () => {
    expect(domainStem("flowersforsantafe.com")).toBe("flowersforsantafe");
    expect(domainStem("olucompany.co.uk")).toBe("olucompany");
  });
  it("guesses the ICP segment from place types", () => {
    expect(inferSegment(["florist", "store"])).toBe("Dwell");
    expect(inferSegment(["cafe", "food"])).toBe("Presence");
    expect(inferSegment(["hair_care", "beauty_salon"])).toBe("Wait");
    expect(inferSegment(["book_store"])).toBe("Catalog");
    expect(inferSegment([])).toBeNull();
  });
});

describe("approval message for the suggester's thank-you", () => {
  it("says a draft is waiting only when one was written", async () => {
    const { thanksNote } = await import("@/hooks/useDemandQueue");
    expect(thanksNote("drafted")).toBe(". A thank-you to the suggester is waiting in Emails");
    expect(thanksNote("no email to thank")).toBe("");
    expect(thanksNote(undefined)).toBe("");
    expect(thanksNote("request is from before automated replies started")).toBe(
      ". No thank-you drafted: request is from before automated replies started",
    );
  });
});
