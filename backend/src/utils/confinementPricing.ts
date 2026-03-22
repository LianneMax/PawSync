export function calculateConfinementDailyPrice(basePrice: number, weightKg?: number | null): number {
  const safeBasePrice = Number.isFinite(basePrice) ? Math.max(0, basePrice) : 0;
  const safeWeight = Number.isFinite(weightKg as number) ? (weightKg as number) : 0;

  if (safeWeight <= 5) return safeBasePrice;

  const extraBrackets = Math.ceil((safeWeight - 5) / 5);
  return safeBasePrice + extraBrackets * 250;
}
