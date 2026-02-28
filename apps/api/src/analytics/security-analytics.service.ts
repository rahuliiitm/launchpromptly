import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';

interface SecurityOverview {
  totalEvents: number;
  eventsWithPii: number;
  piiExposureRate: number;  // percentage 0-100
  totalPiiDetections: number;
  injectionAttempts: number;
  injectionBlocked: number;
  redactionRate: number;  // percentage of events with redaction applied
  topPiiTypes: Array<{ type: string; count: number }>;
  periodDays: number;
}

interface SecurityTimeSeries {
  date: string;
  piiDetections: number;
  injectionAttempts: number;
  injectionBlocked: number;
  eventsWithRedaction: number;
  totalEvents: number;
}

interface InjectionBreakdown {
  totalAttempts: number;
  blocked: number;
  warned: number;
  allowed: number;
  avgRiskScore: number;
  topTriggered: Array<{ category: string; count: number }>;
}

@Injectable()
export class SecurityAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
  ) {}

  async getSecurityOverview(
    projectId: string,
    userId: string,
    days: number = 30,
  ): Promise<SecurityOverview> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Total events in period
    const totalEvents = await this.prisma.lLMEvent.count({
      where: { projectId, createdAt: { gte: since } },
    });

    // Events with PII detected
    const eventsWithPii = await this.prisma.lLMEvent.count({
      where: { projectId, createdAt: { gte: since }, piiDetectionCount: { gt: 0 } },
    });

    // Total PII detection count
    const piiAgg = await this.prisma.lLMEvent.aggregate({
      where: { projectId, createdAt: { gte: since }, piiDetectionCount: { gt: 0 } },
      _sum: { piiDetectionCount: true },
    });

    // Injection attempts (any non-null injectionRiskScore > 0.3 treated as attempt)
    const injectionAttempts = await this.prisma.lLMEvent.count({
      where: { projectId, createdAt: { gte: since }, injectionRiskScore: { gte: 0.3 } },
    });

    const injectionBlocked = await this.prisma.lLMEvent.count({
      where: { projectId, createdAt: { gte: since }, injectionAction: 'block' },
    });

    // Redaction rate
    const redactedEvents = await this.prisma.lLMEvent.count({
      where: { projectId, createdAt: { gte: since }, redactionApplied: true },
    });

    // PII types breakdown — query audit logs for pii_detected events
    // Use raw SQL for array aggregation on piiTypes
    const piiTypeRows = await this.prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
      SELECT unnest("piiTypes") AS type, COUNT(*) AS count
      FROM "LLMEvent"
      WHERE "projectId" = ${projectId}
        AND "createdAt" >= ${since}
        AND array_length("piiTypes", 1) > 0
      GROUP BY type
      ORDER BY count DESC
      LIMIT 10
    `;

    return {
      totalEvents,
      eventsWithPii,
      piiExposureRate: totalEvents > 0 ? Math.round((eventsWithPii / totalEvents) * 10000) / 100 : 0,
      totalPiiDetections: piiAgg._sum.piiDetectionCount ?? 0,
      injectionAttempts,
      injectionBlocked,
      redactionRate: totalEvents > 0 ? Math.round((redactedEvents / totalEvents) * 10000) / 100 : 0,
      topPiiTypes: piiTypeRows.map(r => ({ type: r.type, count: Number(r.count) })),
      periodDays: days,
    };
  }

  async getSecurityTimeSeries(
    projectId: string,
    userId: string,
    days: number = 30,
  ): Promise<SecurityTimeSeries[]> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<Array<{
      date: Date;
      pii_detections: bigint;
      injection_attempts: bigint;
      injection_blocked: bigint;
      events_with_redaction: bigint;
      total_events: bigint;
    }>>`
      SELECT
        DATE_TRUNC('day', "createdAt") AS date,
        COALESCE(SUM("piiDetectionCount"), 0) AS pii_detections,
        COUNT(*) FILTER (WHERE "injectionRiskScore" >= 0.3) AS injection_attempts,
        COUNT(*) FILTER (WHERE "injectionAction" = 'block') AS injection_blocked,
        COUNT(*) FILTER (WHERE "redactionApplied" = true) AS events_with_redaction,
        COUNT(*) AS total_events
      FROM "LLMEvent"
      WHERE "projectId" = ${projectId}
        AND "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    return rows.map(r => ({
      date: r.date.toISOString().split('T')[0] ?? '',
      piiDetections: Number(r.pii_detections),
      injectionAttempts: Number(r.injection_attempts),
      injectionBlocked: Number(r.injection_blocked),
      eventsWithRedaction: Number(r.events_with_redaction),
      totalEvents: Number(r.total_events),
    }));
  }

  async getInjectionBreakdown(
    projectId: string,
    userId: string,
    days: number = 30,
  ): Promise<InjectionBreakdown> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const actionGroups = await this.prisma.lLMEvent.groupBy({
      by: ['injectionAction'],
      where: {
        projectId,
        createdAt: { gte: since },
        injectionRiskScore: { not: null },
      },
      _count: { id: true },
      _avg: { injectionRiskScore: true },
    });

    const blocked = actionGroups.find(g => g.injectionAction === 'block')?._count.id ?? 0;
    const warned = actionGroups.find(g => g.injectionAction === 'warn')?._count.id ?? 0;
    const allowed = actionGroups.find(g => g.injectionAction === 'allow')?._count.id ?? 0;
    const totalAttempts = blocked + warned;

    // Average risk score across all events with injection data
    const avgAgg = await this.prisma.lLMEvent.aggregate({
      where: { projectId, createdAt: { gte: since }, injectionRiskScore: { not: null } },
      _avg: { injectionRiskScore: true },
    });

    // Top triggered categories from audit logs
    const topTriggered = await this.prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
      SELECT
        json_array_elements_text(details->'triggered') AS category,
        COUNT(*) AS count
      FROM "AuditLog"
      WHERE "projectId" = ${projectId}
        AND "createdAt" >= ${since}
        AND "eventType" IN ('injection_blocked', 'injection_warned')
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `;

    return {
      totalAttempts,
      blocked,
      warned,
      allowed,
      avgRiskScore: Math.round((avgAgg._avg.injectionRiskScore ?? 0) * 100) / 100,
      topTriggered: topTriggered.map(r => ({ category: r.category, count: Number(r.count) })),
    };
  }
}
