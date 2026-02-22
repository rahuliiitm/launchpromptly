import type { SimulationInput, SimulationResult } from '@aiecon/types';
import {
  calculatePerRequestCost,
  calculateCostPerUser,
  calculateMonthlyCost,
  calculateGrossMargin,
  assessRisk,
} from './unitEconomics';

/**
 * Simulate multiple architecture strategies and return results sorted by highest margin.
 * All calculations reuse unitEconomics functions — no duplication.
 *
 * Architectures:
 * 1. Full GPT-4 — uses gpt-4 pricing as-is
 * 2. GPT-4 Mini — uses gpt-4-mini pricing as-is
 * 3. Hybrid (20/80) — 20% GPT-4 + 80% GPT-4 Mini weighted cost
 * 4. RAG-style — GPT-4 with input tokens reduced by 50%
 */
export function simulateArchitectures(input: SimulationInput): SimulationResult[] {
  const { avgInputTokens, avgOutputTokens, requestsPerUser, projectedUsers, subscriptionPrice } = input;

  const results: SimulationResult[] = [
    buildSimulation('Full GPT-4', 'gpt-4', avgInputTokens, avgOutputTokens, requestsPerUser, projectedUsers, subscriptionPrice),
    buildSimulation('GPT-4 Mini', 'gpt-4-mini', avgInputTokens, avgOutputTokens, requestsPerUser, projectedUsers, subscriptionPrice),
    buildHybridSimulation(avgInputTokens, avgOutputTokens, requestsPerUser, projectedUsers, subscriptionPrice),
    buildRagSimulation(avgInputTokens, avgOutputTokens, requestsPerUser, projectedUsers, subscriptionPrice),
  ];

  return results.sort((a, b) => b.grossMargin - a.grossMargin);
}

function buildSimulation(
  architectureName: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  requestsPerUser: number,
  projectedUsers: number,
  subscriptionPrice: number,
): SimulationResult {
  const perRequestCost = calculatePerRequestCost(model, inputTokens, outputTokens);
  const costPerUser = calculateCostPerUser(perRequestCost, requestsPerUser);
  const monthlyCost = calculateMonthlyCost(perRequestCost, requestsPerUser, projectedUsers);
  const grossMargin = calculateGrossMargin(subscriptionPrice, costPerUser);
  const riskLevel = assessRisk(grossMargin);

  return { architectureName, costPerUser, monthlyCost, grossMargin, riskLevel };
}

/**
 * Hybrid fallback: 20% GPT-4, 80% GPT-4 Mini (weighted average cost per request).
 */
function buildHybridSimulation(
  inputTokens: number,
  outputTokens: number,
  requestsPerUser: number,
  projectedUsers: number,
  subscriptionPrice: number,
): SimulationResult {
  const gpt4Cost = calculatePerRequestCost('gpt-4', inputTokens, outputTokens);
  const miniCost = calculatePerRequestCost('gpt-4-mini', inputTokens, outputTokens);
  const weightedCost = gpt4Cost * 0.2 + miniCost * 0.8;

  const costPerUser = calculateCostPerUser(weightedCost, requestsPerUser);
  const monthlyCost = calculateMonthlyCost(weightedCost, requestsPerUser, projectedUsers);
  const grossMargin = calculateGrossMargin(subscriptionPrice, costPerUser);
  const riskLevel = assessRisk(grossMargin);

  return {
    architectureName: 'Hybrid (20% GPT-4, 80% Mini)',
    costPerUser,
    monthlyCost,
    grossMargin,
    riskLevel,
  };
}

/**
 * RAG-style: GPT-4 with input tokens reduced by 50% (retrieval augmented generation).
 */
function buildRagSimulation(
  inputTokens: number,
  outputTokens: number,
  requestsPerUser: number,
  projectedUsers: number,
  subscriptionPrice: number,
): SimulationResult {
  const reducedInputTokens = Math.floor(inputTokens * 0.5);
  return buildSimulation(
    'RAG-style (GPT-4, 50% fewer input tokens)',
    'gpt-4',
    reducedInputTokens,
    outputTokens,
    requestsPerUser,
    projectedUsers,
    subscriptionPrice,
  );
}
