import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DsarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Export all data related to a customer (DSAR - Data Subject Access Request).
   * Returns LLMEvent, AuditLog, and ConsentRecord data for the customer.
   */
  async exportCustomerData(
    projectId: string,
    userId: string,
    customerId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const [events, auditLogs, consentRecords] = await Promise.all([
      this.prisma.lLMEvent.findMany({
        where: { projectId, customerId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.findMany({
        where: { projectId, customerId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.consentRecord.findMany({
        where: { projectId, customerId },
        orderBy: { grantedAt: 'desc' },
      }),
    ]);

    await this.auditService.log({
      projectId,
      eventType: 'dsar_export',
      severity: 'info',
      details: {
        customerId,
        eventsCount: events.length,
        auditLogsCount: auditLogs.length,
        consentRecordsCount: consentRecords.length,
      },
      customerId,
      actorId: userId,
    });

    return {
      customerId,
      events,
      auditLogs,
      consentRecords,
    };
  }

  /**
   * Delete all data related to a customer (right to erasure / right to be forgotten).
   * Removes LLMEvent and AuditLog records and revokes consent records.
   */
  async deleteCustomerData(
    projectId: string,
    userId: string,
    customerId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const [eventsResult, auditLogsResult, consentsResult] = await Promise.all([
      this.prisma.lLMEvent.deleteMany({
        where: { projectId, customerId },
      }),
      this.prisma.auditLog.deleteMany({
        where: { projectId, customerId },
      }),
      this.prisma.consentRecord.updateMany({
        where: {
          projectId,
          customerId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    await this.auditService.log({
      projectId,
      eventType: 'dsar_deletion',
      severity: 'warning',
      details: {
        customerId,
        eventsDeleted: eventsResult.count,
        auditLogsDeleted: auditLogsResult.count,
        consentsRevoked: consentsResult.count,
      },
      actorId: userId,
    });

    return {
      eventsDeleted: eventsResult.count,
      auditLogsDeleted: auditLogsResult.count,
      consentsRevoked: consentsResult.count,
    };
  }
}
