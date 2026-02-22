import type { SensitivityInput } from '@aiecon/types';
import { runSensitivityAnalysis } from './sensitivityAnalysis';

const baseScenario = {
  avgInputTokens: 1000,
  avgOutputTokens: 500,
  requestsPerUser: 100,
  projectedUsers: 1000,
  subscriptionPrice: 29.99,
};

const defaultInput: SensitivityInput = {
  baseScenario,
  model: 'gpt-4',
  parameter: 'projectedUsers',
  steps: 5,
  rangeMin: 100,
  rangeMax: 5000,
};

describe('runSensitivityAnalysis', () => {
  it('should return correct number of data points equal to steps', () => {
    const result = runSensitivityAnalysis(defaultInput);
    expect(result.dataPoints).toHaveLength(5);
  });

  it('should return the parameter name in the result', () => {
    const result = runSensitivityAnalysis(defaultInput);
    expect(result.parameter).toBe('projectedUsers');
  });

  it('should have first data point at rangeMin', () => {
    const result = runSensitivityAnalysis(defaultInput);
    expect(result.dataPoints[0]?.parameterValue).toBe(100);
  });

  it('should have last data point at rangeMax', () => {
    const result = runSensitivityAnalysis(defaultInput);
    expect(result.dataPoints[4]?.parameterValue).toBe(5000);
  });

  it('should produce data points in ascending order', () => {
    const result = runSensitivityAnalysis(defaultInput);
    for (let i = 1; i < result.dataPoints.length; i++) {
      expect(result.dataPoints[i]!.parameterValue).toBeGreaterThan(
        result.dataPoints[i - 1]!.parameterValue,
      );
    }
  });

  it('varying projectedUsers should not change costPerRequest or costPerUser', () => {
    const result = runSensitivityAnalysis(defaultInput);
    const firstCostPerRequest = result.dataPoints[0]!.costPerRequest;
    const firstCostPerUser = result.dataPoints[0]!.costPerUser;
    for (const dp of result.dataPoints) {
      expect(dp.costPerRequest).toBe(firstCostPerRequest);
      expect(dp.costPerUser).toBe(firstCostPerUser);
    }
  });

  it('varying projectedUsers should change monthlyCost', () => {
    const result = runSensitivityAnalysis(defaultInput);
    const monthlyCosts = result.dataPoints.map((dp) => dp.monthlyCost);
    const unique = new Set(monthlyCosts);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('varying subscriptionPrice should not change cost metrics', () => {
    const result = runSensitivityAnalysis({
      ...defaultInput,
      parameter: 'subscriptionPrice',
      rangeMin: 10,
      rangeMax: 100,
    });
    const firstCostPerRequest = result.dataPoints[0]!.costPerRequest;
    const firstCostPerUser = result.dataPoints[0]!.costPerUser;
    const firstMonthlyCost = result.dataPoints[0]!.monthlyCost;
    for (const dp of result.dataPoints) {
      expect(dp.costPerRequest).toBe(firstCostPerRequest);
      expect(dp.costPerUser).toBe(firstCostPerUser);
      expect(dp.monthlyCost).toBe(firstMonthlyCost);
    }
  });

  it('varying subscriptionPrice should change grossMargin', () => {
    const result = runSensitivityAnalysis({
      ...defaultInput,
      parameter: 'subscriptionPrice',
      rangeMin: 10,
      rangeMax: 100,
    });
    const margins = result.dataPoints.map((dp) => dp.grossMargin);
    const unique = new Set(margins);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('varying avgInputTokens should change costPerRequest and costPerUser', () => {
    const result = runSensitivityAnalysis({
      ...defaultInput,
      parameter: 'avgInputTokens',
      rangeMin: 100,
      rangeMax: 5000,
    });
    const costs = result.dataPoints.map((dp) => dp.costPerRequest);
    const unique = new Set(costs);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('should throw for steps < 2', () => {
    expect(() =>
      runSensitivityAnalysis({ ...defaultInput, steps: 1 }),
    ).toThrow('Sensitivity analysis requires at least 2 steps');
  });

  it('should throw for rangeMin >= rangeMax', () => {
    expect(() =>
      runSensitivityAnalysis({ ...defaultInput, rangeMin: 100, rangeMax: 100 }),
    ).toThrow('rangeMin must be less than rangeMax');

    expect(() =>
      runSensitivityAnalysis({ ...defaultInput, rangeMin: 200, rangeMax: 100 }),
    ).toThrow('rangeMin must be less than rangeMax');
  });

  it('should assign correct risk levels based on margin thresholds', () => {
    const result = runSensitivityAnalysis({
      ...defaultInput,
      parameter: 'subscriptionPrice',
      rangeMin: 1,
      rangeMax: 100,
      steps: 10,
    });
    for (const dp of result.dataPoints) {
      if (dp.grossMargin > 75) {
        expect(dp.riskLevel).toBe('Low');
      } else if (dp.grossMargin >= 50) {
        expect(dp.riskLevel).toBe('Medium');
      } else {
        expect(dp.riskLevel).toBe('High');
      }
    }
  });
});
