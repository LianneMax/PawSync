import { calculateConfinementDailyPrice } from '../utils/confinementPricing';

describe('calculateConfinementDailyPrice', () => {
  it('uses base price for weights <= 5kg', () => {
    expect(calculateConfinementDailyPrice(2000, 4.7)).toBe(2000);
    expect(calculateConfinementDailyPrice(2000, 5)).toBe(2000);
  });

  it('adds +250 for first >5kg bracket', () => {
    expect(calculateConfinementDailyPrice(2000, 6)).toBe(2250);
    expect(calculateConfinementDailyPrice(2000, 10)).toBe(2250);
  });

  it('adds +500 for 10-15kg range', () => {
    expect(calculateConfinementDailyPrice(2000, 11)).toBe(2500);
    expect(calculateConfinementDailyPrice(2000, 15)).toBe(2500);
  });

  it('falls back to base price when weight is missing/invalid', () => {
    expect(calculateConfinementDailyPrice(2000, undefined)).toBe(2000);
    expect(calculateConfinementDailyPrice(2000, null)).toBe(2000);
    expect(calculateConfinementDailyPrice(2000, Number.NaN)).toBe(2000);
  });
});
