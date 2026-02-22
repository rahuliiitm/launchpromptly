import type { SimulationInput } from '@aiecon/types';
import { simulateArchitectures } from './architectureSimulator';

const DEFAULT_INPUT: SimulationInput = {
  avgInputTokens: 1000,
  avgOutputTokens: 500,
  requestsPerUser: 100,
  projectedUsers: 1000,
  subscriptionPrice: 29,
};

describe('architectureSimulator', () => {
  describe('simulateArchitectures', () => {
    it('should return exactly 4 architecture simulations', () => {
      const results = simulateArchitectures(DEFAULT_INPUT);
      expect(results).toHaveLength(4);
    });

    it('should include all 4 architecture names', () => {
      const results = simulateArchitectures(DEFAULT_INPUT);
      const names = results.map((r) => r.architectureName);
      expect(names).toContain('Full GPT-4');
      expect(names).toContain('GPT-4 Mini');
      expect(names).toContain('Hybrid (20% GPT-4, 80% Mini)');
      expect(names).toContain('RAG-style (GPT-4, 50% fewer input tokens)');
    });

    it('should sort results by highest margin first', () => {
      const results = simulateArchitectures(DEFAULT_INPUT);
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]!.grossMargin).toBeGreaterThanOrEqual(results[i + 1]!.grossMargin);
      }
    });

    it('should calculate Full GPT-4 correctly', () => {
      const results = simulateArchitectures(DEFAULT_INPUT);
      const gpt4 = results.find((r) => r.architectureName === 'Full GPT-4')!;

      // perRequestCost = (1000/1000)*0.01 + (500/1000)*0.03 = 0.01 + 0.015 = 0.025
      // costPerUser = 0.025 * 100 = 2.5
      // monthlyCost = 0.025 * 100 * 1000 = 2500
      // grossMargin = (29 - 2.5) / 29 * 100 = 91.38%
      expect(gpt4.costPerUser).toBeCloseTo(2.5, 4);
      expect(gpt4.monthlyCost).toBeCloseTo(2500, 2);
      expect(gpt4.grossMargin).toBeCloseTo(91.38, 1);
      expect(gpt4.riskLevel).toBe('Low');
    });

    it('should calculate GPT-4 Mini correctly', () => {
      const results = simulateArchitectures(DEFAULT_INPUT);
      const mini = results.find((r) => r.architectureName === 'GPT-4 Mini')!;

      // perRequestCost = (1000/1000)*0.002 + (500/1000)*0.006 = 0.002 + 0.003 = 0.005
      // costPerUser = 0.005 * 100 = 0.5
      // monthlyCost = 0.005 * 100 * 1000 = 500
      // grossMargin = (29 - 0.5) / 29 * 100 = 98.28%
      expect(mini.costPerUser).toBeCloseTo(0.5, 4);
      expect(mini.monthlyCost).toBeCloseTo(500, 2);
      expect(mini.grossMargin).toBeCloseTo(98.28, 1);
      expect(mini.riskLevel).toBe('Low');
    });

    it('should calculate Hybrid (20/80) correctly', () => {
      const results = simulateArchitectures(DEFAULT_INPUT);
      const hybrid = results.find((r) => r.architectureName === 'Hybrid (20% GPT-4, 80% Mini)')!;

      // gpt4Cost = 0.025, miniCost = 0.005
      // weightedCost = 0.025 * 0.2 + 0.005 * 0.8 = 0.005 + 0.004 = 0.009
      // costPerUser = 0.009 * 100 = 0.9
      // monthlyCost = 0.009 * 100 * 1000 = 900
      // grossMargin = (29 - 0.9) / 29 * 100 = 96.90%
      expect(hybrid.costPerUser).toBeCloseTo(0.9, 4);
      expect(hybrid.monthlyCost).toBeCloseTo(900, 2);
      expect(hybrid.grossMargin).toBeCloseTo(96.90, 1);
      expect(hybrid.riskLevel).toBe('Low');
    });

    it('should calculate RAG-style correctly (50% input reduction)', () => {
      const results = simulateArchitectures(DEFAULT_INPUT);
      const rag = results.find((r) => r.architectureName === 'RAG-style (GPT-4, 50% fewer input tokens)')!;

      // reducedInputTokens = floor(1000 * 0.5) = 500
      // perRequestCost = (500/1000)*0.01 + (500/1000)*0.03 = 0.005 + 0.015 = 0.02
      // costPerUser = 0.02 * 100 = 2.0
      // monthlyCost = 0.02 * 100 * 1000 = 2000
      // grossMargin = (29 - 2.0) / 29 * 100 = 93.10%
      expect(rag.costPerUser).toBeCloseTo(2.0, 4);
      expect(rag.monthlyCost).toBeCloseTo(2000, 2);
      expect(rag.grossMargin).toBeCloseTo(93.10, 1);
      expect(rag.riskLevel).toBe('Low');
    });

    it('should GPT-4 Mini always have highest margin', () => {
      const results = simulateArchitectures(DEFAULT_INPUT);
      expect(results[0]!.architectureName).toBe('GPT-4 Mini');
    });

    it('should Full GPT-4 always have lowest margin', () => {
      const results = simulateArchitectures(DEFAULT_INPUT);
      expect(results[results.length - 1]!.architectureName).toBe('Full GPT-4');
    });

    it('should handle zero tokens', () => {
      const results = simulateArchitectures({
        ...DEFAULT_INPUT,
        avgInputTokens: 0,
        avgOutputTokens: 0,
      });
      results.forEach((r) => {
        expect(r.costPerUser).toBe(0);
        expect(r.monthlyCost).toBe(0);
      });
    });

    it('should handle high user count (100k scale test)', () => {
      const results = simulateArchitectures({
        ...DEFAULT_INPUT,
        projectedUsers: 100000,
      });
      const gpt4 = results.find((r) => r.architectureName === 'Full GPT-4')!;
      expect(gpt4.monthlyCost).toBeCloseTo(250000, 0);
    });

    it('should assign correct risk levels with tight margins', () => {
      // Set subscription to $3 → GPT-4 cost per user = $2.50 → margin = 16.67% → High
      const results = simulateArchitectures({
        ...DEFAULT_INPUT,
        subscriptionPrice: 3,
      });
      const gpt4 = results.find((r) => r.architectureName === 'Full GPT-4')!;
      expect(gpt4.riskLevel).toBe('High');
    });

    it('should have each result contain all required fields', () => {
      const results = simulateArchitectures(DEFAULT_INPUT);
      results.forEach((r) => {
        expect(r).toHaveProperty('architectureName');
        expect(r).toHaveProperty('costPerUser');
        expect(r).toHaveProperty('monthlyCost');
        expect(r).toHaveProperty('grossMargin');
        expect(r).toHaveProperty('riskLevel');
        expect(typeof r.architectureName).toBe('string');
        expect(typeof r.costPerUser).toBe('number');
        expect(typeof r.monthlyCost).toBe('number');
        expect(typeof r.grossMargin).toBe('number');
        expect(['Low', 'Medium', 'High']).toContain(r.riskLevel);
      });
    });
  });
});
