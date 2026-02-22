import type {
  PricingRecommendationInput,
  PricingRecommendationResult,
  PricingTier,
} from '@aiecon/types';
import { calculatePerRequestCost, calculateCostPerUser, assessRisk } from './unitEconomics';

/**
 * Recommend subscription prices for given target margins.
 *
 * Formula: price = costPerUser / (1 - targetMargin / 100)
 * Example: costPerUser = $2.50, target 80% → price = 2.50 / 0.20 = $12.50
 *
 * @param input - model, token counts, requests per user, and target margin percentages
 * @returns base cost per user and array of pricing tiers sorted by margin ascending
 * @throws Error if any target margin is >= 100 or < 0
 */
export function recommendPricing(
  input: PricingRecommendationInput,
): PricingRecommendationResult {
  const { model, avgInputTokens, avgOutputTokens, requestsPerUser, targetMargins } = input;

  const costPerRequest = calculatePerRequestCost(model, avgInputTokens, avgOutputTokens);
  const costPerUser = calculateCostPerUser(costPerRequest, requestsPerUser);

  const tiers: PricingTier[] = targetMargins.map((targetMargin) => {
    if (targetMargin >= 100) {
      throw new Error('Target margin must be less than 100%');
    }
    if (targetMargin < 0) {
      throw new Error('Target margin must be non-negative');
    }

    const recommendedPrice = costPerUser / (1 - targetMargin / 100);
    const riskLevel = assessRisk(targetMargin);

    return {
      targetMargin,
      recommendedPrice: Math.ceil(recommendedPrice * 100) / 100,
      costPerUser,
      riskLevel,
    };
  });

  tiers.sort((a, b) => a.targetMargin - b.targetMargin);

  return { costPerUser, tiers };
}
