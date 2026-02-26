import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import type { CreateEnvironmentDto } from './dto/create-environment.dto';
import type { UpdateEnvironmentDto } from './dto/update-environment.dto';

export interface EnvironmentWithKeyInfo {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
  isCritical: boolean;
  evalGateEnabled: boolean;
  createdAt: Date;
  sdkKeyPrefix?: string;
  sdkKey?: string; // raw key, only returned at creation
}

@Injectable()
export class EnvironmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
  ) {}

  /**
   * Create default environments (Production + Development) for a new project.
   * Also auto-generates one SDK key per environment.
   */
  async createDefaultEnvironments(projectId: string): Promise<void> {
    const defaults = [
      { name: 'Production', slug: 'production', color: '#059669', sortOrder: 0, isCritical: true },
      { name: 'Development', slug: 'development', color: '#6366F1', sortOrder: 1, isCritical: false },
    ];

    for (const env of defaults) {
      const created = await this.prisma.environment.create({
        data: { projectId, ...env },
      });
      await this.generateSdkKeyForEnvironment(projectId, created.id, `Default - ${env.name}`);
    }
  }

  async listEnvironments(projectId: string, userId: string): Promise<EnvironmentWithKeyInfo[]> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const environments = await this.prisma.environment.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
      include: {
        apiKeys: {
          where: { revokedAt: null },
          select: { keyPrefix: true },
          take: 1,
        },
      },
    });

    return environments.map((env) => ({
      id: env.id,
      projectId: env.projectId,
      name: env.name,
      slug: env.slug,
      color: env.color,
      sortOrder: env.sortOrder,
      isCritical: env.isCritical,
      evalGateEnabled: env.evalGateEnabled,
      createdAt: env.createdAt,
      sdkKeyPrefix: env.apiKeys[0]?.keyPrefix ?? undefined,
    }));
  }

  async createEnvironment(
    projectId: string,
    userId: string,
    dto: CreateEnvironmentDto,
  ): Promise<EnvironmentWithKeyInfo> {
    await this.projectService.assertProjectAccess(projectId, userId);

    // Check slug uniqueness
    const existing = await this.prisma.environment.findUnique({
      where: { projectId_slug: { projectId, slug: dto.slug } },
    });
    if (existing) {
      throw new ConflictException(`Environment with slug "${dto.slug}" already exists`);
    }

    // Determine next sort order
    const maxOrder = await this.prisma.environment.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const env = await this.prisma.environment.create({
      data: {
        projectId,
        name: dto.name,
        slug: dto.slug,
        color: dto.color ?? '#6B7280',
        sortOrder: nextOrder,
      },
    });

    // Auto-generate SDK key
    const rawKey = await this.generateSdkKeyForEnvironment(projectId, env.id, `Default - ${dto.name}`);

    return {
      id: env.id,
      projectId: env.projectId,
      name: env.name,
      slug: env.slug,
      color: env.color,
      sortOrder: env.sortOrder,
      isCritical: env.isCritical,
      evalGateEnabled: env.evalGateEnabled,
      createdAt: env.createdAt,
      sdkKeyPrefix: rawKey.slice(0, 16),
      sdkKey: rawKey, // shown once
    };
  }

  async updateEnvironment(
    projectId: string,
    envId: string,
    userId: string,
    dto: UpdateEnvironmentDto,
  ): Promise<EnvironmentWithKeyInfo> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const env = await this.prisma.environment.findFirst({
      where: { id: envId, projectId },
    });
    if (!env) throw new NotFoundException('Environment not found');

    const updated = await this.prisma.environment.update({
      where: { id: envId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isCritical !== undefined && { isCritical: dto.isCritical }),
        ...(dto.evalGateEnabled !== undefined && { evalGateEnabled: dto.evalGateEnabled }),
      },
    });

    return {
      id: updated.id,
      projectId: updated.projectId,
      name: updated.name,
      slug: updated.slug,
      color: updated.color,
      sortOrder: updated.sortOrder,
      isCritical: updated.isCritical,
      evalGateEnabled: updated.evalGateEnabled,
      createdAt: updated.createdAt,
    };
  }

  async deleteEnvironment(projectId: string, envId: string, userId: string): Promise<void> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const env = await this.prisma.environment.findFirst({
      where: { id: envId, projectId },
    });
    if (!env) throw new NotFoundException('Environment not found');

    // Guard: cannot delete if deployments exist
    const deploymentCount = await this.prisma.promptDeployment.count({
      where: { environmentId: envId },
    });
    if (deploymentCount > 0) {
      throw new BadRequestException(
        `Cannot delete environment "${env.name}" — ${deploymentCount} prompt(s) are deployed to it. ` +
        'Undeploy all prompts from this environment first.',
      );
    }

    // Guard: cannot delete the last environment
    const envCount = await this.prisma.environment.count({ where: { projectId } });
    if (envCount <= 1) {
      throw new BadRequestException('Cannot delete the last environment in a project');
    }

    // Revoke all API keys for this environment
    await this.prisma.apiKey.updateMany({
      where: { environmentId: envId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.environment.delete({ where: { id: envId } });
  }

  async resetSdkKey(
    projectId: string,
    envId: string,
    userId: string,
  ): Promise<{ sdkKey: string; sdkKeyPrefix: string }> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const env = await this.prisma.environment.findFirst({
      where: { id: envId, projectId },
    });
    if (!env) throw new NotFoundException('Environment not found');

    // Revoke current keys
    await this.prisma.apiKey.updateMany({
      where: { environmentId: envId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Generate new key
    const rawKey = await this.generateSdkKeyForEnvironment(projectId, envId, `Default - ${env.name}`);
    return { sdkKey: rawKey, sdkKeyPrefix: rawKey.slice(0, 16) };
  }

  private async generateSdkKeyForEnvironment(
    projectId: string,
    environmentId: string,
    name: string,
  ): Promise<string> {
    const rawKey = `lp_live_${randomBytes(32).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 16);
    const keyHash = await bcrypt.hash(rawKey, 10);

    await this.prisma.apiKey.create({
      data: { projectId, environmentId, keyHash, keyPrefix, name },
    });

    return rawKey;
  }
}
