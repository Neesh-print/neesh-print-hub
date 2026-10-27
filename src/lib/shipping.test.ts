import { describe, it, expect } from "vitest";
import {
  NEESH_SPACE_MULTIPLIER,
  NEESH_PUBLISHER_MULTIPLIER,
  spaceUnitPrice,
  publisherUnitPayout,
  goodsSplit,
  shippingSplit,
  normalizeCountry,
  zoneFor,
  incotermFor,
  needsCustoms,
  flatShipping,
  flatRatesFor,
  regionFor,
  originRegion,
  type FlatRatesByRegion,
  landedMargin,
  marginBand,
  breakEvenCopies,
  healthyCopies,
  suggestHealthyRetail,
  checkMinimums,
  minimumSelectableQuantity,
  buildParcel,
  pickCheapestTrackedRate,
  buildCustomsDeclaration,
  itemsKey,
  rateCacheKey,
  type CarrierRate,
} from "./shipping";

// FAY Issue 2: the worked example from the tickets.
const FAY = { wsp: 16, srp: 22.5 };
// Live Colissimo DDP quotes Paris -> New York 10030 (Oct 22, 2026).
const FAY_TO_NY = [
  { quantity: 1, shippingUsd: 39.97 },
  { quantity: 5, shippingUsd: 57.69 },
  { quantity: 10, shippingUsd: 81.41 },
  { quantity: 20, shippingUsd: 137.8 },
];

describe("fees", () => {
  it("spaces pay 1.10 and publishers receive 0.90", () => {
    expect(NEESH_SPACE_MULTIPLIER).toBe(1.1);
    expect(NEESH_PUBLISHER_MULTIPLIER).toBe(0.9);
    expect(spaceUnitPrice(16)).toBe(17.6);
    expect(publisherUnitPayout(16)).toBe(14.4);
    expect(spaceUnitPrice(0)).toBe(0);
  });

  it("splits goods into gross, net and the Neesh fee", () => {
    expect(goodsSplit(16, 5)).toEqual({ gross: 88, net: 72, platformFee: 16 });
    // Unit price is rounded to the cent first, like the Stripe line item.
    expect(goodsSplit(12.99, 3)).toEqual({ gross: 42.87, net: 35.07, platformFee: 7.8 });
  });

  it("passes shipping through with no fee and deducts a Neesh label", () => {
    expect(shippingSplit(57.69)).toEqual({ gross: 57.69, net: 57.69, platformFee: 0 });
    expect(shippingSplit(57.69, 57.69)).toEqual({ gross: 57.69, net: 0, platformFee: 0 });
    expect(shippingSplit(57.69, 50)).toEqual({ gross: 57.69, net: 7.69, platformFee: 0 });
    expect(shippingSplit(10, 12).net).toBe(0);
  });
});

describe("zones", () => {
  it("normalises names and codes", () => {
    expect(normalizeCountry("United States")).toBe("US");
    expect(normalizeCountry("us")).toBe("US");
    expect(normalizeCountry("UK")).toBe("GB");
    expect(normalizeCountry("France")).toBe("FR");
    expect(normalizeCountry("")).toBeNull();
    expect(normalizeCountry("Atlantis")).toBeNull();
  });

  it("is domestic in the same country", () => {
    expect(zoneFor("US", "United States")).toBe("domestic");
    expect(zoneFor("GB", "GB")).toBe("domestic");
  });

  it("is domestic EU to EU", () => {
    expect(zoneFor("FR", "DE")).toBe("domestic");
    expect(zoneFor("IT", "NL")).toBe("domestic");
  });

  it("treats the UK as international from the EU", () => {
    expect(zoneFor("FR", "GB")).toBe("international");
    expect(zoneFor("GB", "IE")).toBe("international");
  });

  it("is international across other borders and when unknown", () => {
    expect(zoneFor("FR", "US")).toBe("international");
    expect(zoneFor("CA", "US")).toBe("international");
    expect(zoneFor(null, "US")).toBe("international");
  });

  it("uses DDP only for US-bound parcels from outside the US", () => {
    expect(incotermFor("FR", "US")).toBe("DDP");
    expect(incotermFor("US", "CA")).toBeNull();
    expect(incotermFor("FR", "GB")).toBeNull();
    expect(needsCustoms("FR", "DE")).toBe(false);
    expect(needsCustoms("FR", "GB")).toBe(true);
  });
});

describe("flat rates", () => {
  it("charges first plus each additional", () => {
    const rates = { firstCopyUsd: 20, additionalCopyUsd: 4 };
    expect(flatShipping(rates, 1)).toBe(20);
    expect(flatShipping(rates, 5)).toBe(36);
    expect(flatShipping(rates, 10)).toBe(56);
  });

  it("returns null when the zone is unset", () => {
    expect(flatShipping({ firstCopyUsd: null, additionalCopyUsd: null }, 3)).toBeNull();
  });
});

describe("regions", () => {
  it("resolves the spec examples", () => {
    expect(regionFor("CA", "US")).toBe("us");
    expect(regionFor("CA", "DE")).toBe("eu");
    expect(regionFor("DE", "FR")).toBe("domestic");
    expect(regionFor("GB", "NL")).toBe("eu");
    expect(regionFor("CA", "AU")).toBe("row");
  });

  it("follows zoneFor for domestic, including names", () => {
    expect(regionFor("CA", "Canada")).toBe("domestic");
    expect(regionFor("US", "United States")).toBe("domestic");
    expect(regionFor("FR", "GB")).toBe("uk");
    expect(regionFor("US", "CA")).toBe("ca");
    expect(regionFor("CA", "CH")).toBe("row");
  });

  it("falls back to the destination when the origin is unknown", () => {
    expect(regionFor(null, "US")).toBe("us");
    expect(regionFor("Atlantis", "AU")).toBe("row");
    expect(regionFor("CA", null)).toBe("row");
    expect(regionFor("CA", "Atlantis")).toBe("row");
  });

  it("hides only a named region for the origin", () => {
    expect(originRegion("CA")).toBe("ca");
    expect(originRegion("DE")).toBe("eu");
    expect(originRegion("GB")).toBe("uk");
    expect(originRegion("AU")).toBeNull();
    expect(originRegion(null)).toBeNull();
  });
});

describe("per-region flat rates", () => {
  const toronto: FlatRatesByRegion = {
    domestic: { first: 9, additional: 3 },
    us: { first: 6, additional: 2 },
    eu: { first: 10, additional: 3 },
    uk: { first: 8 },
  };
  const quote = (dest: string, copies: number) => flatShipping(flatRatesFor(toronto, regionFor("CA", dest)), copies);

  it("prices each region as first plus each additional", () => {
    expect(quote("US", 5)).toBe(14);
    expect(quote("DE", 5)).toBe(22);
    expect(quote("CA", 5)).toBe(21);
  });

  it("treats a missing extra-copy rate as 0", () => {
    expect(quote("GB", 5)).toBe(8);
  });

  it("returns null for a blank region", () => {
    expect(quote("AU", 5)).toBeNull();
    expect(flatRatesFor({}, "us")).toEqual({ firstCopyUsd: null, additionalCopyUsd: null });
    expect(flatRatesFor(null, "us")).toEqual({ firstCopyUsd: null, additionalCopyUsd: null });
  });

  it("matches the old domestic/international quotes after the backfill", () => {
    // Orbital Studies: domestic 9 + 3, international 8 + 3, copied into every region.
    const backfilled: FlatRatesByRegion = {
      domestic: { first: 9, additional: 3 },
      us: { first: 8, additional: 3 }, ca: { first: 8, additional: 3 }, uk: { first: 8, additional: 3 },
      eu: { first: 8, additional: 3 }, row: { first: 8, additional: 3 },
    };
    const old = { domestic: { firstCopyUsd: 9, additionalCopyUsd: 3 }, international: { firstCopyUsd: 8, additionalCopyUsd: 3 } };
    for (const origin of ["CA", "DE", "AU", null]) {
      for (const dest of ["US", "DE", "AU", "CA", "GB", "FR"]) {
        for (const copies of [1, 5, 10]) {
          expect(flatShipping(flatRatesFor(backfilled, regionFor(origin, dest)), copies))
            .toBe(flatShipping(old[zoneFor(origin, dest)], copies));
        }
      }
    }
  });
});

describe("landed margin", () => {
  it("reproduces the FAY worked example with flat 20 + 4", () => {
    const rates = { firstCopyUsd: 20, additionalCopyUsd: 4 };
    const margins = [1, 5, 10, 20].map(
      (q) => landedMargin({ ...FAY, quantity: q, shippingUsd: flatShipping(rates, q)! }).margin,
    );
    expect(margins).toEqual([-15.1, -11.5, -7, 2]);
  });

  it("matches the approved title badge: 10 FAY to New York is a loss of 32.41 (-14%)", () => {
    const m = landedMargin({ ...FAY, quantity: 10, shippingUsd: 81.41 });
    expect(m.margin).toBe(-32.41);
    expect(Math.round(m.marginPct * 100)).toBe(-14);
    expect(m.band).toBe("loss");
    expect(m.landedPerCopy).toBe(25.74);
  });

  it("matches the approved cart line for Kitchen Table: +35.04 (35%), Healthy", () => {
    const m = landedMargin({ wsp: 10, srp: 20, quantity: 5, shippingUsd: 9.96 });
    expect(m.margin).toBe(35.04);
    expect(Math.round(m.marginPct * 100)).toBe(35);
    expect(m.band).toBe("healthy");
  });
});

describe("margin bands", () => {
  it("is Loss below 0, Thin from 0 to 25%, Healthy from 25%", () => {
    expect(marginBand(-0.01, -0.001)).toBe("loss");
    expect(marginBand(0, 0)).toBe("thin");
    expect(marginBand(10, 0.2499)).toBe("thin");
    expect(marginBand(10, 0.25)).toBe("healthy");
  });
});

describe("break-even and retail suggestion", () => {
  it("finds the first quoted quantity that breaks even", () => {
    const rates = { firstCopyUsd: 20, additionalCopyUsd: 4 };
    const quotes = [1, 5, 10, 20].map((q) => ({ quantity: q, shippingUsd: flatShipping(rates, q)! }));
    expect(breakEvenCopies(FAY.wsp, FAY.srp, quotes)).toBe(20);
    expect(breakEvenCopies(FAY.wsp, FAY.srp, FAY_TO_NY)).toBeNull();
    expect(healthyCopies(FAY.wsp, FAY.srp, FAY_TO_NY)).toBeNull();
  });

  it("suggests the retail price that makes 10 copies Healthy, rounded up to 0.50", () => {
    // Approved banner: Issue 2 needs 34.50, Issue 1 (WSP 12, ships 81.41 + lighter) needs 27.50.
    expect(suggestHealthyRetail({ ...FAY, quantity: 10, shippingUsd: 81.41 })).toBe(34.5);
    const s = suggestHealthyRetail({ wsp: 12, srp: 17, quantity: 10, shippingUsd: 72.8 })!;
    expect(s % 0.5).toBe(0);
    const after = landedMargin({ wsp: 12, srp: s, quantity: 10, shippingUsd: 72.8 });
    expect(after.band).toBe("healthy");
    const below = landedMargin({ wsp: 12, srp: s - 0.5, quantity: 10, shippingUsd: 72.8 });
    expect(below.band).not.toBe("healthy");
  });

  it("returns null when the order is already Healthy", () => {
    expect(suggestHealthyRetail({ wsp: 10, srp: 20, quantity: 5, shippingUsd: 9.96 })).toBeNull();
  });
});

describe("minimums", () => {
  const fay = (quantity: number, moq: number | null = 1) => ({
    magazineId: "fay-2",
    title: "Fay",
    quantity,
    minimumOrderQuantity: moq,
  });

  it("blocks an international group below the publisher minimum", () => {
    const r = checkMinimums("international", 5, [fay(3)]);
    expect(r.ok).toBe(false);
    expect(r.intlShort).toBe(2);
    expect(r.intlMinimum).toBe(5);
  });

  it("counts copies across titles for the international minimum", () => {
    const r = checkMinimums("international", 5, [fay(3), { ...fay(2), magazineId: "fay-1" }]);
    expect(r.ok).toBe(true);
  });

  it("ignores the international minimum on domestic orders", () => {
    const r = checkMinimums("domestic", 5, [fay(1)]);
    expect(r.ok).toBe(true);
    expect(r.intlMinimum).toBeNull();
  });

  it("applies the per-title minimum on top of the international one", () => {
    const r = checkMinimums("international", 5, [fay(6, 10)]);
    expect(r.ok).toBe(false);
    expect(r.intlShort).toBe(0);
    expect(r.titleShortfalls).toEqual([{ magazineId: "fay-2", title: "Fay", minimum: 10, short: 4 }]);
    expect(checkMinimums("domestic", 5, [fay(2, 3)]).ok).toBe(false);
  });

  it("defaults the international minimum to 5", () => {
    expect(checkMinimums("international", null, [fay(4)]).intlShort).toBe(1);
  });

  it("works out the lowest quantity selectable on a title page", () => {
    expect(minimumSelectableQuantity({ zone: "international", minimumOrderQuantity: 1, intlMinCopies: 5, otherCopiesFromPublisher: 0 })).toBe(5);
    expect(minimumSelectableQuantity({ zone: "international", minimumOrderQuantity: 1, intlMinCopies: 5, otherCopiesFromPublisher: 3 })).toBe(2);
    expect(minimumSelectableQuantity({ zone: "international", minimumOrderQuantity: 4, intlMinCopies: 5, otherCopiesFromPublisher: 10 })).toBe(4);
    expect(minimumSelectableQuantity({ zone: "domestic", minimumOrderQuantity: 2, intlMinCopies: 5, otherCopiesFromPublisher: 0 })).toBe(2);
  });
});

describe("parcels and rates", () => {
  it("adds packaging and refuses to guess a missing weight", () => {
    const p = buildParcel([{ quantity: 5, weightGrams: 350, widthMm: 170, heightMm: 240 }], "auto")!;
    expect(p.packaging).toBe("padded_mailer");
    expect(p.weightGrams).toBe(1840);
    expect(buildParcel([{ quantity: 6, weightGrams: 350 }], "auto")!.packaging).toBe("box");
    expect(buildParcel([{ quantity: 1, weightGrams: null }], "auto")).toBeNull();
  });

  const rate = (id: string, amount: string, token = "colissimo_international", currency = "USD"): CarrierRate => ({
    object_id: id,
    amount,
    currency,
    provider: "Colissimo",
    servicelevel: { token, name: token },
  });

  it("picks the cheapest tracked USD rate", () => {
    const best = pickCheapestTrackedRate([
      rate("a", "60.00"),
      rate("b", "12.00", "la_poste_lettre_internationale"),
      rate("c", "57.69"),
      rate("d", "40.00", "x", "EUR"),
    ]);
    expect(best?.object_id).toBe("c");
    expect(pickCheapestTrackedRate([])).toBeNull();
  });

  it("builds a DDP customs declaration for FR to US", () => {
    const c = buildCustomsDeclaration({
      origin: "FR",
      destination: "US",
      signer: "FAY",
      lines: [{ quantity: 5, weightGrams: 350, wsp: 16 }],
    })!;
    expect(c.incoterm).toBe("DDP");
    expect(c.contents_type).toBe("MERCHANDISE");
    expect(c.non_delivery_option).toBe("RETURN");
    expect(c.items[0]).toMatchObject({ tariff_number: "490290", value_amount: "80.00", origin_country: "FR", quantity: 5 });
    expect(buildCustomsDeclaration({ origin: "FR", destination: "DE", signer: "x", lines: [] })).toBeNull();
    expect(buildCustomsDeclaration({ origin: "US", destination: "CA", signer: "x", lines: [] })!.incoterm).toBeUndefined();
  });

  it("builds stable keys", () => {
    expect(itemsKey([{ magazine_id: "b", quantity: 2 }, { magazine_id: "a", quantity: 1 }])).toBe("a:1,b:2");
    expect(rateCacheKey({ postal_code: "75011", country: "FR" }, { postal_code: "10030", country: "United States" }, 1840, "padded_mailer"))
      .toBe("FR|75011|US|10030|1840|padded_mailer");
  });
});
