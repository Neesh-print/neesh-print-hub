import { describe, it, expect, vi } from "vitest";
import {
  carrierPrepaysDuties,
  dutiesPaidFor,
  pickCheapestTrackedRate,
  senderPrepaysDuties,
  usdAmount,
  type CarrierRate,
} from "./shipping";
import { createShippoClient, withUsdPrices, ShippoError, type ShippoShipment } from "../../supabase/functions/_shared/shippo.ts";

// Real Shippo responses from Oct 27, 2026 (ids shortened).
// photoED, Toronto to New York, 5 copies (2,515 g): CAD with USD alongside.
const CA_TO_US: CarrierRate[] = [
  {
    object_id: "xpresspost", amount: "47.96", currency: "CAD", amount_local: "34.14", currency_local: "USD",
    provider: "Canada Post", servicelevel: { name: "Xpresspost USA", token: "canada_post_xpresspost_usa" }, estimated_days: 2,
  },
  {
    object_id: "expedited", amount: "31.01", currency: "CAD", amount_local: "22.07", currency_local: "USD",
    provider: "Canada Post", servicelevel: { name: "Expedited Parcel USA", token: "canada_post_expedited_parcel_usa" }, estimated_days: 3,
  },
];

// Good Sport, Berlin to Berlin: EUR only, no USD price at all.
const DE_TO_DE: CarrierRate[] = [
  {
    object_id: "maxibrief", amount: "5.10", currency: "EUR", amount_local: "5.10", currency_local: "EUR",
    provider: "Deutsche Post", servicelevel: { name: "Maxibrief Plus", token: "deutsche_post_maxibrief_plus" },
  },
  {
    object_id: "dpd", amount: "4.88", currency: "EUR", amount_local: "4.88", currency_local: "EUR",
    provider: "DPD DE", servicelevel: { name: "DPD Classic", token: "dpd_de_classic" }, estimated_days: 2,
  },
];

// The same two rates re-requested from Shippo in USD.
const DE_TO_DE_IN_USD: CarrierRate[] = [
  { ...DE_TO_DE[0], amount_local: "5.68", currency_local: "USD" },
  { ...DE_TO_DE[1], amount_local: "5.43", currency_local: "USD" },
];

const courier = (token: string, provider: string, amount: string): CarrierRate => ({
  object_id: token, amount, currency: "USD", provider, servicelevel: { name: token, token },
});

describe("USD prices", () => {
  it("reads the USD price from whichever field holds it", () => {
    expect(usdAmount(courier("ups_standard", "UPS", "41.50"))).toBe(41.5);
    expect(usdAmount(CA_TO_US[1])).toBe(22.07);
    expect(usdAmount(DE_TO_DE[1])).toBeNull();
    expect(usdAmount(DE_TO_DE_IN_USD[1])).toBe(5.43);
  });

  it("picks the cheapest rate by its USD price, not its own currency", () => {
    expect(pickCheapestTrackedRate(CA_TO_US)?.object_id).toBe("expedited");
    expect(pickCheapestTrackedRate(DE_TO_DE)).toBeNull();
    expect(pickCheapestTrackedRate(DE_TO_DE_IN_USD)?.object_id).toBe("dpd");
  });

  it("lets a postal rate beat a courier on price", () => {
    const best = pickCheapestTrackedRate([courier("ups_standard", "UPS", "41.50"), ...CA_TO_US]);
    expect(best?.object_id).toBe("expedited");
    const cheaperCourier = pickCheapestTrackedRate([courier("ups_standard", "UPS", "19.00"), ...CA_TO_US]);
    expect(cheaperCourier?.object_id).toBe("ups_standard");
  });
});

describe("duties", () => {
  it("knows which carriers clear US customs for the sender", () => {
    expect(carrierPrepaysDuties(courier("ups_standard", "UPS", "1"))).toBe(true);
    expect(carrierPrepaysDuties(courier("fedex_international_economy", "FedEx", "1"))).toBe(true);
    expect(carrierPrepaysDuties(courier("dhl_express_worldwide", "DHL Express", "1"))).toBe(true);
    expect(carrierPrepaysDuties(CA_TO_US[1])).toBe(false);
    expect(carrierPrepaysDuties(courier("dhl_ecommerce_parcel", "DHL eCommerce", "1"))).toBe(false);
  });

  it("says duties paid only for a courier carrying a parcel into the US from abroad", () => {
    const ups = courier("ups_standard", "UPS", "1");
    expect(dutiesPaidFor("CA", "US", ups)).toBe(true);
    expect(dutiesPaidFor("CA", "US", CA_TO_US[1])).toBe(false);
    expect(dutiesPaidFor("US", "CA", ups)).toBe(false);
    expect(dutiesPaidFor("CA", "CA", ups)).toBe(false);
    expect(dutiesPaidFor(null, "US", ups)).toBe(false);
  });

  it("tells the publisher to prepay when nobody else does", () => {
    expect(senderPrepaysDuties("CA", "US", false)).toBe(true);
    expect(senderPrepaysDuties("CA", "US", true)).toBe(false);
    expect(senderPrepaysDuties("US", "CA", false)).toBe(false);
    expect(senderPrepaysDuties("DE", "FR", false)).toBe(false);
    expect(senderPrepaysDuties(null, "US", false)).toBe(false);
  });
});

describe("withUsdPrices", () => {
  const shipment = (rates: CarrierRate[]): ShippoShipment => ({ object_id: "shp_1", status: "SUCCESS", rates });

  it("doesn't call Shippo again when every rate already has a USD price", async () => {
    const ratesInCurrency = vi.fn();
    expect(await withUsdPrices({ ratesInCurrency }, shipment(CA_TO_US))).toEqual(CA_TO_US);
    expect(ratesInCurrency).not.toHaveBeenCalled();
  });

  it("re-prices EUR-only rates in USD, keeping the same rate ids", async () => {
    const ratesInCurrency = vi.fn().mockResolvedValue(DE_TO_DE_IN_USD);
    const rates = await withUsdPrices({ ratesInCurrency }, shipment(DE_TO_DE));
    expect(ratesInCurrency).toHaveBeenCalledWith("shp_1", "USD");
    expect(rates.map((r) => [r.object_id, usdAmount(r)])).toEqual([["maxibrief", 5.68], ["dpd", 5.43]]);
  });

  it("treats a conversion that never finished as a slow Shippo, not as no rate", async () => {
    const ratesInCurrency = vi.fn().mockResolvedValue([]);
    await expect(withUsdPrices({ ratesInCurrency }, shipment(DE_TO_DE))).rejects.toBeInstanceOf(ShippoError);
  });

  it("passes a failed conversion on as a Shippo error, not as no rate", async () => {
    const ratesInCurrency = vi.fn().mockRejectedValue(new ShippoError("down", 503, null));
    await expect(withUsdPrices({ ratesInCurrency }, shipment(DE_TO_DE))).rejects.toBeInstanceOf(ShippoError);
  });
});

describe("Shippo ratesInCurrency", () => {
  const response = (results: CarrierRate[]) => new Response(JSON.stringify({ results }), { status: 200 });

  it("waits for the re-queued shipment to return converted rates", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(DE_TO_DE_IN_USD));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createShippoClient("shippo_test_key", fetchImpl as unknown as typeof fetch, sleep);

    const rates = await client.ratesInCurrency("shp_1", "USD");
    expect(rates).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.goshippo.com/shipments/shp_1/rates/USD?results=100");
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("gives up after about 3 seconds and returns no rates", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => response([]));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createShippoClient("shippo_test_key", fetchImpl as unknown as typeof fetch, sleep);

    expect(await client.ratesInCurrency("shp_1", "USD")).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([300, 600, 900, 1200]);
  });
});
