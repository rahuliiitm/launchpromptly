import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { AuditService } from '../audit/audit.service';

export interface GdprReport {
  reportType: 'gdpr';
  generatedAt: string;
  periodDays: number;
  project: { id: string; name: string };
  dataSubjects: {
    total: number;
    withConsent: number;
    withoutConsent: number;
  };
  dataProcessing: {
    totalEvents: number;
    eventsWithPII: number;
    redactionRate: number;
    piiTypeBreakdown: Record<string, number>;
  };
  retention: {
    configuredDays: number;
    oldestEvent: string | null;
    compliance: boolean;
  };
  consentRecords: {
    total: number;
    active: number;
    revoked: number;
  };
  dsarRequests: {
    exports: number;
    deletions: number;
  };
}

export interface SecurityReport {
  reportType: 'security';
  generatedAt: string;
  periodDays: number;
  project: { id: string; name: string };
  threats: {
    injectionAttempts: number;
    injectionBlocked: number;
    contentViolations: number;
  };
  piiProtection: {
    totalDetections: number;
    eventsScanned: number;
    redactionApplied: number;
    exposureRate: number;
  };
  costControls: {
    totalSpend: number;
    avgCostPerEvent: number;
    costLimitTriggers: number;
  };
  incidents: {
    total: number;
    open: number;
    resolved: number;
    bySeverity: Record<string, number>;
  };
  auditIntegrity: {
    totalLogs: number;
    periodDays: number;
  };
}

export interface FullReport {
  reportType: 'full';
  generatedAt: string;
  periodDays: number;
  project: { id: string; name: string };
  gdpr: Omit<GdprReport, 'reportType' | 'generatedAt' | 'periodDays' | 'project'>;
  security: Omit<SecurityReport, 'reportType' | 'generatedAt' | 'periodDays' | 'project'>;
}

export type ComplianceReport = GdprReport | SecurityReport | FullReport;

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generate a compliance report for the given project.
   * @param type - 'gdpr', 'security', or 'full'
   * @param days - number of days to look back
   */
  async generateReport(
    projectId: string,
    userId: string,
    type: string,
    days: number,
  ): Promise<ComplianceReport> {
    await this.projectService.assertProjectAccess(projectId, userId);

    if (!['gdpr', 'security', 'full'].includes(type)) {
      throw new BadRequestException(
        `Invalid report type "${type}". Must be one of: gdpr, security, full`,
      );
    }

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, name: true, retentionDays: true },
    });

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let report: ComplianceReport;

    if (type === 'gdpr') {
      report = await this.buildGdprReport(project, since, days);
    } else if (type === 'security') {
      report = await this.buildSecurityReport(project, since, days);
    } else {
      report = await this.buildFullReport(project, since, days);
    }

    await this.auditService.log({
      projectId,
      eventType: 'compliance_report_generated',
      severity: 'info',
      details: {
        reportType: type,
        periodDays: days,
      },
      actorId: userId,
    });

    return report;
  }

  /**
   * Get paginated history of previously generated compliance reports.
   */
  async getReportHistory(
    projectId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const where = {
      projectId,
      eventType: 'compliance_report_generated',
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page, limit };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async buildGdprReport(
    project: { id: string; name: string; retentionDays: number },
    since: Date,
    days: number,
  ): Promise<GdprReport> {
    const projectId = project.id;

    // Data subjects -----------------------------------------------------------
    const [
      distinctCustomers,
      customersWithConsent,
    ] = await Promise.all([
      this.prisma.lLMEvent.findMany({
        where: { projectId, createdAt: { gte: since }, customerId: { not: null } },
        distinct: ['customerId'],
        select: { customerId: true },
      }),
      this.prisma.consentRecord.findMany({
        where: { projectId, revokedAt: null },
        distinct: ['customerId'],
        select: { customerId: true },
      }),
    ]);

    const totalSubjects = distinctCustomers.length;
    const consentedIds = new Set(customersWithConsent.map((c) => c.customerId));
    const withConsent = distinctCustomers.filter(
      (c) => c.customerId && consentedIds.has(c.customerId),
    ).length;

    // Data processing ---------------------------------------------------------
    const [
      totalEvents,
      eventsWithPII,
      redactedPIIEvents,
      piiEventsRaw,
    ] = await Promise.all([
      this.prisma.lLMEvent.count({
        where: { projectId, createdAt: { gte: since } },
      }),
      this.prisma.lLMEvent.count({
        where: {
          projectId,
          createdAt: { gte: since },
          piiDetectionCount: { gt: 0 },
        },
      }),
      this.prisma.lLMEvent.count({
        where: {
          projectId,
          createdAt: { gte: since },
          piiDetectionCount: { gt: 0 },
          redactionApplied: true,
        },
      }),
      this.prisma.lLMEvent.findMany({
        where: {
          projectId,
          createdAt: { gte: since },
          piiDetectionCount: { gt: 0 },
        },
        select: { piiTypes: true },
      }),
    ]);

    const piiTypeBreakdown: Record<string, number> = {};
    for (const event of piiEventsRaw) {
      for (const piiType of event.piiTypes) {
        piiTypeBreakdown[piiType] = (piiTypeBreakdown[piiType] ?? 0) + 1;
      }
    }

    const redactionRate =
      eventsWithPII > 0
        ? Math.round((redactedPIIEvents / eventsWithPII) * 10000) / 100
        : 0;

    // Retention ---------------------------------------------------------------
    const oldestEvent = await this.prisma.lLMEvent.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    const retentionCutoff = new Date(
      Date.now() - project.retentionDays * 24 * 60 * 60 * 1000,
    );
    const staleCount = await this.prisma.lLMEvent.count({
      where: { projectId, createdAt: { lt: retentionCutoff } },
    });

    // Consent records ---------------------------------------------------------
    const [totalConsent, activeConsent, revokedConsent] = await Promise.all([
      this.prisma.consentRecord.count({ where: { projectId } }),
      this.prisma.consentRecord.count({
        where: { projectId, revokedAt: null },
      }),
      this.prisma.consentRecord.count({
        where: { projectId, revokedAt: { not: null } },
      }),
    ]);

    // DSAR requests -----------------------------------------------------------
    const [dsarExports, dsarDeletions] = await Promise.all([
      this.prisma.auditLog.count({
        where: { projectId, eventType: 'dsar_export', createdAt: { gte: since } },
      }),
      this.prisma.auditLog.count({
        where: { projectId, eventType: 'dsar_deletion', createdAt: { gte: since } },
      }),
    ]);

    return {
      reportType: 'gdpr',
      generatedAt: new Date().toISOString(),
      periodDays: days,
      project: { id: project.id, name: project.name },
      dataSubjects: {
        total: totalSubjects,
        withConsent,
        withoutConsent: totalSubjects - withConsent,
      },
      dataProcessing: {
        totalEvents,
        eventsWithPII,
        redactionRate,
        piiTypeBreakdown,
      },
      retention: {
        configuredDays: project.retentionDays,
        oldestEvent: oldestEvent?.createdAt.toISOString() ?? null,
        compliance: staleCount === 0,
      },
      consentRecords: {
        total: totalConsent,
        active: activeConsent,
        revoked: revokedConsent,
      },
      dsarRequests: {
        exports: dsarExports,
        deletions: dsarDeletions,
      },
    };
  }

  private async buildSecurityReport(
    project: { id: string; name: string; retentionDays: number },
    since: Date,
    days: number,
  ): Promise<SecurityReport> {
    const projectId = project.id;

    // Threats -----------------------------------------------------------------
    const [
      injectionAttempts,
      injectionBlocked,
      contentViolations,
    ] = await Promise.all([
      this.prisma.lLMEvent.count({
        where: {
          projectId,
          createdAt: { gte: since },
          injectionRiskScore: { gt: 0.3 },
        },
      }),
      this.prisma.lLMEvent.count({
        where: {
          projectId,
          createdAt: { gte: since },
          injectionAction: 'block',
        },
      }),
      this.prisma.auditLog.count({
        where: {
          projectId,
          eventType: 'content_violation',
          createdAt: { gte: since },
        },
      }),
    ]);

    // PII protection ----------------------------------------------------------
    const [
      piiAgg,
      eventsScanned,
      redactionAppliedCount,
      piiNotRedacted,
    ] = await Promise.all([
      this.prisma.lLMEvent.aggregate({
        where: {
          projectId,
          createdAt: { gte: since },
          piiDetectionCount: { gt: 0 },
        },
        _sum: { piiDetectionCount: true },
      }),
      this.prisma.lLMEvent.count({
        where: { projectId, createdAt: { gte: since } },
      }),
      this.prisma.lLMEvent.count({
        where: {
          projectId,
          createdAt: { gte: since },
          redactionApplied: true,
        },
      }),
      this.prisma.lLMEvent.count({
        where: {
          projectId,
          createdAt: { gte: since },
          piiDetectionCount: { gt: 0 },
          redactionApplied: false,
        },
      }),
    ]);

    const totalDetections = piiAgg._sum.piiDetectionCount ?? 0;
    const eventsWithPII = await this.prisma.lLMEvent.count({
      where: {
        projectId,
        createdAt: { gte: since },
        piiDetectionCount: { gt: 0 },
      },
    });
    const exposureRate =
      eventsWithPII > 0
        ? Math.round((piiNotRedacted / eventsWithPII) * 10000) / 100
        : 0;

    // Cost controls -----------------------------------------------------------
    const [costAgg, costLimitTriggers] = await Promise.all([
      this.prisma.lLMEvent.aggregate({
        where: { projectId, createdAt: { gte: since } },
        _sum: { costUsd: true },
        _count: { id: true },
      }),
      this.prisma.auditLog.count({
        where: {
          projectId,
          eventType: 'cost_limit',
          createdAt: { gte: since },
        },
      }),
    ]);

    const totalSpend = costAgg._sum.costUsd ?? 0;
    const eventCount = costAgg._count.id;
    const avgCostPerEvent =
      eventCount > 0
        ? Math.round((totalSpend / eventCount) * 1000000) / 1000000
        : 0;

    // Incidents ---------------------------------------------------------------
    const [
      totalIncidents,
      openIncidents,
      resolvedIncidents,
      bySeverityRaw,
    ] = await Promise.all([
      this.prisma.securityIncident.count({
        where: { projectId, createdAt: { gte: since } },
      }),
      this.prisma.securityIncident.count({
        where: { projectId, createdAt: { gte: since }, status: 'open' },
      }),
      this.prisma.securityIncident.count({
        where: { projectId, createdAt: { gte: since }, status: 'resolved' },
      }),
      this.prisma.securityIncident.groupBy({
        by: ['severity'],
        where: { projectId, createdAt: { gte: since } },
        _count: { id: true },
      }),
    ]);

    const bySeverity: Record<string, number> = {};
    for (const group of bySeverityRaw) {
      bySeverity[group.severity] = group._count.id;
    }

    // Audit integrity ---------------------------------------------------------
    const totalLogs = await this.prisma.auditLog.count({
      where: { projectId, createdAt: { gte: since } },
    });

    return {
      reportType: 'security',
      generatedAt: new Date().toISOString(),
      periodDays: days,
      project: { id: project.id, name: project.name },
      threats: {
        injectionAttempts,
        injectionBlocked,
        contentViolations,
      },
      piiProtection: {
        totalDetections,
        eventsScanned,
        redactionApplied: redactionAppliedCount,
        exposureRate,
      },
      costControls: {
        totalSpend: Math.round(totalSpend * 100) / 100,
        avgCostPerEvent,
        costLimitTriggers,
      },
      incidents: {
        total: totalIncidents,
        open: openIncidents,
        resolved: resolvedIncidents,
        bySeverity,
      },
      auditIntegrity: {
        totalLogs,
        periodDays: days,
      },
    };
  }

  private async buildFullReport(
    project: { id: string; name: string; retentionDays: number },
    since: Date,
    days: number,
  ): Promise<FullReport> {
    const [gdpr, security] = await Promise.all([
      this.buildGdprReport(project, since, days),
      this.buildSecurityReport(project, since, days),
    ]);

    // Destructure to remove top-level keys that are shared
    const {
      reportType: _gt,
      generatedAt: _ga1,
      periodDays: _pd1,
      project: _p1,
      ...gdprData
    } = gdpr;
    const {
      reportType: _st,
      generatedAt: _ga2,
      periodDays: _pd2,
      project: _p2,
      ...securityData
    } = security;

    return {
      reportType: 'full',
      generatedAt: new Date().toISOString(),
      periodDays: days,
      project: { id: project.id, name: project.name },
      gdpr: gdprData,
      security: securityData,
    };
  }
}
