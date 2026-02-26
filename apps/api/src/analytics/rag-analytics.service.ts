import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import type {
  RagOverview,
  RagTimeSeriesPoint,
  RagTraceListItem,
  RagTraceDetail,
  ChunkRelevanceScore,
  FlowListItem,
  FlowDetail,
  FlowSpan,
} from '@launchpromptly/types';

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
          traceId: true,
          spanName: true,
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
        traceId: true,
        spanName: true,
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

  // ── Flow-level queries ──

  async getFlows(
    projectId: string,
    userId: string,
    options: { days?: number; pipeline?: string; page?: number; limit?: number } = {},
  ): Promise<{ flows: FlowListItem[]; total: number }> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const days = options.days ?? 7;
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipelineFilter = options.pipeline
      ? Prisma.sql`AND "ragPipelineId" = ${options.pipeline}`
      : Prisma.empty;

    // Count total distinct flows
    const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT "traceId") as count
      FROM "LLMEvent"
      WHERE "projectId" = ${projectId}
        AND "createdAt" >= ${since}
        AND "traceId" IS NOT NULL
        ${pipelineFilter}
    `;
    const total = Number(countResult[0]?.count ?? 0);

    if (total === 0) return { flows: [], total: 0 };

    // Get paginated flow aggregates
    const offset = (page - 1) * limit;
    const flowRows = await this.prisma.$queryRaw<
      Array<{
        traceId: string;
        span_count: bigint;
        total_cost_usd: number;
        total_latency_ms: bigint;
        created_at: Date;
        rag_pipeline_id: string | null;
        models: string[];
        span_names: string[] | null;
      }>
    >`
      SELECT
        "traceId",
        COUNT(*) as span_count,
        SUM("costUsd") as total_cost_usd,
        SUM("latencyMs") as total_latency_ms,
        MIN("createdAt") as created_at,
        MAX("ragPipelineId") as rag_pipeline_id,
        ARRAY_AGG(DISTINCT "model") as models,
        ARRAY_AGG(DISTINCT "spanName") FILTER (WHERE "spanName" IS NOT NULL) as span_names
      FROM "LLMEvent"
      WHERE "projectId" = ${projectId}
        AND "createdAt" >= ${since}
        AND "traceId" IS NOT NULL
        ${pipelineFilter}
      GROUP BY "traceId"
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    if (flowRows.length === 0) return { flows: [], total };

    // Get "generate" span details (ragQuery, responseText, evaluation) for each flow
    const traceIds = flowRows.map((r) => r.traceId);
    const detailRows = await this.prisma.$queryRaw<
      Array<{
        traceId: string;
        ragQuery: string | null;
        response_preview: string | null;
        faithfulnessScore: number | null;
        relevanceScore: number | null;
        contextRelevanceScore: number | null;
      }>
    >`
      SELECT DISTINCT ON (e."traceId")
        e."traceId",
        e."ragQuery",
        LEFT(e."responseText", 200) as response_preview,
        re."faithfulnessScore",
        re."relevanceScore",
        re."contextRelevanceScore"
      FROM "LLMEvent" e
      LEFT JOIN "RagEvaluation" re ON re."eventId" = e.id
      WHERE e."traceId" = ANY(${traceIds})
        AND (e."spanName" = 'generate' OR e."ragQuery" IS NOT NULL)
      ORDER BY e."traceId", CASE WHEN e."spanName" = 'generate' THEN 0 ELSE 1 END, e."createdAt" DESC
    `;

    const detailMap = new Map(detailRows.map((d) => [d.traceId, d]));

    return {
      flows: flowRows.map((r) => {
        const detail = detailMap.get(r.traceId);
        return {
          traceId: r.traceId,
          ragPipelineId: r.rag_pipeline_id,
          ragQuery: detail?.ragQuery ?? null,
          responsePreview: detail?.response_preview ?? null,
          spanCount: Number(r.span_count),
          totalCostUsd: Number(r.total_cost_usd),
          totalLatencyMs: Number(r.total_latency_ms),
          models: r.models,
          spanNames: r.span_names ?? [],
          createdAt: r.created_at.toISOString(),
          faithfulnessScore: detail?.faithfulnessScore ?? null,
          relevanceScore: detail?.relevanceScore ?? null,
          contextRelevanceScore: detail?.contextRelevanceScore ?? null,
        };
      }),
      total,
    };
  }

  async getFlowDetail(
    projectId: string,
    userId: string,
    traceId: string,
  ): Promise<FlowDetail | null> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const events = await this.prisma.lLMEvent.findMany({
      where: { projectId, traceId },
      select: {
        id: true,
        spanName: true,
        provider: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        costUsd: true,
        latencyMs: true,
        createdAt: true,
        ragPipelineId: true,
        ragQuery: true,
        ragChunks: true,
        ragRetrievalMs: true,
        ragChunkCount: true,
        ragContextTokens: true,
        responseText: true,
        promptPreview: true,
        managedPromptId: true,
        customerId: true,
        feature: true,
        managedPrompt: { select: { name: true } },
        ragEvaluation: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (events.length === 0) return null;

    const spans: FlowSpan[] = events.map((e) => ({
      id: e.id,
      spanName: e.spanName,
      provider: e.provider,
      model: e.model,
      inputTokens: e.inputTokens,
      outputTokens: e.outputTokens,
      totalTokens: e.totalTokens,
      costUsd: e.costUsd,
      latencyMs: e.latencyMs,
      createdAt: e.createdAt.toISOString(),
      ragQuery: e.ragQuery,
      ragChunks: e.ragChunks as FlowSpan['ragChunks'],
      ragRetrievalMs: e.ragRetrievalMs,
      ragChunkCount: e.ragChunkCount,
      ragContextTokens: e.ragContextTokens,
      responseText: e.responseText,
      promptPreview: e.promptPreview,
      managedPromptId: e.managedPromptId,
      managedPromptName: e.managedPrompt?.name ?? null,
      customerId: e.customerId,
      feature: e.feature,
      evaluation: e.ragEvaluation
        ? {
            ...e.ragEvaluation,
            chunkRelevanceScores: e.ragEvaluation.chunkRelevanceScores as ChunkRelevanceScore[] | null,
            createdAt: e.ragEvaluation.createdAt.toISOString(),
          }
        : null,
    }));

    // Find the "generate" span for flow-level evaluation
    const generateSpan =
      spans.find((s) => s.spanName === 'generate') ??
      spans.find((s) => s.ragQuery !== null);

    return {
      traceId,
      ragPipelineId: events[0]?.ragPipelineId ?? null,
      spans,
      totalCostUsd: events.reduce((sum, e) => sum + e.costUsd, 0),
      totalTokens: events.reduce((sum, e) => sum + e.totalTokens, 0),
      evaluation: generateSpan?.evaluation ?? null,
    };
  }
}
