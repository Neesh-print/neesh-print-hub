import { describe, it, expect } from 'vitest';
import { 
  getStockLevel, 
  getStockMessage, 
  isUrgentStock, 
  isInStock,
  STOCK_THRESHOLDS 
} from './inventory';

describe('getStockLevel', () => {
  it('returns "out" for 0', () => {
    expect(getStockLevel(0)).toBe('out');
  });

  it('returns "out" for null', () => {
    expect(getStockLevel(null)).toBe('out');
  });

  it('returns "out" for undefined', () => {
    expect(getStockLevel(undefined)).toBe('out');
  });

  it('returns "out" for negative numbers', () => {
    expect(getStockLevel(-5)).toBe('out');
  });

  it('returns "critical" for 1-5 (boundary: 1)', () => {
    expect(getStockLevel(1)).toBe('critical');
  });

  it('returns "critical" for 1-5 (boundary: 5)', () => {
    expect(getStockLevel(5)).toBe('critical');
  });

  it('returns "low" for 6-15 (boundary: 6)', () => {
    expect(getStockLevel(6)).toBe('low');
  });

  it('returns "low" for 6-15 (boundary: 15)', () => {
    expect(getStockLevel(15)).toBe('low');
  });

  it('returns "normal" for 16+', () => {
    expect(getStockLevel(16)).toBe('normal');
  });

  it('returns "normal" for large quantities', () => {
    expect(getStockLevel(500)).toBe('normal');
  });
});

describe('getStockMessage', () => {
  it('returns "Out of stock" for 0', () => {
    expect(getStockMessage(0)).toBe('Out of stock');
  });

  it('returns "Only X left" for critical stock', () => {
    expect(getStockMessage(3)).toBe('Only 3 left');
  });

  it('returns "Only 1 left" for singular (edge case)', () => {
    expect(getStockMessage(1)).toBe('Only 1 left');
  });

  it('returns "X in stock" for low stock', () => {
    expect(getStockMessage(12)).toBe('12 in stock');
  });

  it('returns null for normal stock', () => {
    expect(getStockMessage(50)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getStockMessage(null)).toBe('Out of stock');
  });
});

describe('isUrgentStock', () => {
  it('returns true for out of stock', () => {
    expect(isUrgentStock(0)).toBe(true);
  });

  it('returns true for critical stock', () => {
    expect(isUrgentStock(3)).toBe(true);
  });

  it('returns false for low stock', () => {
    expect(isUrgentStock(10)).toBe(false);
  });

  it('returns false for normal stock', () => {
    expect(isUrgentStock(100)).toBe(false);
  });
});

describe('isInStock', () => {
  it('returns false for 0', () => {
    expect(isInStock(0)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isInStock(null)).toBe(false);
  });

  it('returns true for any positive quantity', () => {
    expect(isInStock(1)).toBe(true);
    expect(isInStock(5)).toBe(true);
    expect(isInStock(15)).toBe(true);
    expect(isInStock(100)).toBe(true);
  });
});

describe('STOCK_THRESHOLDS', () => {
  it('has correct threshold values', () => {
    expect(STOCK_THRESHOLDS.CRITICAL).toBe(5);
    expect(STOCK_THRESHOLDS.LOW).toBe(15);
  });
});
