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
          ragEvaluation: null,
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
        responseText: 'To reset your password, go to...',
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
        ragEvaluation: null,
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

  describe('getFlows', () => {
    it('should return paginated flow list', async () => {
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(2) }]) // count query
        .mockResolvedValueOnce([ // flow aggregates
          {
            traceId: 'trace-1',
            span_count: BigInt(3),
            total_cost_usd: 0.05,
            total_latency_ms: BigInt(1200),
            created_at: new Date('2026-02-20T10:00:00Z'),
            rag_pipeline_id: 'support-bot',
            models: ['gpt-4o', 'gpt-4o-mini'],
            span_names: ['rerank', 'generate', 'guardrail'],
          },
        ])
        .mockResolvedValueOnce([ // detail rows
          {
            traceId: 'trace-1',
            ragQuery: 'How to reset password?',
            response_preview: 'To reset your password...',
            faithfulnessScore: 0.92,
            relevanceScore: 0.88,
            contextRelevanceScore: 0.85,
          },
        ]);

      const result = await service.getFlows('proj-1', 'user-1', { days: 7, page: 1, limit: 20 });

      expect(result.total).toBe(2);
      expect(result.flows).toHaveLength(1);
      expect(result.flows[0].traceId).toBe('trace-1');
      expect(result.flows[0].spanCount).toBe(3);
      expect(result.flows[0].ragQuery).toBe('How to reset password?');
      expect(result.flows[0].models).toContain('gpt-4o');
    });

    it('should return empty when no flows found', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await service.getFlows('proj-1', 'user-1', { days: 7 });

      expect(result.flows).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getFlowDetail', () => {
    it('should return flow with all spans', async () => {
      (prisma.lLMEvent.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'ev-1',
          spanName: 'rerank',
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 200,
          outputTokens: 50,
          totalTokens: 250,
          costUsd: 0.001,
          latencyMs: 150,
          createdAt: new Date('2026-02-20T10:00:00Z'),
          ragPipelineId: 'support-bot',
          ragQuery: null,
          ragChunks: null,
          ragRetrievalMs: null,
          ragChunkCount: null,
          ragContextTokens: null,
          responseText: null,
          promptPreview: null,
          managedPromptId: null,
          customerId: 'cust-1',
          feature: 'support',
          managedPrompt: null,
          ragEvaluation: null,
        },
        {
          id: 'ev-2',
          spanName: 'generate',
          provider: 'openai',
          model: 'gpt-4o',
          inputTokens: 800,
          outputTokens: 300,
          totalTokens: 1100,
          costUsd: 0.04,
          latencyMs: 900,
          createdAt: new Date('2026-02-20T10:00:01Z'),
          ragPipelineId: 'support-bot',
          ragQuery: 'How to reset password?',
          ragChunks: [{ content: 'Reset at...', source: 'doc-1', score: 0.9 }],
          ragRetrievalMs: 45,
          ragChunkCount: 1,
          ragContextTokens: 150,
          responseText: 'To reset your password...',
          promptPreview: 'You are a support agent',
          managedPromptId: 'mp-1',
          customerId: 'cust-1',
          feature: 'support',
          managedPrompt: { name: 'customer-support' },
          ragEvaluation: {
            id: 'eval-1',
            eventId: 'ev-2',
            faithfulnessScore: 0.92,
            faithfulnessReasoning: 'Good',
            relevanceScore: 0.88,
            relevanceReasoning: 'Relevant',
            contextRelevanceScore: 0.85,
            contextRelevanceReasoning: 'On topic',
            chunkRelevanceScores: null,
            createdAt: new Date('2026-02-20T10:01:00Z'),
          },
        },
      ]);

      const result = await service.getFlowDetail('proj-1', 'user-1', 'trace-1');

      expect(result).not.toBeNull();
      expect(result!.traceId).toBe('trace-1');
      expect(result!.spans).toHaveLength(2);
      expect(result!.spans[0].spanName).toBe('rerank');
      expect(result!.spans[1].spanName).toBe('generate');
      expect(result!.spans[1].managedPromptName).toBe('customer-support');
      expect(result!.totalCostUsd).toBeCloseTo(0.041);
      expect(result!.totalTokens).toBe(1350);
      expect(result!.evaluation).not.toBeNull();
      expect(result!.evaluation!.faithfulnessScore).toBe(0.92);
    });

    it('should return null for non-existent flow', async () => {
      (prisma.lLMEvent.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getFlowDetail('proj-1', 'user-1', 'missing');

      expect(result).toBeNull();
    });
  });
});
