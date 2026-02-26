import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import type {
  OverviewAnalytics,
  CustomerAnalyticsItem,
  FeatureAnalyticsItem,
  TimeSeriesPoint,
  PromptAnalyticsItem,
} from '@launchpromptly/types';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
  ) {}

  async getOverview(
    projectId: string,
    userId: string,
    days: number = 30,
  ): Promise<OverviewAnalytics> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const agg = await this.prisma.lLMEvent.aggregate({
      where: { projectId, createdAt: { gte: since } },
      _sum: { costUsd: true },
      _count: { id: true },
      _avg: { latencyMs: true },
    });

    const modelGroups = await this.prisma.lLMEvent.groupBy({
      by: ['model'],
      where: { projectId, createdAt: { gte: since } },
      _sum: { costUsd: true },
      _count: { id: true },
      _avg: { latencyMs: true },
    });

    return {
      totalCostUsd: agg._sum.costUsd ?? 0,
      totalCalls: agg._count.id,
      avgLatencyMs: Math.round(agg._avg.latencyMs ?? 0),
      periodDays: days,
      modelBreakdown: modelGroups.map((g) => ({
        model: g.model,
        totalCostUsd: g._sum.costUsd ?? 0,
        callCount: g._count.id,
        avgLatencyMs: Math.round(g._avg.latencyMs ?? 0),
      })),
    };
  }

  async getCustomerBreakdown(
    projectId: string,
    userId: string,
    days: number = 30,
  ): Promise<CustomerAnalyticsItem[]> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const groups = await this.prisma.lLMEvent.groupBy({
      by: ['customerId'],
      where: { projectId, createdAt: { gte: since }, customerId: { not: null } },
      _sum: { costUsd: true },
      _count: { id: true },
      orderBy: { _sum: { costUsd: 'desc' } },
    });

    return groups
      .filter((g): g is typeof g & { customerId: string } => g.customerId !== null)
      .map((g) => ({
        customerId: g.customerId,
        totalCostUsd: g._sum.costUsd ?? 0,
        callCount: g._count.id,
        avgCostPerCall: g._count.id > 0 ? (g._sum.costUsd ?? 0) / g._count.id : 0,
      }));
  }

  async getFeatureBreakdown(
    projectId: string,
    userId: string,
    days: number = 30,
  ): Promise<FeatureAnalyticsItem[]> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const groups = await this.prisma.lLMEvent.groupBy({
      by: ['feature'],
      where: { projectId, createdAt: { gte: since }, feature: { not: null } },
      _sum: { costUsd: true },
      _count: { id: true },
      orderBy: { _sum: { costUsd: 'desc' } },
    });

    return groups
      .filter((g): g is typeof g & { feature: string } => g.feature !== null)
      .map((g) => ({
        feature: g.feature,
        totalCostUsd: g._sum.costUsd ?? 0,
        callCount: g._count.id,
      }));
  }

  async getTimeSeries(
    projectId: string,
    userId: string,
    days: number = 30,
  ): Promise<TimeSeriesPoint[]> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<
      Array<{ date: Date; total_cost: number; call_count: bigint }>
    >`
      SELECT
        DATE_TRUNC('day', "createdAt") AS date,
        SUM("costUsd") AS total_cost,
        COUNT(*) AS call_count
      FROM "LLMEvent"
      WHERE "projectId" = ${projectId}
        AND "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    return rows.map((r) => ({
      date: r.date.toISOString().split('T')[0] ?? '',
      costUsd: Number(r.total_cost),
      callCount: Number(r.call_count),
    }));
  }

  async getPromptBreakdown(
    projectId: string,
    userId: string,
    days: number = 30,
  ): Promise<PromptAnalyticsItem[]> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<
      Array<{
        managed_prompt_id: string;
        name: string;
        slug: string;
        total_cost: number;
        call_count: bigint;
        avg_latency: number;
      }>
    >`
      SELECT
        e."managedPromptId" AS managed_prompt_id,
        p."name" AS name,
        p."slug" AS slug,
        SUM(e."costUsd") AS total_cost,
        COUNT(*) AS call_count,
        AVG(e."latencyMs") AS avg_latency
      FROM "LLMEvent" e
      JOIN "ManagedPrompt" p ON p."id" = e."managedPromptId"
      WHERE e."projectId" = ${projectId}
        AND e."createdAt" >= ${since}
        AND e."managedPromptId" IS NOT NULL
      GROUP BY e."managedPromptId", p."name", p."slug"
      ORDER BY total_cost DESC
    `;

    return rows.map((r) => ({
      promptId: r.managed_prompt_id,
      promptName: r.name,
      promptSlug: r.slug,
      totalCostUsd: Number(r.total_cost),
      callCount: Number(r.call_count),
      avgLatencyMs: Math.round(Number(r.avg_latency)),
    }));
  }
}
