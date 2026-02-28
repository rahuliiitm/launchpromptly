import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { AuditService } from '../audit/audit.service';
import type { GrantConsentDto } from './dto/grant-consent.dto';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Grant consent for a customer under a specific policy version.
   */
  async grantConsent(
    projectId: string,
    userId: string,
    dto: GrantConsentDto,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const record = await this.prisma.consentRecord.create({
      data: {
        projectId,
        customerId: dto.customerId,
        policyVersion: dto.policyVersion,
        ...(dto.purpose !== undefined && { purpose: dto.purpose }),
      },
    });

    await this.auditService.log({
      projectId,
      eventType: 'consent_granted',
      severity: 'info',
      details: {
        consentId: record.id,
        customerId: dto.customerId,
        policyVersion: dto.policyVersion,
        purpose: dto.purpose ?? 'llm_processing',
      },
      customerId: dto.customerId,
      actorId: userId,
    });

    return record;
  }

  /**
   * Revoke all active consent records for a customer.
   */
  async revokeConsent(
    projectId: string,
    userId: string,
    customerId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const result = await this.prisma.consentRecord.updateMany({
      where: {
        projectId,
        customerId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.auditService.log({
      projectId,
      eventType: 'consent_revoked',
      severity: 'warning',
      details: {
        customerId,
        recordsRevoked: result.count,
      },
      customerId,
      actorId: userId,
    });

    return { customerId, recordsRevoked: result.count };
  }

  /**
   * Get active (non-revoked) consent records for a customer.
   */
  async getConsent(
    projectId: string,
    userId: string,
    customerId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    return this.prisma.consentRecord.findMany({
      where: {
        projectId,
        customerId,
        revokedAt: null,
      },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /**
   * List all consent records for a project with pagination.
   */
  async listConsents(
    projectId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const [records, total] = await Promise.all([
      this.prisma.consentRecord.findMany({
        where: { projectId },
        orderBy: { grantedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.consentRecord.count({ where: { projectId } }),
    ]);

    return { records, total, page, limit };
  }
}
