import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

interface ApiKeyInfo {
  id: string;
  projectId: string;
  environmentId: string | null;
  keyPrefix: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

interface CreateApiKeyResult {
  apiKey: ApiKeyInfo;
  rawKey: string;
}

interface ProjectInfo {
  id: string;
  organizationId: string;
  name: string;
  createdAt: Date;
}

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async listProjects(userId: string): Promise<ProjectInfo[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: { include: { projects: true } } },
    });
    if (!user?.organization) return [];
    return user.organization.projects;
  }

  async assertProjectAccess(projectId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          include: { projects: { where: { id: projectId } } },
        },
      },
    });
    if (!user?.organization?.projects.length) {
      throw new ForbiddenException('Access denied to this project');
    }
  }

  async listApiKeys(projectId: string, userId: string): Promise<ApiKeyInfo[]> {
    await this.assertProjectAccess(projectId, userId);
    return this.prisma.apiKey.findMany({
      where: { projectId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        keyPrefix: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });
  }

  async generateApiKey(
    projectId: string,
    userId: string,
    name: string,
    environmentId?: string,
  ): Promise<CreateApiKeyResult> {
    await this.assertProjectAccess(projectId, userId);

    // Auto-default to the first environment if none specified
    let envId = environmentId;
    if (!envId) {
      const defaultEnv = await this.prisma.environment.findFirst({
        where: { projectId },
        orderBy: { sortOrder: 'asc' },
      });
      envId = defaultEnv?.id;
    }

    const rawKey = `lp_live_${randomBytes(32).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 16);
    const keyHash = await bcrypt.hash(rawKey, 10);

    const created = await this.prisma.apiKey.create({
      data: { projectId, keyHash, keyPrefix, name, ...(envId && { environmentId: envId }) },
    });

    return {
      apiKey: {
        id: created.id,
        projectId: created.projectId,
        environmentId: created.environmentId,
        keyPrefix: created.keyPrefix,
        name: created.name,
        createdAt: created.createdAt,
        lastUsedAt: created.lastUsedAt,
        revokedAt: created.revokedAt,
      },
      rawKey,
    };
  }

  async revokeApiKey(
    projectId: string,
    keyId: string,
    userId: string,
  ): Promise<void> {
    await this.assertProjectAccess(projectId, userId);
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, projectId },
    });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
  }
}
