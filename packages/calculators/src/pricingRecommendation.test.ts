import { recommendPricing } from './pricingRecommendation';
import { calculatePerRequestCost, calculateCostPerUser } from './unitEconomics';

const baseInput = {
  model: 'gpt-4' as const,
  avgInputTokens: 1000,
  avgOutputTokens: 500,
  requestsPerUser: 100,
  targetMargins: [50, 65, 80],
};

describe('recommendPricing', () => {
  it('should return correct cost per user', () => {
    const result = recommendPricing(baseInput);
    const expectedCostPerRequest = calculatePerRequestCost('gpt-4', 1000, 500);
    const expectedCostPerUser = calculateCostPerUser(expectedCostPerRequest, 100);
    expect(result.costPerUser).toBe(expectedCostPerUser);
  });

  it('should return tiers for each target margin', () => {
    const result = recommendPricing(baseInput);
    expect(result.tiers).toHaveLength(3);
  });

  it('should sort tiers by target margin ascending', () => {
    const result = recommendPricing({ ...baseInput, targetMargins: [80, 50, 65] });
    expect(result.tiers[0]!.targetMargin).toBe(50);
    expect(result.tiers[1]!.targetMargin).toBe(65);
    expect(result.tiers[2]!.targetMargin).toBe(80);
  });

  it('should calculate correct price for 80% margin', () => {
    const result = recommendPricing(baseInput);
    const tier80 = result.tiers.find((t) => t.targetMargin === 80);
    // price = costPerUser / (1 - 80/100) — use same formula as implementation
    const expected = Math.ceil((result.costPerUser / (1 - 80 / 100)) * 100) / 100;
    expect(tier80!.recommendedPrice).toBe(expected);
  });

  it('should calculate correct price for 50% margin', () => {
    const result = recommendPricing(baseInput);
    const tier50 = result.tiers.find((t) => t.targetMargin === 50);
    // price = costPerUser / (1 - 50/100) — use same formula as implementation
    const expected = Math.ceil((result.costPerUser / (1 - 50 / 100)) * 100) / 100;
    expect(tier50!.recommendedPrice).toBe(expected);
  });

  it('should ceil recommended price to nearest cent', () => {
    const result = recommendPricing(baseInput);
    for (const tier of result.tiers) {
      const decimals = tier.recommendedPrice.toString().split('.')[1];
      if (decimals) {
        expect(decimals.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('should assign correct risk levels', () => {
    const result = recommendPricing(baseInput);
    const tier50 = result.tiers.find((t) => t.targetMargin === 50);
    const tier65 = result.tiers.find((t) => t.targetMargin === 65);
    const tier80 = result.tiers.find((t) => t.targetMargin === 80);
    expect(tier50!.riskLevel).toBe('Medium');
    expect(tier65!.riskLevel).toBe('Medium');
    expect(tier80!.riskLevel).toBe('Low');
  });

  it('should throw for target margin >= 100', () => {
    expect(() =>
      recommendPricing({ ...baseInput, targetMargins: [100] }),
    ).toThrow('Target margin must be less than 100%');
  });

  it('should throw for negative target margin', () => {
    expect(() =>
      recommendPricing({ ...baseInput, targetMargins: [-5] }),
    ).toThrow('Target margin must be non-negative');
  });

  it('should work with gpt-4-mini model', () => {
    const result = recommendPricing({ ...baseInput, model: 'gpt-4-mini' });
    const gpt4Result = recommendPricing(baseInput);
    // gpt-4-mini is cheaper, so recommended prices should be lower
    expect(result.costPerUser).toBeLessThan(gpt4Result.costPerUser);
    expect(result.tiers[0]!.recommendedPrice).toBeLessThan(gpt4Result.tiers[0]!.recommendedPrice);
  });
});
