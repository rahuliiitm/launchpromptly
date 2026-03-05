import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { AuditService } from '../audit/audit.service';
import type { CreatePolicyDto } from './dto/create-policy.dto';
import type { UpdatePolicyDto } from './dto/update-policy.dto';

@Injectable()
export class SecurityPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly auditService: AuditService,
  ) {}

  async create(projectId: string, userId: string, dto: CreatePolicyDto) {
    await this.projectService.assertProjectAccess(projectId, userId);

    // Enforce single active policy constraint
    if (dto.isActive !== false) {
      const existing = await this.prisma.securityPolicy.findFirst({
        where: { projectId, isActive: true },
      });
      if (existing) {
        throw new ConflictException(
          `Another policy "${existing.name}" is currently active. Please deactivate it before activating a new one.`,
        );
      }
    }

    try {
      const policy = await this.prisma.securityPolicy.create({
        data: {
          projectId,
          name: dto.name,
          description: dto.description ?? '',
          rules: dto.rules as Prisma.InputJsonValue,
          isActive: dto.isActive ?? false,
        },
      });

      await this.auditService.log({
        projectId,
        eventType: 'policy_created',
        severity: 'info',
        details: {
          policyId: policy.id,
          name: policy.name,
          rules: dto.rules,
        },
        actorId: userId,
      });

      return policy;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          `Policy name "${dto.name}" already exists in this project`,
        );
      }
      throw error;
    }
  }

  async findAll(projectId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    return this.prisma.securityPolicy.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(projectId: string, userId: string, policyId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const policy = await this.prisma.securityPolicy.findFirst({
      where: { id: policyId, projectId },
    });

    if (!policy) {
      throw new NotFoundException('Security policy not found');
    }

    return policy;
  }

  async update(
    projectId: string,
    userId: string,
    policyId: string,
    dto: UpdatePolicyDto,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const existing = await this.prisma.securityPolicy.findFirst({
      where: { id: policyId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Security policy not found');
    }

    // Enforce single active policy constraint
    if (dto.isActive === true && !existing.isActive) {
      const activePolicy = await this.prisma.securityPolicy.findFirst({
        where: { projectId, isActive: true },
      });
      if (activePolicy) {
        throw new ConflictException(
          `Another policy "${activePolicy.name}" is currently active. Please deactivate it before activating a new one.`,
        );
      }
    }

    try {
      const updated = await this.prisma.securityPolicy.update({
        where: { id: policyId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.rules !== undefined && { rules: dto.rules as Prisma.InputJsonValue }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      await this.auditService.log({
        projectId,
        eventType: 'policy_updated',
        severity: 'info',
        details: {
          policyId,
          before: { name: existing.name, rules: existing.rules },
          after: { name: updated.name, rules: updated.rules },
        },
        actorId: userId,
      });

      return updated;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          `Policy name "${dto.name}" already exists in this project`,
        );
      }
      throw error;
    }
  }

  async remove(projectId: string, userId: string, policyId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const existing = await this.prisma.securityPolicy.findFirst({
      where: { id: policyId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Security policy not found');
    }

    await this.prisma.securityPolicy.delete({ where: { id: policyId } });

    await this.auditService.log({
      projectId,
      eventType: 'policy_deleted',
      severity: 'warning',
      details: {
        policyId,
        name: existing.name,
      },
      actorId: userId,
    });

    return { deleted: true };
  }

  async getActivePolicy(projectId: string) {
    const policy = await this.prisma.securityPolicy.findFirst({
      where: { projectId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    return policy ?? null;
  }
}
