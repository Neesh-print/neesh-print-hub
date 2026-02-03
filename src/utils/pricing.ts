export const calculateRetailerPrice = (wholesalePrice: number): number => {
  // Add 10% markup and ensure we return a clean number rounded to 2 decimal places
  // This avoids floating point errors like 10.10000000004
  return Number((wholesalePrice * 1.10).toFixed(2));
};
