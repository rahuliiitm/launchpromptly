import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import type {
  RagOverview,
  RagTimeSeriesPoint,
  RagTraceListItem,
  RagTraceDetail,
  ChunkRelevanceScore,
} from '@aiecon/types';

@Injectable()
export class RagAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
  ) {}

  async getRagOverview(
    projectId: string,
    userId: string,
    days = 30,
  ): Promise<RagOverview> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const agg = await this.prisma.lLMEvent.aggregate({
      where: {
        projectId,
        createdAt: { gte: since },
        ragPipelineId: { not: null },
      },
      _count: { id: true },
      _avg: { ragRetrievalMs: true, ragChunkCount: true, ragContextTokens: true },
      _sum: { costUsd: true },
    });

    const pipelineGroups = await this.prisma.lLMEvent.groupBy({
      by: ['ragPipelineId'],
      where: {
        projectId,
        createdAt: { gte: since },
        ragPipelineId: { not: null },
      },
      _count: { id: true },
      _avg: { ragRetrievalMs: true, ragChunkCount: true },
      _sum: { costUsd: true },
      orderBy: { _sum: { costUsd: 'desc' } },
    });

    return {
      totalRagCalls: agg._count.id,
      avgRetrievalMs: Math.round(agg._avg.ragRetrievalMs ?? 0),
      avgChunkCount: Math.round((agg._avg.ragChunkCount ?? 0) * 10) / 10,
      avgContextTokens: Math.round(agg._avg.ragContextTokens ?? 0),
      totalCostUsd: agg._sum.costUsd ?? 0,
      periodDays: days,
      pipelineBreakdown: pipelineGroups
        .filter((g): g is typeof g & { ragPipelineId: string } => g.ragPipelineId !== null)
        .map((g) => ({
          pipelineId: g.ragPipelineId,
          callCount: g._count.id,
          avgRetrievalMs: Math.round(g._avg.ragRetrievalMs ?? 0),
          avgChunkCount: Math.round((g._avg.ragChunkCount ?? 0) * 10) / 10,
          totalCostUsd: g._sum.costUsd ?? 0,
        })),
    };
  }

  async getRagTimeSeries(
    projectId: string,
    userId: string,
    days = 30,
  ): Promise<RagTimeSeriesPoint[]> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<
      Array<{
        date: Date;
        rag_calls: bigint;
        avg_retrieval_ms: number;
        avg_chunk_count: number;
        cost_usd: number;
      }>
    >`
      SELECT
        DATE_TRUNC('day', "createdAt") AS date,
        COUNT(*) AS rag_calls,
        AVG("ragRetrievalMs") AS avg_retrieval_ms,
        AVG("ragChunkCount") AS avg_chunk_count,
        SUM("costUsd") AS cost_usd
      FROM "LLMEvent"
      WHERE "projectId" = ${projectId}
        AND "createdAt" >= ${since}
        AND "ragPipelineId" IS NOT NULL
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    return rows.map((r) => ({
      date: r.date.toISOString().split('T')[0] ?? '',
      ragCalls: Number(r.rag_calls),
      avgRetrievalMs: Math.round(Number(r.avg_retrieval_ms) || 0),
      avgChunkCount: Math.round((Number(r.avg_chunk_count) || 0) * 10) / 10,
      costUsd: Number(r.cost_usd),
    }));
  }

  async getRagTraces(
    projectId: string,
    userId: string,
    options: { days?: number; pipeline?: string; page?: number; limit?: number } = {},
  ): Promise<{ traces: RagTraceListItem[]; total: number }> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const days = options.days ?? 7;
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where = {
      projectId,
      createdAt: { gte: since },
      ragPipelineId: options.pipeline ? options.pipeline : { not: null as string | null },
    };

    const [traces, total] = await Promise.all([
      this.prisma.lLMEvent.findMany({
        where,
        select: {
          id: true,
          ragPipelineId: true,
          ragQuery: true,
          ragRetrievalMs: true,
          ragChunkCount: true,
          ragContextTokens: true,
          model: true,
          provider: true,
          costUsd: true,
          latencyMs: true,
          createdAt: true,
          ragEvaluation: {
            select: {
              faithfulnessScore: true,
              relevanceScore: true,
              contextRelevanceScore: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lLMEvent.count({ where }),
    ]);

    return {
      traces: traces.map((t) => {
        const { ragEvaluation, ...rest } = t;
        return {
          ...rest,
          faithfulnessScore: ragEvaluation?.faithfulnessScore ?? null,
          relevanceScore: ragEvaluation?.relevanceScore ?? null,
          contextRelevanceScore: ragEvaluation?.contextRelevanceScore ?? null,
          createdAt: t.createdAt.toISOString(),
        };
      }),
      total,
    };
  }

  async getRagTraceDetail(
    projectId: string,
    userId: string,
    eventId: string,
  ): Promise<RagTraceDetail | null> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const event = await this.prisma.lLMEvent.findFirst({
      where: { id: eventId, projectId, ragPipelineId: { not: null } },
      select: {
        id: true,
        ragPipelineId: true,
        ragQuery: true,
        ragRetrievalMs: true,
        ragChunkCount: true,
        ragContextTokens: true,
        ragChunks: true,
        responseText: true,
        model: true,
        provider: true,
        costUsd: true,
        latencyMs: true,
        promptPreview: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        customerId: true,
        feature: true,
        createdAt: true,
        ragEvaluation: true,
      },
    });

    if (!event) return null;

    const { ragEvaluation, ...rest } = event;

    return {
      ...rest,
      ragChunks: event.ragChunks as RagTraceDetail['ragChunks'],
      responseText: event.responseText,
      faithfulnessScore: ragEvaluation?.faithfulnessScore ?? null,
      relevanceScore: ragEvaluation?.relevanceScore ?? null,
      contextRelevanceScore: ragEvaluation?.contextRelevanceScore ?? null,
      evaluation: ragEvaluation
        ? {
            ...ragEvaluation,
            chunkRelevanceScores: ragEvaluation.chunkRelevanceScores as ChunkRelevanceScore[] | null,
            createdAt: ragEvaluation.createdAt.toISOString(),
          }
        : null,
      createdAt: event.createdAt.toISOString(),
    };
  }
}
