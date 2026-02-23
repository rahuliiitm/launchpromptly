import { Test, TestingModule } from '@nestjs/testing';
import { PromptService } from './prompt.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

describe('PromptService', () => {
  let service: PromptService;

  const mockPrisma = {
    managedPrompt: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    promptVersion: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    promptTemplate: {
      findUnique: jest.fn(),
    },
    aBTest: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    lLMEvent: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockProjectService = {
    assertProjectAccess: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProjectService, useValue: mockProjectService },
      ],
    }).compile();

    service = module.get<PromptService>(PromptService);
    jest.clearAllMocks();
  });

  // ── createPrompt ──

  describe('createPrompt', () => {
    it('should create a ManagedPrompt with correct slug and projectId', async () => {
      const prompt = { id: 'p1', projectId: 'proj1', slug: 'hello-world', name: 'Hello World' };
      mockPrisma.managedPrompt.create.mockResolvedValue(prompt);

      const result = await service.createPrompt('proj1', 'user1', {
        slug: 'hello-world',
        name: 'Hello World',
      } as any);

      expect(result).toEqual(prompt);
      expect(mockPrisma.managedPrompt.create).toHaveBeenCalledWith({
        data: { projectId: 'proj1', slug: 'hello-world', name: 'Hello World', description: '' },
      });
    });

    it('should reject duplicate slug with ConflictException', async () => {
      mockPrisma.managedPrompt.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.createPrompt('proj1', 'user1', {
          slug: 'duplicate',
          name: 'Dup',
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should create initial version (v1) when initialContent is provided', async () => {
      const prompt = { id: 'p1', projectId: 'proj1', slug: 'with-content', name: 'Test' };
      const version = { id: 'v1', managedPromptId: 'p1', version: 1, content: 'Hello', status: 'draft' };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          managedPrompt: { create: jest.fn().mockResolvedValue(prompt) },
          promptVersion: { create: jest.fn().mockResolvedValue(version) },
        };
        return fn(tx);
      });

      const result = await service.createPrompt('proj1', 'user1', {
        slug: 'with-content',
        name: 'Test',
        initialContent: 'Hello',
      } as any);

      expect(result).toEqual({ ...prompt, versions: [version] });
    });

    it('should call assertProjectAccess', async () => {
      mockPrisma.managedPrompt.create.mockResolvedValue({ id: 'p1' });
      await service.createPrompt('proj1', 'user1', { slug: 'test', name: 'Test' } as any);
      expect(mockProjectService.assertProjectAccess).toHaveBeenCalledWith('proj1', 'user1');
    });
  });

  // ── listPrompts ──

  describe('listPrompts', () => {
    it('should return prompts with version counts', async () => {
      const prompts = [
        { id: 'p1', slug: 'a', _count: { versions: 2 }, versions: [{ status: 'active' }] },
      ];
      mockPrisma.managedPrompt.findMany.mockResolvedValue(prompts);

      const result = await service.listPrompts('proj1', 'user1');
      expect(result).toEqual(prompts);
    });

    it('should return empty array for project with no prompts', async () => {
      mockPrisma.managedPrompt.findMany.mockResolvedValue([]);
      const result = await service.listPrompts('proj1', 'user1');
      expect(result).toEqual([]);
    });

    it('should call assertProjectAccess', async () => {
      mockPrisma.managedPrompt.findMany.mockResolvedValue([]);
      await service.listPrompts('proj1', 'user1');
      expect(mockProjectService.assertProjectAccess).toHaveBeenCalledWith('proj1', 'user1');
    });
  });

  // ── getPrompt ──

  describe('getPrompt', () => {
    it('should return prompt with versions ordered by version desc', async () => {
      const prompt = {
        id: 'p1',
        versions: [
          { version: 3, status: 'draft' },
          { version: 2, status: 'active' },
          { version: 1, status: 'archived' },
        ],
      };
      mockPrisma.managedPrompt.findFirst.mockResolvedValue(prompt);

      const result = await service.getPrompt('proj1', 'p1', 'user1');
      expect(result.versions[0].version).toBe(3);
    });

    it('should throw NotFoundException for missing prompt', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue(null);
      await expect(service.getPrompt('proj1', 'bad-id', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updatePrompt ──

  describe('updatePrompt', () => {
    it('should update name and description', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.managedPrompt.update.mockResolvedValue({ id: 'p1', name: 'Updated' });

      const result = await service.updatePrompt('proj1', 'p1', 'user1', {
        name: 'Updated',
      } as any);
      expect(result.name).toBe('Updated');
    });

    it('should reject slug collision with ConflictException', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.managedPrompt.update.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.updatePrompt('proj1', 'p1', 'user1', { slug: 'taken' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── deletePrompt ──

  describe('deletePrompt', () => {
    it('should cascade-delete prompt and versions', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.managedPrompt.delete.mockResolvedValue({ id: 'p1' });

      const result = await service.deletePrompt('proj1', 'p1', 'user1');
      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.managedPrompt.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
  });

  // ── createVersion ──

  describe('createVersion', () => {
    it('should auto-increment version number', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.promptVersion.aggregate.mockResolvedValue({ _max: { version: 3 } });
      mockPrisma.promptVersion.create.mockResolvedValue({ version: 4, status: 'draft' });

      const result = await service.createVersion('proj1', 'p1', 'user1', {
        content: 'New content',
      } as any);
      expect(result.version).toBe(4);
      expect(mockPrisma.promptVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: 4 }) }),
      );
    });

    it('should default status to draft', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.promptVersion.aggregate.mockResolvedValue({ _max: { version: null } });
      mockPrisma.promptVersion.create.mockResolvedValue({ version: 1, status: 'draft' });

      const result = await service.createVersion('proj1', 'p1', 'user1', {
        content: 'Hello',
      } as any);
      expect(result.status).toBe('draft');
    });

    it('should throw NotFoundException for non-existent prompt', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue(null);

      await expect(
        service.createVersion('proj1', 'bad-id', 'user1', { content: 'Hi' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deployVersion ──

  describe('deployVersion', () => {
    it('should set active and archive previous active version', async () => {
      mockPrisma.promptVersion.findFirst.mockResolvedValue({
        id: 'v2',
        managedPromptId: 'p1',
        status: 'draft',
      });

      const deployed = { id: 'v2', status: 'active' };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          promptVersion: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            update: jest.fn().mockResolvedValue(deployed),
          },
        };
        return fn(tx);
      });

      const result = await service.deployVersion('proj1', 'p1', 'v2', 'user1');
      expect(result.status).toBe('active');
    });

    it('should work when no version is currently active', async () => {
      mockPrisma.promptVersion.findFirst.mockResolvedValue({
        id: 'v1',
        managedPromptId: 'p1',
        status: 'draft',
      });

      const deployed = { id: 'v1', status: 'active' };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          promptVersion: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            update: jest.fn().mockResolvedValue(deployed),
          },
        };
        return fn(tx);
      });

      const result = await service.deployVersion('proj1', 'p1', 'v1', 'user1');
      expect(result.status).toBe('active');
    });

    it('should throw BadRequestException when version is already active', async () => {
      mockPrisma.promptVersion.findFirst.mockResolvedValue({
        id: 'v1',
        status: 'active',
      });

      await expect(service.deployVersion('proj1', 'p1', 'v1', 'user1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for non-existent version', async () => {
      mockPrisma.promptVersion.findFirst.mockResolvedValue(null);

      await expect(service.deployVersion('proj1', 'p1', 'bad-id', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── rollbackVersion ──

  describe('rollbackVersion', () => {
    it('should re-activate most recent archived version', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.promptVersion.findFirst.mockResolvedValue({
        id: 'v1',
        status: 'archived',
      });

      const activated = { id: 'v1', status: 'active' };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          promptVersion: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            update: jest.fn().mockResolvedValue(activated),
          },
        };
        return fn(tx);
      });

      const result = await service.rollbackVersion('proj1', 'p1', 'user1');
      expect(result.status).toBe('active');
    });

    it('should throw BadRequestException when no archived versions exist', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.promptVersion.findFirst.mockResolvedValue(null);

      await expect(service.rollbackVersion('proj1', 'p1', 'user1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── promoteTemplate ──

  describe('promoteTemplate', () => {
    it('should create ManagedPrompt + v1 from PromptTemplate', async () => {
      mockPrisma.promptTemplate.findUnique.mockResolvedValue({
        id: 't1',
        normalizedContent: 'You are helpful',
      });

      const prompt = { id: 'p1', slug: 'helper', name: 'Helper' };
      const version = { id: 'v1', version: 1, content: 'You are helpful', status: 'draft' };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          managedPrompt: { create: jest.fn().mockResolvedValue(prompt) },
          promptVersion: { create: jest.fn().mockResolvedValue(version) },
        };
        return fn(tx);
      });

      const result = await service.promoteTemplate('proj1', 'hash123', 'user1', 'helper', 'Helper');
      expect(result).toEqual({ ...prompt, versions: [version] });
    });

    it('should throw NotFoundException for missing template hash', async () => {
      mockPrisma.promptTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.promoteTemplate('proj1', 'bad-hash', 'user1', 'slug', 'Name'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate slug', async () => {
      mockPrisma.promptTemplate.findUnique.mockResolvedValue({
        id: 't1',
        normalizedContent: 'content',
      });
      mockPrisma.$transaction.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.promoteTemplate('proj1', 'hash1', 'user1', 'taken', 'Name'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── resolvePrompt ──

  describe('resolvePrompt', () => {
    it('should return active version content for slug', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({
        id: 'p1',
        slug: 'my-prompt',
        abTests: [],
        versions: [{ id: 'v2', version: 2, content: 'Active content', status: 'active' }],
      });

      const result = await service.resolvePrompt('proj1', 'my-prompt');
      expect(result.content).toBe('Active content');
      expect(result.managedPromptId).toBe('p1');
      expect(result.promptVersionId).toBe('v2');
      expect(result.version).toBe(2);
    });

    it('should return 404 for unknown slug', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue(null);
      await expect(service.resolvePrompt('proj1', 'unknown')).rejects.toThrow(NotFoundException);
    });

    it('should return 404 when no active version exists', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({
        id: 'p1',
        abTests: [],
        versions: [],
      });
      await expect(service.resolvePrompt('proj1', 'no-active')).rejects.toThrow(NotFoundException);
    });

    it('should select A/B variant deterministically with customerId', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({
        id: 'p1',
        slug: 'ab-prompt',
        abTests: [
          {
            status: 'running',
            variants: [
              { id: 'var1', trafficPercent: 50, promptVersionId: 'v1', promptVersion: { id: 'v1', version: 1, content: 'Version A' } },
              { id: 'var2', trafficPercent: 50, promptVersionId: 'v2', promptVersion: { id: 'v2', version: 2, content: 'Version B' } },
            ],
          },
        ],
        versions: [{ id: 'v1', version: 1, content: 'Version A', status: 'active' }],
      });

      const r1 = await service.resolvePrompt('proj1', 'ab-prompt', 'customer-42');
      const r2 = await service.resolvePrompt('proj1', 'ab-prompt', 'customer-42');
      expect(r1.promptVersionId).toBe(r2.promptVersionId); // deterministic
    });

    it('should use active version when no A/B test is running', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({
        id: 'p1',
        abTests: [],
        versions: [{ id: 'v3', version: 3, content: 'Latest active', status: 'active' }],
      });

      const result = await service.resolvePrompt('proj1', 'no-ab');
      expect(result.content).toBe('Latest active');
    });
  });

  // ── createABTest ──

  describe('createABTest', () => {
    const validDto = {
      name: 'Test A vs B',
      variants: [
        { promptVersionId: 'v1', trafficPercent: 50 },
        { promptVersionId: 'v2', trafficPercent: 50 },
      ],
    };

    it('should create A/B test with variants', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.promptVersion.findFirst
        .mockResolvedValueOnce({ id: 'v1', managedPromptId: 'p1' })
        .mockResolvedValueOnce({ id: 'v2', managedPromptId: 'p1' });
      mockPrisma.aBTest.findFirst.mockResolvedValue(null); // no running test
      mockPrisma.aBTest.create.mockResolvedValue({
        id: 'ab1',
        name: 'Test A vs B',
        status: 'draft',
        variants: [
          { id: 'var1', promptVersionId: 'v1', trafficPercent: 50 },
          { id: 'var2', promptVersionId: 'v2', trafficPercent: 50 },
        ],
      });

      const result = await service.createABTest('proj1', 'p1', 'user1', validDto as any);
      expect(result.status).toBe('draft');
      expect(result.variants).toHaveLength(2);
    });

    it('should reject when percentages do not sum to 100', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({ id: 'p1' });

      const badDto = {
        name: 'Bad split',
        variants: [
          { promptVersionId: 'v1', trafficPercent: 60 },
          { promptVersionId: 'v2', trafficPercent: 60 },
        ],
      };

      await expect(
        service.createABTest('proj1', 'p1', 'user1', badDto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-existent version reference', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.promptVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.createABTest('proj1', 'p1', 'user1', validDto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when another test is already running', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.promptVersion.findFirst
        .mockResolvedValueOnce({ id: 'v1', managedPromptId: 'p1' })
        .mockResolvedValueOnce({ id: 'v2', managedPromptId: 'p1' });
      mockPrisma.aBTest.findFirst.mockResolvedValue({ id: 'existing-test', status: 'running' });

      await expect(
        service.createABTest('proj1', 'p1', 'user1', validDto as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── startABTest ──

  describe('startABTest', () => {
    it('should set status to running and startedAt', async () => {
      mockPrisma.aBTest.findFirst
        .mockResolvedValueOnce({ id: 'ab1', managedPromptId: 'p1', status: 'draft' })
        .mockResolvedValueOnce(null); // no other running test
      mockPrisma.aBTest.update.mockResolvedValue({
        id: 'ab1',
        status: 'running',
        startedAt: new Date(),
        variants: [],
      });

      const result = await service.startABTest('proj1', 'p1', 'ab1', 'user1');
      expect(result.status).toBe('running');
      expect(result.startedAt).toBeDefined();
    });

    it('should throw BadRequestException if test is not in draft status', async () => {
      mockPrisma.aBTest.findFirst.mockResolvedValue({
        id: 'ab1',
        managedPromptId: 'p1',
        status: 'completed',
      });

      await expect(
        service.startABTest('proj1', 'p1', 'ab1', 'user1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── stopABTest ──

  describe('stopABTest', () => {
    it('should set status to completed and completedAt', async () => {
      mockPrisma.aBTest.findFirst.mockResolvedValue({
        id: 'ab1',
        managedPromptId: 'p1',
        status: 'running',
      });
      mockPrisma.aBTest.update.mockResolvedValue({
        id: 'ab1',
        status: 'completed',
        completedAt: new Date(),
        variants: [],
      });

      const result = await service.stopABTest('proj1', 'p1', 'ab1', 'user1');
      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();
    });

    it('should throw BadRequestException if test is not running', async () => {
      mockPrisma.aBTest.findFirst.mockResolvedValue({
        id: 'ab1',
        managedPromptId: 'p1',
        status: 'draft',
      });

      await expect(
        service.stopABTest('proj1', 'p1', 'ab1', 'user1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getABTestResults ──

  describe('getABTestResults', () => {
    it('should aggregate events per variant', async () => {
      mockPrisma.aBTest.findFirst.mockResolvedValue({
        id: 'ab1',
        managedPromptId: 'p1',
        status: 'completed',
        startedAt: new Date('2025-01-01'),
        completedAt: new Date('2025-01-31'),
        variants: [
          {
            id: 'var1',
            promptVersionId: 'v1',
            trafficPercent: 50,
            promptVersion: { version: 1 },
          },
          {
            id: 'var2',
            promptVersionId: 'v2',
            trafficPercent: 50,
            promptVersion: { version: 2 },
          },
        ],
      });
      mockPrisma.lLMEvent.aggregate
        .mockResolvedValueOnce({
          _count: 100,
          _sum: { costUsd: 5.0 },
          _avg: { latencyMs: 200, costUsd: 0.05 },
        })
        .mockResolvedValueOnce({
          _count: 80,
          _sum: { costUsd: 3.0 },
          _avg: { latencyMs: 150, costUsd: 0.0375 },
        });

      const result = await service.getABTestResults('proj1', 'p1', 'ab1', 'user1');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].callCount).toBe(100);
      expect(result.results[0].totalCostUsd).toBe(5.0);
      expect(result.results[1].callCount).toBe(80);
      expect(result.results[1].avgLatencyMs).toBe(150);
    });

    it('should return zero counts for variants with no events', async () => {
      mockPrisma.aBTest.findFirst.mockResolvedValue({
        id: 'ab1',
        managedPromptId: 'p1',
        status: 'running',
        startedAt: new Date(),
        completedAt: null,
        variants: [
          {
            id: 'var1',
            promptVersionId: 'v1',
            trafficPercent: 100,
            promptVersion: { version: 1 },
          },
        ],
      });
      mockPrisma.lLMEvent.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { costUsd: null },
        _avg: { latencyMs: null, costUsd: null },
      });

      const result = await service.getABTestResults('proj1', 'p1', 'ab1', 'user1');
      expect(result.results[0].callCount).toBe(0);
      expect(result.results[0].totalCostUsd).toBe(0);
      expect(result.results[0].avgLatencyMs).toBe(0);
    });
  });

  // ── getPromptAnalytics ──

  describe('getPromptAnalytics', () => {
    it('should return per-version breakdown', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({
        id: 'p1',
        versions: [
          { id: 'v1', version: 1, status: 'archived' },
          { id: 'v2', version: 2, status: 'active' },
        ],
      });
      mockPrisma.lLMEvent.aggregate
        .mockResolvedValueOnce({
          _count: 50,
          _sum: { costUsd: 2.5 },
          _avg: { latencyMs: 180, costUsd: 0.05 },
        })
        .mockResolvedValueOnce({
          _count: 100,
          _sum: { costUsd: 4.0 },
          _avg: { latencyMs: 150, costUsd: 0.04 },
        });

      const result = await service.getPromptAnalytics('proj1', 'p1', 'user1', 30);
      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(1);
      expect(result[0].callCount).toBe(50);
      expect(result[1].version).toBe(2);
      expect(result[1].callCount).toBe(100);
    });

    it('should handle zero events', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({
        id: 'p1',
        versions: [{ id: 'v1', version: 1, status: 'draft' }],
      });
      mockPrisma.lLMEvent.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { costUsd: null },
        _avg: { latencyMs: null, costUsd: null },
      });

      const result = await service.getPromptAnalytics('proj1', 'p1', 'user1');
      expect(result[0].callCount).toBe(0);
      expect(result[0].totalCostUsd).toBe(0);
    });

    it('should respect days parameter', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({
        id: 'p1',
        versions: [{ id: 'v1', version: 1, status: 'active' }],
      });
      mockPrisma.lLMEvent.aggregate.mockResolvedValue({
        _count: 10,
        _sum: { costUsd: 1.0 },
        _avg: { latencyMs: 100, costUsd: 0.1 },
      });

      await service.getPromptAnalytics('proj1', 'p1', 'user1', 7);
      expect(mockPrisma.lLMEvent.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('should call assertProjectAccess', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({
        id: 'p1',
        versions: [],
      });

      await service.getPromptAnalytics('proj1', 'p1', 'user1');
      expect(mockProjectService.assertProjectAccess).toHaveBeenCalledWith('proj1', 'user1');
    });
  });

  // ── getPromptTimeSeries ──

  describe('getPromptTimeSeries', () => {
    it('should return daily data per version', async () => {
      mockPrisma.managedPrompt.findFirst.mockResolvedValue({
        id: 'p1',
        versions: [
          { id: 'v1', version: 1 },
          { id: 'v2', version: 2 },
        ],
      });
      mockPrisma.lLMEvent.groupBy.mockResolvedValue([
        {
          promptVersionId: 'v1',
          createdAt: new Date('2025-01-15T10:00:00Z'),
          _count: 20,
          _sum: { costUsd: 1.0 },
        },
        {
          promptVersionId: 'v2',
          createdAt: new Date('2025-01-15T14:00:00Z'),
          _count: 30,
          _sum: { costUsd: 1.5 },
        },
      ]);

      const result = await service.getPromptTimeSeries('proj1', 'p1', 'user1', 30);
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2025-01-15');
      expect(result[0].versions).toHaveLength(2);
    });
  });

  // ── Authorization ──

  describe('authorization', () => {
    it('should propagate ForbiddenException from assertProjectAccess', async () => {
      mockProjectService.assertProjectAccess.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      await expect(service.listPrompts('proj1', 'user1')).rejects.toThrow(ForbiddenException);
      await expect(service.getPrompt('proj1', 'p1', 'user1')).rejects.toThrow(ForbiddenException);
      await expect(
        service.createPrompt('proj1', 'user1', { slug: 'a', name: 'A' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
