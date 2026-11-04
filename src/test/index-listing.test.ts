import { describe, expect, it } from "vitest";
import {
  diff,
  imageType,
  parseNiches,
  parsePublisher,
  parseTitle,
} from "../../supabase/functions/_shared/index-listing";

const A = "7d9f2c3e-1b2a-4c5d-8e9f-0a1b2c3d4e5f";
const B = "8d9f2c3e-1b2a-4c5d-8e9f-0a1b2c3d4e5f";
const C = "9d9f2c3e-1b2a-4c5d-8e9f-0a1b2c3d4e5f";
const D = "0d9f2c3e-1b2a-4c5d-8e9f-0a1b2c3d4e5f";
const I = "1d9f2c3e-1b2a-4c5d-8e9f-0a1b2c3d4e5f";
const vocab = [A, B, C, D].map((id) => ({ id, category: "subject" })).concat([{ id: I, category: "identity" }]);

const title = {
  name: "  Cake Zine ",
  description: "",
  frequency: "biannual",
  cover_price: "",
  currency: "",
  trim_size: "",
  page_count: "120",
  country: "gb",
  city: "London",
  status: "active",
  last_issue_date: "",
  subscribe_url: "cakezine.com/subscribe",
};

describe("Index listing edits", () => {
  it("clears blanks, coerces numbers and adds a scheme to links", () => {
    const r = parseTitle(title);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      name: "Cake Zine",
      description: null,
      page_count: 120,
      country: "GB",
      subscribe_url: "https://cakezine.com/subscribe",
      cover_price: null,
    });
  });

  it("rejects bad titles with a plain message", () => {
    expect(parseTitle({ ...title, cover_price: "18" })).toEqual({ ok: false, error: "Add the currency for the cover price." });
    expect(parseTitle({ ...title, cover_price: "18", currency: "gbp" }).ok).toBe(true);
    expect(parseTitle({ ...title, status: "removed" }).ok).toBe(false);
    expect(parseTitle({ ...title, name: "  " }).ok).toBe(false);
    expect(parseTitle({ ...title, subscribe_url: "javascript:alert(1)" }).ok).toBe(false);
    expect(parseTitle({ ...title, last_issue_date: "2026-13-40" }).ok).toBe(false);
  });

  it("validates publisher details", () => {
    expect(parsePublisher({ name: "Noble Rot", website: "", city: "", country: "", stockist_page_url: "" }).ok).toBe(true);
    expect(parsePublisher({ name: "X", country: "Britain" }).ok).toBe(false);
  });

  it("keeps niches to the vocabulary: one main, up to two more, identity tags apart", () => {
    expect(parseNiches({ primary: A, others: [A, B], identity: [I] }, vocab)).toEqual({
      ok: true,
      value: { primary: A, others: [B], identity: [I] },
    });
    expect(parseNiches({ primary: "", others: [] }, vocab).ok).toBe(false);
    expect(parseNiches({ primary: I, others: [] }, vocab).ok).toBe(false);
    expect(parseNiches({ primary: A, others: [B, C, D] }, vocab).ok).toBe(false);
    expect(parseNiches({ primary: A, others: [], identity: [B] }, vocab).ok).toBe(false);
  });

  it("reports only changed fields", () => {
    expect(diff({ a: 1, b: "x", c: null }, { a: "1", b: "y", c: null })).toEqual({ b: { from: "x", to: "y" } });
  });

  it("recognises cover images by their bytes", () => {
    expect(imageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(imageType(new TextEncoder().encode("RIFF____WEBPVP8 "))?.ext).toBe("webp");
    expect(imageType(new TextEncoder().encode("<svg onload=x>"))).toBeNull();
  });
});
