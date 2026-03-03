import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import type { QueryAuditDto } from './dto/query-audit.dto';

export interface AuditLogEntry {
  id: string;
  projectId: string;
  eventType: string;
  severity: string;
  details: unknown;
  eventId: string | null;
  customerId: string | null;
  createdAt: Date;
}

export interface AuditSummary {
  total: number;
  byEventType: Array<{ eventType: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  periodDays: number;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
  ) {}

  /**
   * Write an audit log entry. Used internally by other services (e.g. EventsService)
   * to record guardrail trigger events.
   */
  async log(entry: {
    projectId: string;
    eventType: string;
    severity: 'info' | 'warning' | 'critical';
    details: Record<string, unknown>;
    eventId?: string;
    customerId?: string;
    actorId?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        projectId: entry.projectId,
        eventType: entry.eventType,
        severity: entry.severity,
        details: entry.details as Prisma.InputJsonValue,
        ...(entry.eventId !== undefined && { eventId: entry.eventId }),
        ...(entry.customerId !== undefined && { customerId: entry.customerId }),
        ...(entry.actorId !== undefined && { actorId: entry.actorId }),
      },
    });
  }

  /**
   * Query audit logs with filtering and pagination.
   * Requires the calling user to have access to the project.
   */
  async query(
    projectId: string,
    userId: string,
    dto: QueryAuditDto,
  ): Promise<{ logs: AuditLogEntry[]; total: number; page: number; limit: number }> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const days = dto.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      projectId,
      createdAt: { gte: since },
    };
    if (dto.eventType) where.eventType = dto.eventType;
    if (dto.severity) where.severity = dto.severity;
    if (dto.customerId) where.customerId = dto.customerId;

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

  /**
   * Get an aggregated summary of audit events: total count, breakdown by
   * event type, and breakdown by severity for the given time window.
   */
  async getSummary(
    projectId: string,
    userId: string,
    days: number = 30,
  ): Promise<AuditSummary> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const baseWhere = { projectId, createdAt: { gte: since } };

    const [byType, bySeverity, total] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['eventType'],
        where: baseWhere,
        _count: { id: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['severity'],
        where: baseWhere,
        _count: { id: true },
      }),
      this.prisma.auditLog.count({ where: baseWhere }),
    ]);

    return {
      total,
      byEventType: byType.map((g) => ({ eventType: g.eventType, count: g._count.id })),
      bySeverity: bySeverity.map((g) => ({ severity: g.severity, count: g._count.id })),
      periodDays: days,
    };
  }

}
