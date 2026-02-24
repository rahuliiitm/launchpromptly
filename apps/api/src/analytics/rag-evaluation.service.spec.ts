import { BadRequestException } from '@nestjs/common';
import { RagEvaluationService } from './rag-evaluation.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderKeyService } from '../provider-key/provider-key.service';
import { ProjectService } from '../project/project.service';

// Mock the OpenAI and Anthropic modules
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '{"score": 0.85, "reasoning": "Well grounded"}' } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      },
    },
  }));
});

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"score": 0.85, "reasoning": "Well grounded"}' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  }));
});

describe('RagEvaluationService', () => {
  let service: RagEvaluationService;
  let prisma: PrismaService;
  let providerKeyService: ProviderKeyService;
  let projectService: ProjectService;

  const mockEvent = {
    id: 'ev-1',
    projectId: 'proj-1',
    ragQuery: 'How do I reset my password?',
    ragChunks: [
      { content: 'To reset your password, visit settings...', source: 'doc-1', score: 0.92 },
      { content: 'Account security overview...', source: 'doc-2', score: 0.75 },
    ],
    responseText: 'You can reset your password by going to Settings > Security.',
    ragPipelineId: 'support-bot',
  };

  beforeEach(() => {
    prisma = {
      ragEvaluation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'eval-1',
          eventId: data.eventId,
          faithfulnessScore: data.faithfulnessScore,
          faithfulnessReasoning: data.faithfulnessReasoning,
          relevanceScore: data.relevanceScore,
          relevanceReasoning: data.relevanceReasoning,
          contextRelevanceScore: data.contextRelevanceScore,
          contextRelevanceReasoning: data.contextRelevanceReasoning,
          chunkRelevanceScores: data.chunkRelevanceScores ?? null,
          evaluationModel: data.evaluationModel,
          evaluationCostUsd: data.evaluationCostUsd,
          status: data.status,
          error: data.error ?? null,
          createdAt: new Date(),
        })),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      lLMEvent: {
        findFirst: jest.fn().mockResolvedValue(mockEvent),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', organizationId: 'org-1' }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as unknown as PrismaService;

    providerKeyService = {
      getDecryptedKey: jest.fn().mockImplementation((_orgId: string, provider: string) => {
        if (provider === 'openai') return Promise.resolve('sk-test-key');
        return Promise.resolve(null);
      }),
    } as unknown as ProviderKeyService;

    projectService = {
      assertProjectAccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectService;

    service = new RagEvaluationService(prisma, providerKeyService, projectService);
  });

  describe('evaluateTrace', () => {
    it('should evaluate a RAG trace with all three dimensions', async () => {
      const result = await service.evaluateTrace('proj-1', 'user-1', 'ev-1');

      expect(projectService.assertProjectAccess).toHaveBeenCalledWith('proj-1', 'user-1');
      expect(result.eventId).toBe('ev-1');
      expect(result.status).toBe('completed');
      expect(result.faithfulnessScore).toBe(0.85);
      expect(result.relevanceScore).toBe(0.85);
      expect(result.contextRelevanceScore).toBe(0.85);
      expect(result.evaluationModel).toBe('gpt-4o-mini');
    });

    it('should return existing evaluation if already evaluated', async () => {
      const existingEval = {
        id: 'eval-existing',
        eventId: 'ev-1',
        faithfulnessScore: 0.90,
        faithfulnessReasoning: 'Good',
        relevanceScore: 0.88,
        relevanceReasoning: 'Relevant',
        contextRelevanceScore: 0.75,
        contextRelevanceReasoning: 'Mostly relevant',
        chunkRelevanceScores: null,
        evaluationModel: 'gpt-4o-mini',
        evaluationCostUsd: 0.001,
        status: 'completed',
        error: null,
        createdAt: new Date(),
      };
      (prisma.ragEvaluation.findUnique as jest.Mock).mockResolvedValue(existingEval);

      const result = await service.evaluateTrace('proj-1', 'user-1', 'ev-1');

      expect(result.id).toBe('eval-existing');
      expect(result.faithfulnessScore).toBe(0.90);
      // Should NOT have called LLM
      expect(prisma.ragEvaluation.create).not.toHaveBeenCalled();
    });

    it('should throw if event not found', async () => {
      (prisma.lLMEvent.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.evaluateTrace('proj-1', 'user-1', 'missing')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if event has no RAG context', async () => {
      (prisma.lLMEvent.findFirst as jest.Mock).mockResolvedValue({
        id: 'ev-2',
        projectId: 'proj-1',
        ragQuery: null,
        ragChunks: null,
        responseText: 'Hello',
      });

      await expect(service.evaluateTrace('proj-1', 'user-1', 'ev-2')).rejects.toThrow(
        'no RAG context',
      );
    });

    it('should evaluate only context relevance when no response text', async () => {
      (prisma.lLMEvent.findFirst as jest.Mock).mockResolvedValue({
        ...mockEvent,
        responseText: null,
      });

      const result = await service.evaluateTrace('proj-1', 'user-1', 'ev-1');

      expect(result.status).toBe('completed');
      expect(result.contextRelevanceScore).toBe(0.85);
      // No faithfulness or answer relevance without response text
      expect(result.faithfulnessScore).toBeNull();
      expect(result.relevanceScore).toBeNull();
    });

    it('should store error when no provider keys configured', async () => {
      (providerKeyService.getDecryptedKey as jest.Mock).mockResolvedValue(null);

      const result = await service.evaluateTrace('proj-1', 'user-1', 'ev-1');

      expect(result.status).toBe('error');
      expect(result.error).toContain('No provider keys configured');
      expect(result.faithfulnessScore).toBeNull();
    });
  });

  describe('evaluateBatch', () => {
    it('should evaluate unevaluated traces', async () => {
      (prisma.lLMEvent.findMany as jest.Mock).mockResolvedValue([
        { id: 'ev-1' },
        { id: 'ev-2' },
      ]);

      const result = await service.evaluateBatch('proj-1', 'user-1', 10);

      expect(result.evaluated).toBe(2);
      expect(result.errors).toBe(0);
    });

    it('should handle evaluation errors gracefully', async () => {
      (prisma.lLMEvent.findMany as jest.Mock).mockResolvedValue([
        { id: 'ev-missing' },
      ]);
      // First call for batch findMany, then evaluateTrace will call findFirst
      (prisma.lLMEvent.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.evaluateBatch('proj-1', 'user-1', 10);

      expect(result.evaluated).toBe(0);
      expect(result.errors).toBe(1);
    });
  });

  describe('getQualityOverview', () => {
    it('should return aggregate quality metrics', async () => {
      (prisma.ragEvaluation.count as jest.Mock).mockResolvedValue(25);
      (prisma.lLMEvent.count as jest.Mock).mockResolvedValue(10);
      (prisma.ragEvaluation.aggregate as jest.Mock).mockResolvedValue({
        _avg: {
          faithfulnessScore: 0.867,
          relevanceScore: 0.923,
          contextRelevanceScore: 0.781,
        },
      });
      (prisma.ragEvaluation.findMany as jest.Mock).mockResolvedValue([
        { faithfulnessScore: 0.9, relevanceScore: 0.95, contextRelevanceScore: 0.85 },
        { faithfulnessScore: 0.6, relevanceScore: 0.7, contextRelevanceScore: 0.5 },
        { faithfulnessScore: 0.3, relevanceScore: 0.2, contextRelevanceScore: 0.1 },
      ]);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        {
          ragPipelineId: 'support-bot',
          count: BigInt(15),
          avgFaith: 0.88,
          avgRel: 0.92,
          avgCtx: 0.80,
        },
      ]);

      const result = await service.getQualityOverview('proj-1', 'user-1', 30);

      expect(result.totalEvaluated).toBe(25);
      expect(result.totalUnevaluated).toBe(10);
      expect(result.avgFaithfulness).toBe(0.87);
      expect(result.avgRelevance).toBe(0.92);
      expect(result.avgContextRelevance).toBe(0.78);
      expect(result.scoreDistribution.good).toBe(1);
      expect(result.scoreDistribution.fair).toBe(1);
      expect(result.scoreDistribution.poor).toBe(1);
      expect(result.pipelineBreakdown).toHaveLength(1);
      expect(result.pipelineBreakdown[0].pipelineId).toBe('support-bot');
    });

    it('should handle no evaluations', async () => {
      (prisma.ragEvaluation.count as jest.Mock).mockResolvedValue(0);
      (prisma.lLMEvent.count as jest.Mock).mockResolvedValue(5);
      (prisma.ragEvaluation.aggregate as jest.Mock).mockResolvedValue({
        _avg: { faithfulnessScore: null, relevanceScore: null, contextRelevanceScore: null },
      });
      (prisma.ragEvaluation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.getQualityOverview('proj-1', 'user-1', 30);

      expect(result.totalEvaluated).toBe(0);
      expect(result.totalUnevaluated).toBe(5);
      expect(result.avgFaithfulness).toBeNull();
      expect(result.pipelineBreakdown).toHaveLength(0);
    });
  });

  describe('getQualityTimeSeries', () => {
    it('should return daily quality scores', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        {
          date: new Date('2026-02-20'),
          count: BigInt(10),
          avgFaith: 0.88,
          avgRel: 0.92,
          avgCtx: 0.75,
        },
        {
          date: new Date('2026-02-21'),
          count: BigInt(8),
          avgFaith: 0.90,
          avgRel: 0.91,
          avgCtx: 0.80,
        },
      ]);

      const result = await service.getQualityTimeSeries('proj-1', 'user-1', 7);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-02-20');
      expect(result[0].evaluatedCount).toBe(10);
      expect(result[0].avgFaithfulness).toBe(0.88);
      expect(result[1].avgContextRelevance).toBe(0.8);
    });
  });
});
