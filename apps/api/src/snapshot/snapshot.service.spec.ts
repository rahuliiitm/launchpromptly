import { NotFoundException } from '@nestjs/common';
import { SnapshotService } from './snapshot.service';
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

const mockSnapshot = {
  id: 'snapshot-1',
  scenarioId: 'scenario-123',
  label: 'Q1 Plan',
  model: 'gpt-4',
  avgInputTokens: 1000,
  avgOutputTokens: 500,
  requestsPerUser: 100,
  projectedUsers: 1000,
  subscriptionPrice: 29,
  createdAt: new Date('2025-01-01'),
};

const mockSnapshot2 = {
  id: 'snapshot-2',
  scenarioId: 'scenario-123',
  label: 'Aggressive Pricing',
  model: 'gpt-4',
  avgInputTokens: 1000,
  avgOutputTokens: 500,
  requestsPerUser: 100,
  projectedUsers: 2000,
  subscriptionPrice: 19,
  createdAt: new Date('2025-01-02'),
};

describe('SnapshotService', () => {
  let service: SnapshotService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      scenario: {
        findUnique: jest.fn().mockResolvedValue(mockScenario),
      },
      snapshot: {
        create: jest.fn().mockResolvedValue(mockSnapshot),
        findMany: jest.fn().mockResolvedValue([mockSnapshot, mockSnapshot2]),
      },
    } as unknown as PrismaService;

    service = new SnapshotService(prisma);
  });

  describe('create', () => {
    it('should copy scenario parameters into snapshot with financials', async () => {
      const result = await service.create('scenario-123', { label: 'Q1 Plan' });

      expect(result.id).toBe('snapshot-1');
      expect(result.label).toBe('Q1 Plan');
      expect(result.financialResult).toBeDefined();
      expect(result.financialResult.costPerRequest).toBeCloseTo(0.025, 4);
      expect(result.financialResult.riskLevel).toBe('Low');
    });

    it('should throw NotFoundException for missing scenario', async () => {
      (prisma.scenario.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create('nonexistent', { label: 'test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listByScenario', () => {
    it('should return all snapshots with financials', async () => {
      const result = await service.listByScenario('scenario-123');

      expect(result).toHaveLength(2);
      expect(result[0]!.financialResult).toBeDefined();
      expect(result[1]!.financialResult).toBeDefined();
    });

    it('should throw NotFoundException for missing scenario', async () => {
      (prisma.scenario.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.listByScenario('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('compare', () => {
    it('should return financials for each snapshot', async () => {
      const result = await service.compare(['snapshot-1', 'snapshot-2']);

      expect(result.snapshots).toHaveLength(2);
      expect(result.snapshots[0]!.financialResult.costPerRequest).toBeCloseTo(0.025, 4);
    });

    it('should throw NotFoundException if any snapshot is missing', async () => {
      (prisma.snapshot.findMany as jest.Mock).mockResolvedValue([mockSnapshot]);

      await expect(
        service.compare(['snapshot-1', 'nonexistent']),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
