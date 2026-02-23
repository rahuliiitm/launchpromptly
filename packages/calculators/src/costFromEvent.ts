import type { LLMProvider } from '@aiecon/types';
import { MODEL_PRICING } from './unitEconomics';

/**
 * Calculate cost in USD from a live LLM event.
 * Returns 0 if the model is not in the pricing table (graceful fallback).
 */
export function calculateEventCost(
  _provider: LLMProvider,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}
