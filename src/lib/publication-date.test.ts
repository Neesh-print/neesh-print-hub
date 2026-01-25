import { describe, it, expect } from "vitest";
import {
  formatPublicationDate,
  createPublicationDate,
  parsePublicationDate,
  isCurrentMonth,
  isWithinMonths,
} from "./publication-date";

describe("formatPublicationDate", () => {
  it("formats date in long format", () => {
    expect(formatPublicationDate("2025-12-01", "long")).toBe("December 2025");
    expect(formatPublicationDate("2025-01-01", "long")).toBe("January 2025");
  });

  it("formats date in short format", () => {
    expect(formatPublicationDate("2025-12-01", "short")).toBe("Dec 2025");
    expect(formatPublicationDate("2025-01-01", "short")).toBe("Jan 2025");
  });

  it("returns null for null input", () => {
    expect(formatPublicationDate(null)).toBeNull();
  });

  it("returns null for invalid date string", () => {
    expect(formatPublicationDate("invalid-date")).toBeNull();
  });

  it("handles Date objects", () => {
    const date = new Date("2025-06-15");
    expect(formatPublicationDate(date, "long")).toBe("June 2025");
  });
});

describe("createPublicationDate", () => {
  it("creates ISO date string for first of month", () => {
    expect(createPublicationDate(12, 2025)).toBe("2025-12-01");
    expect(createPublicationDate(1, 2025)).toBe("2025-01-01");
    expect(createPublicationDate(6, 2024)).toBe("2024-06-01");
  });

  it("pads single-digit months with zero", () => {
    expect(createPublicationDate(1, 2025)).toBe("2025-01-01");
    expect(createPublicationDate(9, 2025)).toBe("2025-09-01");
  });

  it("throws for invalid month", () => {
    expect(() => createPublicationDate(0, 2025)).toThrow("Invalid month");
    expect(() => createPublicationDate(13, 2025)).toThrow("Invalid month");
  });

  it("throws for invalid year", () => {
    expect(() => createPublicationDate(1, 1800)).toThrow("Invalid year");
    expect(() => createPublicationDate(1, 2200)).toThrow("Invalid year");
  });
});

describe("parsePublicationDate", () => {
  it("extracts month and year from date string", () => {
    expect(parsePublicationDate("2025-12-01")).toEqual({ month: 12, year: 2025 });
    expect(parsePublicationDate("2025-01-01")).toEqual({ month: 1, year: 2025 });
    expect(parsePublicationDate("2024-06-15")).toEqual({ month: 6, year: 2024 });
  });

  it("returns nulls for null input", () => {
    expect(parsePublicationDate(null)).toEqual({ month: null, year: null });
  });

  it("returns nulls for invalid date", () => {
    expect(parsePublicationDate("invalid")).toEqual({ month: null, year: null });
  });
});

describe("isCurrentMonth", () => {
  it("returns false for null", () => {
    expect(isCurrentMonth(null)).toBe(false);
  });

  it("returns true for current month", () => {
    const now = new Date();
    const currentMonthDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    expect(isCurrentMonth(currentMonthDate)).toBe(true);
  });

  it("returns false for past month", () => {
    expect(isCurrentMonth("2020-01-01")).toBe(false);
  });
});

describe("isWithinMonths", () => {
  it("returns false for null", () => {
    expect(isWithinMonths(null, 3)).toBe(false);
  });

  it("returns true for recent dates", () => {
    const now = new Date();
    const recentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    expect(isWithinMonths(recentDate, 3)).toBe(true);
  });

  it("returns false for old dates", () => {
    expect(isWithinMonths("2020-01-01", 3)).toBe(false);
  });
});
