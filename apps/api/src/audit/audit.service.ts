import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
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
   * to record security-relevant events.
   * After creation, computes a SHA-256 hash chain linking to the previous entry.
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
    const created = await this.prisma.auditLog.create({
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

    // Find the previous log entry for this project (excluding the one just created)
    const previous = await this.prisma.auditLog.findFirst({
      where: {
        projectId: entry.projectId,
        id: { not: created.id },
      },
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });

    const prevHash = previous?.hash ?? 'GENESIS';
    const hashInput = `${created.id}|${created.projectId}|${created.eventType}|${created.severity}|${JSON.stringify(created.details)}|${prevHash}`;
    const hash = createHash('sha256').update(hashInput).digest('hex');

    await this.prisma.auditLog.update({
      where: { id: created.id },
      data: { hash, prevHash },
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

  /**
   * Verify the integrity of the audit log hash chain for a project.
   * Walks the most recent `limit` entries and verifies each hash matches
   * the expected computed value.
   */
  async verifyIntegrity(
    projectId: string,
    userId: string,
    limit: number = 100,
  ): Promise<{ verified: number; valid: boolean; firstInvalidId?: string }> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const entries = await this.prisma.auditLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        projectId: true,
        eventType: true,
        severity: true,
        details: true,
        hash: true,
        prevHash: true,
      },
    });

    let verified = 0;

    for (const entry of entries) {
      if (!entry.hash) {
        // Entry created before hash chain was implemented; skip
        verified++;
        continue;
      }

      const prevHash = entry.prevHash ?? 'GENESIS';
      const hashInput = `${entry.id}|${entry.projectId}|${entry.eventType}|${entry.severity}|${JSON.stringify(entry.details)}|${prevHash}`;
      const expectedHash = createHash('sha256').update(hashInput).digest('hex');

      if (expectedHash !== entry.hash) {
        return { verified, valid: false, firstInvalidId: entry.id };
      }

      verified++;
    }

    return { verified, valid: true };
  }
}
