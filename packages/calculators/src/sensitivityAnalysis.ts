import type { SensitivityInput, SensitivityResult, SensitivityDataPoint } from '@aiecon/types';
import {
  calculatePerRequestCost,
  calculateCostPerUser,
  calculateMonthlyCost,
  calculateGrossMargin,
  assessRisk,
} from './unitEconomics';

/**
 * Run sensitivity analysis by varying one parameter across a range
 * while holding all others constant.
 *
 * @param input - base scenario, parameter to vary, range, and step count
 * @returns parameter name and array of data points showing how metrics change
 * @throws Error if steps < 2 or rangeMin >= rangeMax
 */
export function runSensitivityAnalysis(input: SensitivityInput): SensitivityResult {
  const { baseScenario, model, parameter, steps, rangeMin, rangeMax } = input;

  if (steps < 2) {
    throw new Error('Sensitivity analysis requires at least 2 steps');
  }
  if (rangeMin >= rangeMax) {
    throw new Error('rangeMin must be less than rangeMax');
  }

  const stepSize = (rangeMax - rangeMin) / (steps - 1);
  const dataPoints: SensitivityDataPoint[] = [];

  for (let i = 0; i < steps; i++) {
    const parameterValue = rangeMin + stepSize * i;
    const scenario = { ...baseScenario, [parameter]: parameterValue };

    const costPerRequest = calculatePerRequestCost(
      model,
      scenario.avgInputTokens,
      scenario.avgOutputTokens,
    );
    const costPerUser = calculateCostPerUser(costPerRequest, scenario.requestsPerUser);
    const monthlyCost = calculateMonthlyCost(
      costPerRequest,
      scenario.requestsPerUser,
      scenario.projectedUsers,
    );
    const grossMargin = calculateGrossMargin(scenario.subscriptionPrice, costPerUser);
    const riskLevel = assessRisk(grossMargin);

    dataPoints.push({
      parameterValue,
      costPerRequest,
      costPerUser,
      monthlyCost,
      grossMargin,
      riskLevel,
    });
  }

  return { parameter, dataPoints };
}
