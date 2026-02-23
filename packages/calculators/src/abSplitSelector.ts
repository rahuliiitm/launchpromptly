import { createHash } from 'crypto';

export interface SplitVariant {
  id: string;
  trafficPercent: number;
}

/**
 * Deterministically selects a variant based on a hash key (e.g. customerId+slug).
 * Maps hash → 0-99 → cumulative traffic ranges.
 */
export function selectVariant(variants: SplitVariant[], hashKey: string): string {
  if (variants.length === 0) {
    throw new Error('variants array must not be empty');
  }

  const totalPercent = variants.reduce((sum, v) => sum + v.trafficPercent, 0);
  if (totalPercent !== 100) {
    throw new Error(`Traffic percentages must sum to 100, got ${totalPercent}`);
  }

  const hash = createHash('sha256').update(hashKey).digest();
  const bucket = (hash[0]! * 256 + hash[1]!) % 100; // 0-99

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.trafficPercent;
    if (bucket < cumulative) {
      return variant.id;
    }
  }

  // Fallback to last variant (shouldn't happen if percentages sum to 100)
  return variants[variants.length - 1]!.id;
}
