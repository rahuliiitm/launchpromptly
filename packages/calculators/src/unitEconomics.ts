import type { ModelPricing, RiskLevel } from '@aiecon/types';

/**
 * Centralized model pricing configuration.
 * Prices are per 1,000 tokens.
 * Single source of truth — no duplication allowed.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI GPT-4o family
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  // Legacy GPT-4 (backward compat with existing scenarios)
  'gpt-4': { input: 0.01, output: 0.03 },
  'gpt-4-mini': { input: 0.002, output: 0.006 },
  // GPT-4 Turbo
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  // GPT-3.5
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  // Reasoning models
  'o1': { input: 0.015, output: 0.06 },
  'o1-mini': { input: 0.003, output: 0.012 },
  'o3-mini': { input: 0.0011, output: 0.0044 },
  // Anthropic Claude
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-5-haiku-latest': { input: 0.0008, output: 0.004 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
};

export function getSupportedModels(): string[] {
  return Object.keys(MODEL_PRICING);
}

/**
 * Calculate cost for a single API request.
 * @param model - Model identifier (must exist in MODEL_PRICING)
 * @param inputTokens - Average input tokens per request
 * @param outputTokens - Average output tokens per request
 * @returns Cost per request in dollars
 * @throws Error if model is not found in pricing map
 */
export function calculatePerRequestCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    throw new Error(`Unknown model: ${model}. Supported models: ${getSupportedModels().join(', ')}`);
  }

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Calculate total monthly AI cost across all users.
 */
export function calculateMonthlyCost(
  perRequestCost: number,
  requestsPerUser: number,
  projectedUsers: number,
): number {
  return perRequestCost * requestsPerUser * projectedUsers;
}

/**
 * Calculate AI cost per user per month.
 */
export function calculateCostPerUser(
  perRequestCost: number,
  requestsPerUser: number,
): number {
  return perRequestCost * requestsPerUser;
}

/**
 * Calculate gross margin percentage.
 * @returns Margin as a percentage (0-100 scale). Returns 0 if subscriptionPrice is 0.
 */
export function calculateGrossMargin(
  subscriptionPrice: number,
  costPerUser: number,
): number {
  if (subscriptionPrice === 0) {
    return 0;
  }
  return ((subscriptionPrice - costPerUser) / subscriptionPrice) * 100;
}

/**
 * Calculate break-even number of users.
 * @param fixedCost - Fixed monthly cost (defaults to 0 in v1)
 * @returns Number of users needed to break even. Returns 0 if margin per user is <= 0.
 */
export function calculateBreakEven(
  subscriptionPrice: number,
  costPerUser: number,
  fixedCost: number = 0,
): number {
  const marginPerUser = subscriptionPrice - costPerUser;
  if (marginPerUser <= 0) {
    return 0;
  }
  return Math.ceil(fixedCost / marginPerUser);
}

/**
 * Assess risk level based on gross margin percentage.
 * Margin > 75% → Low risk
 * 50–75% → Medium risk
 * < 50% → High risk
 */
export function assessRisk(marginPercent: number): RiskLevel {
  if (marginPercent > 75) {
    return 'Low';
  }
  if (marginPercent >= 50) {
    return 'Medium';
  }
  return 'High';
}
