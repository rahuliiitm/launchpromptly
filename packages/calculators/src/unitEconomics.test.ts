import {
  MODEL_PRICING,
  getSupportedModels,
  calculatePerRequestCost,
  calculateMonthlyCost,
  calculateCostPerUser,
  calculateGrossMargin,
  calculateBreakEven,
  assessRisk,
} from './unitEconomics';

describe('unitEconomics', () => {
  describe('MODEL_PRICING', () => {
    it('should contain gpt-4 pricing', () => {
      expect(MODEL_PRICING['gpt-4']).toEqual({ input: 0.01, output: 0.03 });
    });

    it('should contain gpt-4-mini pricing', () => {
      expect(MODEL_PRICING['gpt-4-mini']).toEqual({ input: 0.002, output: 0.006 });
    });
  });

  describe('getSupportedModels', () => {
    it('should return all model keys', () => {
      const models = getSupportedModels();
      expect(models).toContain('gpt-4');
      expect(models).toContain('gpt-4-mini');
    });
  });

  describe('calculatePerRequestCost', () => {
    it('should calculate GPT-4 cost correctly', () => {
      // 1000 input tokens at $0.01/1k = $0.01
      // 500 output tokens at $0.03/1k = $0.015
      const cost = calculatePerRequestCost('gpt-4', 1000, 500);
      expect(cost).toBeCloseTo(0.025, 6);
    });

    it('should calculate GPT-4 Mini cost correctly', () => {
      // 1000 input tokens at $0.002/1k = $0.002
      // 500 output tokens at $0.006/1k = $0.003
      const cost = calculatePerRequestCost('gpt-4-mini', 1000, 500);
      expect(cost).toBeCloseTo(0.005, 6);
    });

    it('should return 0 for zero tokens', () => {
      const cost = calculatePerRequestCost('gpt-4', 0, 0);
      expect(cost).toBe(0);
    });

    it('should handle input-only requests', () => {
      const cost = calculatePerRequestCost('gpt-4', 2000, 0);
      expect(cost).toBeCloseTo(0.02, 6);
    });

    it('should handle output-only requests', () => {
      const cost = calculatePerRequestCost('gpt-4', 0, 2000);
      expect(cost).toBeCloseTo(0.06, 6);
    });

    it('should throw for unknown model', () => {
      expect(() => calculatePerRequestCost('unknown-model', 100, 100)).toThrow(
        'Unknown model: unknown-model',
      );
    });
  });

  describe('calculateMonthlyCost', () => {
    it('should calculate total monthly cost', () => {
      // $0.025 per request × 100 requests × 1000 users = $2500
      const cost = calculateMonthlyCost(0.025, 100, 1000);
      expect(cost).toBeCloseTo(2500, 2);
    });

    it('should return 0 with zero users', () => {
      const cost = calculateMonthlyCost(0.025, 100, 0);
      expect(cost).toBe(0);
    });

    it('should return 0 with zero requests', () => {
      const cost = calculateMonthlyCost(0.025, 0, 1000);
      expect(cost).toBe(0);
    });
  });

  describe('calculateCostPerUser', () => {
    it('should calculate cost per user per month', () => {
      // $0.025 per request × 100 requests = $2.50 per user
      const cost = calculateCostPerUser(0.025, 100);
      expect(cost).toBeCloseTo(2.5, 4);
    });

    it('should return 0 with zero requests', () => {
      const cost = calculateCostPerUser(0.025, 0);
      expect(cost).toBe(0);
    });
  });

  describe('calculateGrossMargin', () => {
    it('should calculate positive margin', () => {
      // ($29 - $2.50) / $29 = 91.38%
      const margin = calculateGrossMargin(29, 2.5);
      expect(margin).toBeCloseTo(91.38, 1);
    });

    it('should return 0 for zero subscription price', () => {
      const margin = calculateGrossMargin(0, 2.5);
      expect(margin).toBe(0);
    });

    it('should return negative margin when cost exceeds price', () => {
      const margin = calculateGrossMargin(10, 15);
      expect(margin).toBe(-50);
    });

    it('should return 100% when cost is zero', () => {
      const margin = calculateGrossMargin(29, 0);
      expect(margin).toBe(100);
    });

    it('should return exactly 75% at boundary', () => {
      // (100 - 25) / 100 = 75%
      const margin = calculateGrossMargin(100, 25);
      expect(margin).toBe(75);
    });

    it('should return exactly 50% at boundary', () => {
      // (100 - 50) / 100 = 50%
      const margin = calculateGrossMargin(100, 50);
      expect(margin).toBe(50);
    });
  });

  describe('calculateBreakEven', () => {
    it('should return 0 when fixedCost is 0 (v1 default)', () => {
      const breakEven = calculateBreakEven(29, 2.5);
      expect(breakEven).toBe(0);
    });

    it('should calculate break-even with fixed cost', () => {
      // $5000 fixed / ($29 - $2.50) margin = 188.68 → ceil to 189
      const breakEven = calculateBreakEven(29, 2.5, 5000);
      expect(breakEven).toBe(189);
    });

    it('should return 0 when cost exceeds price (no break-even possible)', () => {
      const breakEven = calculateBreakEven(10, 15, 5000);
      expect(breakEven).toBe(0);
    });

    it('should return 0 when cost equals price', () => {
      const breakEven = calculateBreakEven(10, 10, 5000);
      expect(breakEven).toBe(0);
    });
  });

  describe('assessRisk', () => {
    it('should return Low for margin > 75%', () => {
      expect(assessRisk(80)).toBe('Low');
      expect(assessRisk(100)).toBe('Low');
      expect(assessRisk(75.01)).toBe('Low');
    });

    it('should return Medium for margin 50-75%', () => {
      expect(assessRisk(75)).toBe('Medium');
      expect(assessRisk(60)).toBe('Medium');
      expect(assessRisk(50)).toBe('Medium');
    });

    it('should return High for margin < 50%', () => {
      expect(assessRisk(49.99)).toBe('High');
      expect(assessRisk(0)).toBe('High');
      expect(assessRisk(-10)).toBe('High');
    });
  });
});
