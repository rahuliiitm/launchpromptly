import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Enforce data retention policy for all projects.
   * Deletes LLMEvent rows older than project.retentionDays and
   * AuditLog rows older than 2x retentionDays.
   */
  async enforceRetention(): Promise<void> {
    const projects = await this.prisma.project.findMany({
      select: { id: true, retentionDays: true },
    });

    for (const project of projects) {
      await this.enforceRetentionForProject(project.id, project.retentionDays);
    }
  }

  /**
   * Enforce retention for a single project.
   */
  async enforceRetentionForProject(
    projectId: string,
    retentionDays?: number,
  ): Promise<{ eventsDeleted: number; auditLogsDeleted: number }> {
    let days = retentionDays;
    if (days === undefined) {
      const project = await this.prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { retentionDays: true },
      });
      days = project.retentionDays;
    }

    const eventCutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const auditCutoff = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000);

    const eventsResult = await this.prisma.lLMEvent.deleteMany({
      where: {
        projectId,
        createdAt: { lt: eventCutoff },
      },
    });

    const auditResult = await this.prisma.auditLog.deleteMany({
      where: {
        projectId,
        createdAt: { lt: auditCutoff },
      },
    });

    await this.auditService.log({
      projectId,
      eventType: 'retention_enforced',
      severity: 'info',
      details: {
        retentionDays: days,
        eventsDeleted: eventsResult.count,
        auditLogsDeleted: auditResult.count,
        eventCutoff: eventCutoff.toISOString(),
        auditCutoff: auditCutoff.toISOString(),
      },
    });

    return {
      eventsDeleted: eventsResult.count,
      auditLogsDeleted: auditResult.count,
    };
  }

  /**
   * Get the retention configuration for a project.
   */
  async getRetentionConfig(
    projectId: string,
    userId: string,
  ): Promise<{ projectId: string; retentionDays: number }> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, retentionDays: true },
    });

    return { projectId: project.id, retentionDays: project.retentionDays };
  }

  /**
   * Update the retention configuration for a project.
   */
  async updateRetentionConfig(
    projectId: string,
    userId: string,
    days: number,
  ): Promise<{ projectId: string; retentionDays: number }> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { retentionDays: days },
      select: { id: true, retentionDays: true },
    });

    await this.auditService.log({
      projectId,
      eventType: 'retention_config_updated',
      severity: 'info',
      details: { retentionDays: days },
      actorId: userId,
    });

    return { projectId: project.id, retentionDays: project.retentionDays };
  }
}
