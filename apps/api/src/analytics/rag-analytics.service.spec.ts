import { RagAnalyticsService } from './rag-analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';

describe('RagAnalyticsService', () => {
  let service: RagAnalyticsService;
  let prisma: PrismaService;
  let projectService: ProjectService;

  beforeEach(() => {
    prisma = {
      lLMEvent: {
        aggregate: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      $queryRaw: jest.fn(),
    } as unknown as PrismaService;

    projectService = {
      assertProjectAccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectService;

    service = new RagAnalyticsService(prisma, projectService);
  });

  describe('getRagOverview', () => {
    it('should return aggregated RAG metrics', async () => {
      (prisma.lLMEvent.aggregate as jest.Mock).mockResolvedValue({
        _count: { id: 42 },
        _avg: { ragRetrievalMs: 55.3, ragChunkCount: 3.2, ragContextTokens: 480 },
        _sum: { costUsd: 1.25 },
      });
      (prisma.lLMEvent.groupBy as jest.Mock).mockResolvedValue([
        {
          ragPipelineId: 'support-bot',
          _count: { id: 30 },
          _avg: { ragRetrievalMs: 50, ragChunkCount: 3.0 },
          _sum: { costUsd: 0.90 },
        },
        {
          ragPipelineId: 'docs-search',
          _count: { id: 12 },
          _avg: { ragRetrievalMs: 65, ragChunkCount: 4.0 },
          _sum: { costUsd: 0.35 },
        },
      ]);

      const result = await service.getRagOverview('proj-1', 'user-1', 30);

      expect(projectService.assertProjectAccess).toHaveBeenCalledWith('proj-1', 'user-1');
      expect(result.totalRagCalls).toBe(42);
      expect(result.avgRetrievalMs).toBe(55);
      expect(result.avgChunkCount).toBe(3.2);
      expect(result.totalCostUsd).toBe(1.25);
      expect(result.pipelineBreakdown).toHaveLength(2);
      expect(result.pipelineBreakdown[0].pipelineId).toBe('support-bot');
    });

    it('should handle zero RAG events', async () => {
      (prisma.lLMEvent.aggregate as jest.Mock).mockResolvedValue({
        _count: { id: 0 },
        _avg: { ragRetrievalMs: null, ragChunkCount: null, ragContextTokens: null },
        _sum: { costUsd: null },
      });
      (prisma.lLMEvent.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getRagOverview('proj-1', 'user-1');

      expect(result.totalRagCalls).toBe(0);
      expect(result.avgRetrievalMs).toBe(0);
      expect(result.pipelineBreakdown).toHaveLength(0);
    });
  });

  describe('getRagTimeSeries', () => {
    it('should return daily RAG time series', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        {
          date: new Date('2026-02-20'),
          rag_calls: BigInt(15),
          avg_retrieval_ms: 50,
          avg_chunk_count: 3.5,
          cost_usd: 0.42,
        },
      ]);

      const result = await service.getRagTimeSeries('proj-1', 'user-1', 7);

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2026-02-20');
      expect(result[0].ragCalls).toBe(15);
      expect(result[0].avgRetrievalMs).toBe(50);
    });
  });

  describe('getRagTraces', () => {
    it('should return paginated trace list', async () => {
      const mockTraces = [
        {
          id: 'ev-1',
          ragPipelineId: 'support-bot',
          ragQuery: 'How to reset?',
          ragRetrievalMs: 45,
          ragChunkCount: 3,
          ragContextTokens: 350,
          model: 'gpt-4o',
          provider: 'openai',
          costUsd: 0.02,
          latencyMs: 800,
          createdAt: new Date('2026-02-20T10:00:00Z'),
        },
      ];
      (prisma.lLMEvent.findMany as jest.Mock).mockResolvedValue(mockTraces);
      (prisma.lLMEvent.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getRagTraces('proj-1', 'user-1', { days: 7, page: 1, limit: 20 });

      expect(result.traces).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.traces[0].ragQuery).toBe('How to reset?');
      expect(result.traces[0].createdAt).toBe('2026-02-20T10:00:00.000Z');
    });

    it('should filter by pipeline', async () => {
      (prisma.lLMEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lLMEvent.count as jest.Mock).mockResolvedValue(0);

      await service.getRagTraces('proj-1', 'user-1', { pipeline: 'support-bot' });

      const findManyCall = (prisma.lLMEvent.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.ragPipelineId).toBe('support-bot');
    });
  });

  describe('getRagTraceDetail', () => {
    it('should return full trace with chunks', async () => {
      const chunks = [
        { content: 'Reset your password at...', source: 'doc-1', score: 0.92 },
      ];
      (prisma.lLMEvent.findFirst as jest.Mock).mockResolvedValue({
        id: 'ev-1',
        ragPipelineId: 'support-bot',
        ragQuery: 'How to reset?',
        ragRetrievalMs: 45,
        ragChunkCount: 1,
        ragContextTokens: 150,
        ragChunks: chunks,
        model: 'gpt-4o',
        provider: 'openai',
        costUsd: 0.02,
        latencyMs: 800,
        promptPreview: 'You are a helpful support agent...',
        inputTokens: 500,
        outputTokens: 200,
        totalTokens: 700,
        customerId: 'cust-1',
        feature: 'support-chat',
        createdAt: new Date('2026-02-20T10:00:00Z'),
      });

      const result = await service.getRagTraceDetail('proj-1', 'user-1', 'ev-1');

      expect(result).not.toBeNull();
      expect(result!.ragChunks).toEqual(chunks);
      expect(result!.ragQuery).toBe('How to reset?');
      expect(result!.promptPreview).toBe('You are a helpful support agent...');
    });

    it('should return null for non-existent trace', async () => {
      (prisma.lLMEvent.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getRagTraceDetail('proj-1', 'user-1', 'missing');

      expect(result).toBeNull();
    });
  });
});
