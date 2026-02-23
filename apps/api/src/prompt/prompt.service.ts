import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import type { CreateManagedPromptDto } from './dto/create-managed-prompt.dto';
import type { UpdateManagedPromptDto } from './dto/update-managed-prompt.dto';
import type { CreatePromptVersionDto } from './dto/create-prompt-version.dto';

@Injectable()
export class PromptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
  ) {}

  async createPrompt(
    projectId: string,
    userId: string,
    dto: CreateManagedPromptDto,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    try {
      if (dto.initialContent) {
        return await this.prisma.$transaction(async (tx) => {
          const prompt = await tx.managedPrompt.create({
            data: {
              projectId,
              slug: dto.slug,
              name: dto.name,
              description: dto.description ?? '',
            },
          });
          const version = await tx.promptVersion.create({
            data: {
              managedPromptId: prompt.id,
              version: 1,
              content: dto.initialContent!,
              status: 'draft',
            },
          });
          return { ...prompt, versions: [version] };
        });
      }

      return await this.prisma.managedPrompt.create({
        data: {
          projectId,
          slug: dto.slug,
          name: dto.name,
          description: dto.description ?? '',
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(`Slug "${dto.slug}" already exists in this project`);
      }
      throw error;
    }
  }

  async listPrompts(projectId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    return this.prisma.managedPrompt.findMany({
      where: { projectId },
      include: {
        versions: {
          where: { status: 'active' },
          take: 1,
        },
        _count: { select: { versions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPrompt(projectId: string, promptId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const prompt = await this.prisma.managedPrompt.findFirst({
      where: { id: promptId, projectId },
      include: {
        versions: { orderBy: { version: 'desc' } },
      },
    });

    if (!prompt) {
      throw new NotFoundException('Prompt not found');
    }

    return prompt;
  }

  async updatePrompt(
    projectId: string,
    promptId: string,
    userId: string,
    dto: UpdateManagedPromptDto,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const existing = await this.prisma.managedPrompt.findFirst({
      where: { id: promptId, projectId },
    });
    if (!existing) {
      throw new NotFoundException('Prompt not found');
    }

    try {
      return await this.prisma.managedPrompt.update({
        where: { id: promptId },
        data: {
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(`Slug "${dto.slug}" already exists in this project`);
      }
      throw error;
    }
  }

  async deletePrompt(projectId: string, promptId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const existing = await this.prisma.managedPrompt.findFirst({
      where: { id: promptId, projectId },
    });
    if (!existing) {
      throw new NotFoundException('Prompt not found');
    }

    await this.prisma.managedPrompt.delete({ where: { id: promptId } });
    return { deleted: true };
  }

  async createVersion(
    projectId: string,
    promptId: string,
    userId: string,
    dto: CreatePromptVersionDto,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const prompt = await this.prisma.managedPrompt.findFirst({
      where: { id: promptId, projectId },
    });
    if (!prompt) {
      throw new NotFoundException('Prompt not found');
    }

    const maxVersion = await this.prisma.promptVersion.aggregate({
      where: { managedPromptId: promptId },
      _max: { version: true },
    });

    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    return this.prisma.promptVersion.create({
      data: {
        managedPromptId: promptId,
        version: nextVersion,
        content: dto.content,
        status: 'draft',
      },
    });
  }

  async deployVersion(
    projectId: string,
    promptId: string,
    versionId: string,
    userId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const version = await this.prisma.promptVersion.findFirst({
      where: { id: versionId, managedPromptId: promptId },
    });
    if (!version) {
      throw new NotFoundException('Version not found');
    }
    if (version.status === 'active') {
      throw new BadRequestException('Version is already active');
    }

    return this.prisma.$transaction(async (tx) => {
      // Archive current active version
      await tx.promptVersion.updateMany({
        where: { managedPromptId: promptId, status: 'active' },
        data: { status: 'archived' },
      });

      // Activate target version
      return tx.promptVersion.update({
        where: { id: versionId },
        data: { status: 'active' },
      });
    });
  }

  async rollbackVersion(projectId: string, promptId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const prompt = await this.prisma.managedPrompt.findFirst({
      where: { id: promptId, projectId },
    });
    if (!prompt) {
      throw new NotFoundException('Prompt not found');
    }

    const lastArchived = await this.prisma.promptVersion.findFirst({
      where: { managedPromptId: promptId, status: 'archived' },
      orderBy: { updatedAt: 'desc' },
    });

    if (!lastArchived) {
      throw new BadRequestException('No archived versions to rollback to');
    }

    return this.prisma.$transaction(async (tx) => {
      // Archive current active
      await tx.promptVersion.updateMany({
        where: { managedPromptId: promptId, status: 'active' },
        data: { status: 'archived' },
      });

      // Re-activate the last archived
      return tx.promptVersion.update({
        where: { id: lastArchived.id },
        data: { status: 'active' },
      });
    });
  }

  async promoteTemplate(
    projectId: string,
    templateHash: string,
    userId: string,
    slug: string,
    name: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const template = await this.prisma.promptTemplate.findUnique({
      where: { projectId_systemHash: { projectId, systemHash: templateHash } },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const prompt = await tx.managedPrompt.create({
          data: {
            projectId,
            slug,
            name,
            sourceTemplateId: template.id,
          },
        });
        const version = await tx.promptVersion.create({
          data: {
            managedPromptId: prompt.id,
            version: 1,
            content: template.normalizedContent,
            status: 'draft',
          },
        });
        return { ...prompt, versions: [version] };
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(`Slug "${slug}" already exists in this project`);
      }
      throw error;
    }
  }
}
