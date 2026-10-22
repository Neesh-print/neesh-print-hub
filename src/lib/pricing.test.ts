import { describe, it, expect } from "vitest";
import {
  NEESH_SPACE_MULTIPLIER,
  formatPrice,
  calculateEffectiveCost,
  calculateMarginPerUnit,
  calculateMarginPercentage,
  calculateTotalMargin,
  calculateLineTotal,
  isLowStock,
  isOutOfStock,
} from "./pricing";

describe("pricing utilities", () => {
  describe("NEESH_SPACE_MULTIPLIER", () => {
    it("should be 1.10 (10% on top for spaces)", () => {
      expect(NEESH_SPACE_MULTIPLIER).toBe(1.10);
    });
  });

  describe("formatPrice", () => {
    it("should format dollars to currency string", () => {
      expect(formatPrice(14.00)).toBe("$14.00");
      expect(formatPrice(0)).toBe("$0.00");
      expect(formatPrice(1234.56)).toBe("$1,234.56");
    });

    it("should round to 2 decimal places", () => {
      expect(formatPrice(14.999)).toBe("$15.00");
      expect(formatPrice(14.001)).toBe("$14.00");
    });
  });

  describe("calculateEffectiveCost", () => {
    it("should calculate WSP × 1.10 × quantity", () => {
      expect(calculateEffectiveCost(10, 1)).toBeCloseTo(11, 2);
      expect(calculateEffectiveCost(10, 2)).toBeCloseTo(22, 2);
      expect(calculateEffectiveCost(14, 1)).toBeCloseTo(15.4, 2);
    });

    it("should default quantity to 1", () => {
      expect(calculateEffectiveCost(10)).toBeCloseTo(11, 2);
    });

    it("should return 0 for invalid inputs", () => {
      expect(calculateEffectiveCost(0, 1)).toBe(0);
      expect(calculateEffectiveCost(-5, 1)).toBe(0);
    });
  });

  describe("calculateMarginPerUnit", () => {
    it("should calculate MSRP - (WSP × 1.10)", () => {
      // WSP $14, MSRP $28 → 28 - (14 × 1.10) = 28 - 15.40 = 12.60
      expect(calculateMarginPerUnit(14, 28)).toBeCloseTo(12.60, 2);
    });

    it("should return 0 for invalid inputs", () => {
      expect(calculateMarginPerUnit(0, 28)).toBe(0);
      expect(calculateMarginPerUnit(14, 0)).toBe(0);
    });

    it("should handle negative margins", () => {
      // WSP $20, MSRP $20 → 20 - (20 × 1.10) = 20 - 22 = -2
      expect(calculateMarginPerUnit(20, 20)).toBeCloseTo(-2, 2);
    });
  });

  describe("calculateMarginPercentage", () => {
    it("should calculate (margin / MSRP) × 100", () => {
      // WSP $14, MSRP $28 → margin $12.60, percentage = (12.60 / 28) × 100 = 45%
      expect(calculateMarginPercentage(14, 28)).toBeCloseTo(45, 5);
    });

    it("should return 0 for invalid retail price", () => {
      expect(calculateMarginPercentage(14, 0)).toBe(0);
    });
  });

  describe("calculateTotalMargin", () => {
    it("should multiply margin per unit by quantity", () => {
      // Margin per unit = $12.60, quantity 3 → $37.80
      expect(calculateTotalMargin(14, 28, 3)).toBeCloseTo(37.80, 2);
    });
  });

  describe("calculateLineTotal", () => {
    it("should calculate WSP × quantity", () => {
      expect(calculateLineTotal(14, 1)).toBe(14);
      expect(calculateLineTotal(14, 3)).toBe(42);
    });

    it("should round to 2 decimal places", () => {
      // 14.99 × 3 = 44.97
      expect(calculateLineTotal(14.99, 3)).toBe(44.97);
    });

    it("should return 0 for invalid inputs", () => {
      expect(calculateLineTotal(0, 1)).toBe(0);
      expect(calculateLineTotal(14, 0)).toBe(0);
      expect(calculateLineTotal(-5, 1)).toBe(0);
    });
  });

  describe("isLowStock", () => {
    it("should return true for stock 1-5", () => {
      expect(isLowStock(1)).toBe(true);
      expect(isLowStock(5)).toBe(true);
    });

    it("should return false for stock > 5", () => {
      expect(isLowStock(6)).toBe(false);
      expect(isLowStock(100)).toBe(false);
    });

    it("should return false for 0 or null", () => {
      expect(isLowStock(0)).toBe(false);
      expect(isLowStock(null)).toBe(false);
      expect(isLowStock(undefined)).toBe(false);
    });
  });

  describe("isOutOfStock", () => {
    it("should return true for stock 0 or negative", () => {
      expect(isOutOfStock(0)).toBe(true);
      expect(isOutOfStock(-1)).toBe(true);
    });

    it("should return false for stock > 0", () => {
      expect(isOutOfStock(1)).toBe(false);
      expect(isOutOfStock(100)).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(isOutOfStock(null)).toBe(false);
      expect(isOutOfStock(undefined)).toBe(false);
    });
  });
});
