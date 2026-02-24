import { NotFoundException } from '@nestjs/common';
import { ScenarioService } from './scenario.service';
import { PrismaService } from '../prisma/prisma.service';

const mockScenario = {
  id: 'scenario-123',
  userId: 'user-123',
  name: 'Test Scenario',
  model: 'gpt-4',
  avgInputTokens: 1000,
  avgOutputTokens: 500,
  requestsPerUser: 100,
  projectedUsers: 1000,
  subscriptionPrice: 29,
  createdAt: new Date('2025-01-01'),
};

describe('ScenarioService', () => {
  let service: ScenarioService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      scenario: {
        create: jest.fn().mockResolvedValue(mockScenario),
        findUnique: jest.fn().mockResolvedValue(mockScenario),
      },
    } as unknown as PrismaService;

    service = new ScenarioService(prisma);
  });

  describe('create', () => {
    it('should create a scenario and attach financial results', async () => {
      const result = await service.create('user-123', {
        name: 'Test Scenario',
        model: 'gpt-4',
        avgInputTokens: 1000,
        avgOutputTokens: 500,
        requestsPerUser: 100,
        projectedUsers: 1000,
        subscriptionPrice: 29,
      });

      expect(result.id).toBe('scenario-123');
      expect(result.financialResult).toBeDefined();
      expect(result.financialResult.costPerRequest).toBeCloseTo(0.025, 4);
      expect(result.financialResult.costPerUser).toBeCloseTo(2.5, 4);
      expect(result.financialResult.monthlyCost).toBeCloseTo(2500, 2);
      expect(result.financialResult.grossMargin).toBeCloseTo(91.38, 1);
      expect(result.financialResult.riskLevel).toBe('Low');
    });

    it('should call prisma create with correct data', async () => {
      await service.create('user-123', {
        name: 'Test Scenario',
        model: 'gpt-4',
        avgInputTokens: 1000,
        avgOutputTokens: 500,
        requestsPerUser: 100,
        projectedUsers: 1000,
        subscriptionPrice: 29,
      });

      expect(prisma.scenario.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          name: 'Test Scenario',
          model: 'gpt-4',
          avgInputTokens: 1000,
          avgOutputTokens: 500,
          requestsPerUser: 100,
          projectedUsers: 1000,
          subscriptionPrice: 29,
        },
      });
    });
  });

  describe('findById', () => {
    it('should return scenario with financial results', async () => {
      const result = await service.findById('scenario-123');

      expect(result.id).toBe('scenario-123');
      expect(result.financialResult).toBeDefined();
      expect(result.financialResult.costPerRequest).toBeCloseTo(0.025, 4);
    });

    it('should throw NotFoundException for missing scenario', async () => {
      (prisma.scenario.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSimulations', () => {
    it('should return 4 architecture simulations', async () => {
      const results = await service.getSimulations('scenario-123');

      expect(results).toHaveLength(4);
      const names = results.map((r) => r.architectureName);
      expect(names).toContain('Full GPT-4');
      expect(names).toContain('GPT-4 Mini');
      expect(names).toContain('Hybrid (20% GPT-4, 80% Mini)');
      expect(names).toContain('RAG-style (GPT-4, 50% fewer input tokens)');
    });

    it('should return simulations sorted by highest margin', async () => {
      const results = await service.getSimulations('scenario-123');

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]!.grossMargin).toBeGreaterThanOrEqual(results[i + 1]!.grossMargin);
      }
    });

    it('should throw NotFoundException for missing scenario', async () => {
      (prisma.scenario.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getSimulations('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('runSensitivity', () => {
    it('should return sensitivity result with correct number of data points', async () => {
      const result = await service.runSensitivity('scenario-123', {
        parameter: 'projectedUsers',
        steps: 5,
        rangeMin: 100,
        rangeMax: 5000,
      });

      expect(result.parameter).toBe('projectedUsers');
      expect(result.dataPoints).toHaveLength(5);
    });

    it('should throw NotFoundException for missing scenario', async () => {
      (prisma.scenario.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.runSensitivity('nonexistent', {
          parameter: 'projectedUsers',
          steps: 5,
          rangeMin: 100,
          rangeMax: 5000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should pass scenario parameters to the calculator', async () => {
      const result = await service.runSensitivity('scenario-123', {
        parameter: 'subscriptionPrice',
        steps: 3,
        rangeMin: 10,
        rangeMax: 50,
      });

      expect(result.dataPoints).toHaveLength(3);
      expect(result.dataPoints[0]!.parameterValue).toBe(10);
      expect(result.dataPoints[2]!.parameterValue).toBe(50);
    });
  });

  describe('getPricingRecommendation', () => {
    it('should return 3 pricing tiers with default target margins', async () => {
      const result = await service.getPricingRecommendation('scenario-123');

      expect(result.tiers).toHaveLength(3);
      expect(result.tiers[0]!.targetMargin).toBe(50);
      expect(result.tiers[1]!.targetMargin).toBe(65);
      expect(result.tiers[2]!.targetMargin).toBe(80);
    });

    it('should return correct cost per user', async () => {
      const result = await service.getPricingRecommendation('scenario-123');

      // gpt-4: (1000/1000)*0.01 + (500/1000)*0.03 = 0.025 per request
      // costPerUser = 0.025 * 100 = 2.50
      expect(result.costPerUser).toBeCloseTo(2.5, 4);
    });

    it('should throw NotFoundException for missing scenario', async () => {
      (prisma.scenario.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getPricingRecommendation('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
