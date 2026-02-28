import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { AuditService } from '../audit/audit.service';
import type { CreateIncidentDto } from './dto/create-incident.dto';
import type { UpdateIncidentDto } from './dto/update-incident.dto';
import type { QueryIncidentDto } from './dto/query-incident.dto';

const ALERT_SEVERITY_MAP: Record<string, string> = {
  injection_blocked: 'critical',
  pii_threshold: 'high',
  cost_exceeded: 'medium',
  content_violation: 'high',
};

@Injectable()
export class IncidentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly auditService: AuditService,
  ) {}

  async create(projectId: string, userId: string, dto: CreateIncidentDto) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const incident = await this.prisma.securityIncident.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description ?? '',
        severity: dto.severity ?? 'medium',
        source: dto.source ?? 'manual',
        metadata: (dto.metadata ?? null) as Prisma.InputJsonValue,
        assigneeId: dto.assigneeId ?? null,
      },
    });

    await this.auditService.log({
      projectId,
      eventType: 'incident_created',
      severity: 'info',
      details: {
        incidentId: incident.id,
        title: incident.title,
        severity: incident.severity,
        source: incident.source,
      },
      actorId: userId,
    });

    return incident;
  }

  async findAll(projectId: string, userId: string, query: QueryIncidentDto) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const days = query.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      projectId,
      createdAt: { gte: since },
    };
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;

    const [incidents, total] = await Promise.all([
      this.prisma.securityIncident.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.securityIncident.count({ where }),
    ]);

    return { incidents, total, page, limit };
  }

  async findOne(projectId: string, userId: string, incidentId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const incident = await this.prisma.securityIncident.findFirst({
      where: { id: incidentId, projectId },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return incident;
  }

  async update(
    projectId: string,
    userId: string,
    incidentId: string,
    dto: UpdateIncidentDto,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const existing = await this.prisma.securityIncident.findFirst({
      where: { id: incidentId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Incident not found');
    }

    // If status changes to 'resolved', set resolvedAt
    const resolvedAt =
      dto.status === 'resolved' && existing.status !== 'resolved'
        ? new Date()
        : undefined;

    const updated = await this.prisma.securityIncident.update({
      where: { id: incidentId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.severity !== undefined && { severity: dto.severity }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.metadata !== undefined && {
          metadata: dto.metadata as Prisma.InputJsonValue,
        }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
        ...(resolvedAt !== undefined && { resolvedAt }),
      },
    });

    await this.auditService.log({
      projectId,
      eventType: 'incident_updated',
      severity: 'info',
      details: {
        incidentId,
        before: {
          title: existing.title,
          status: existing.status,
          severity: existing.severity,
          assigneeId: existing.assigneeId,
        },
        after: {
          title: updated.title,
          status: updated.status,
          severity: updated.severity,
          assigneeId: updated.assigneeId,
        },
      },
      actorId: userId,
    });

    return updated;
  }

  async remove(projectId: string, userId: string, incidentId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const existing = await this.prisma.securityIncident.findFirst({
      where: { id: incidentId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Incident not found');
    }

    await this.prisma.securityIncident.delete({ where: { id: incidentId } });

    await this.auditService.log({
      projectId,
      eventType: 'incident_deleted',
      severity: 'warning',
      details: {
        incidentId,
        title: existing.title,
        severity: existing.severity,
      },
      actorId: userId,
    });

    return { deleted: true };
  }

  async getSummary(projectId: string, userId: string, days?: number) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const periodDays = days ?? 30;
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const baseWhere = { projectId, createdAt: { gte: since } };

    const [total, byStatus, bySeverityGroups] = await Promise.all([
      this.prisma.securityIncident.count({ where: baseWhere }),
      this.prisma.securityIncident.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { id: true },
      }),
      this.prisma.securityIncident.groupBy({
        by: ['severity'],
        where: baseWhere,
        _count: { id: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const g of byStatus) {
      statusMap[g.status] = g._count.id;
    }

    const severityMap: Record<string, number> = {};
    for (const g of bySeverityGroups) {
      severityMap[g.severity] = g._count.id;
    }

    return {
      total,
      open: statusMap['open'] ?? 0,
      investigating: statusMap['investigating'] ?? 0,
      resolved: statusMap['resolved'] ?? 0,
      closed: statusMap['closed'] ?? 0,
      bySeverity: {
        low: severityMap['low'] ?? 0,
        medium: severityMap['medium'] ?? 0,
        high: severityMap['high'] ?? 0,
        critical: severityMap['critical'] ?? 0,
      },
    };
  }

  async autoCreateFromAlert(
    projectId: string,
    alertName: string,
    eventData: Record<string, unknown>,
  ) {
    const severity = ALERT_SEVERITY_MAP[alertName] ?? 'medium';

    const incident = await this.prisma.securityIncident.create({
      data: {
        projectId,
        title: `Auto-detected: ${alertName}`,
        description: `Automatically created incident from alert "${alertName}".`,
        severity,
        source: 'auto',
        metadata: eventData as Prisma.InputJsonValue,
      },
    });

    await this.auditService.log({
      projectId,
      eventType: 'incident_created',
      severity: 'warning',
      details: {
        incidentId: incident.id,
        title: incident.title,
        severity: incident.severity,
        source: 'auto',
        alertName,
      },
    });

    return incident;
  }
}
