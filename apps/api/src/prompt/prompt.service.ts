import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { selectVariant } from '@aiecon/calculators';
import type { CreateManagedPromptDto } from './dto/create-managed-prompt.dto';
import type { UpdateManagedPromptDto } from './dto/update-managed-prompt.dto';
import type { CreatePromptVersionDto } from './dto/create-prompt-version.dto';
import type { CreateABTestDto } from './dto/create-ab-test.dto';

@Injectable()
export class PromptService {
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.anthropic = new Anthropic({ apiKey: apiKey ?? '' });
  }

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

  // ── A/B Testing ──

  async createABTest(
    projectId: string,
    promptId: string,
    userId: string,
    dto: CreateABTestDto,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const prompt = await this.prisma.managedPrompt.findFirst({
      where: { id: promptId, projectId },
    });
    if (!prompt) {
      throw new NotFoundException('Prompt not found');
    }

    // Validate traffic percentages sum to 100
    const totalPercent = dto.variants.reduce((sum, v) => sum + v.trafficPercent, 0);
    if (totalPercent !== 100) {
      throw new BadRequestException(
        `Traffic percentages must sum to 100, got ${totalPercent}`,
      );
    }

    // Validate all referenced versions exist and belong to this prompt
    for (const variant of dto.variants) {
      const version = await this.prisma.promptVersion.findFirst({
        where: { id: variant.promptVersionId, managedPromptId: promptId },
      });
      if (!version) {
        throw new NotFoundException(
          `Version ${variant.promptVersionId} not found for this prompt`,
        );
      }
    }

    // Check no other test is already running for this prompt
    const runningTest = await this.prisma.aBTest.findFirst({
      where: { managedPromptId: promptId, status: 'running' },
    });
    if (runningTest) {
      throw new ConflictException(
        'Another A/B test is already running for this prompt',
      );
    }

    return this.prisma.aBTest.create({
      data: {
        managedPromptId: promptId,
        name: dto.name,
        status: 'draft',
        variants: {
          create: dto.variants.map((v) => ({
            promptVersionId: v.promptVersionId,
            trafficPercent: v.trafficPercent,
          })),
        },
      },
      include: { variants: true },
    });
  }

  async startABTest(
    projectId: string,
    promptId: string,
    testId: string,
    userId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const test = await this.prisma.aBTest.findFirst({
      where: { id: testId, managedPromptId: promptId },
    });
    if (!test) {
      throw new NotFoundException('A/B test not found');
    }
    if (test.status !== 'draft') {
      throw new BadRequestException(
        `Cannot start test in "${test.status}" status — must be "draft"`,
      );
    }

    // Check no other test is already running
    const runningTest = await this.prisma.aBTest.findFirst({
      where: {
        managedPromptId: promptId,
        status: 'running',
        id: { not: testId },
      },
    });
    if (runningTest) {
      throw new ConflictException(
        'Another A/B test is already running for this prompt',
      );
    }

    return this.prisma.aBTest.update({
      where: { id: testId },
      data: { status: 'running', startedAt: new Date() },
      include: { variants: true },
    });
  }

  async stopABTest(
    projectId: string,
    promptId: string,
    testId: string,
    userId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const test = await this.prisma.aBTest.findFirst({
      where: { id: testId, managedPromptId: promptId },
    });
    if (!test) {
      throw new NotFoundException('A/B test not found');
    }
    if (test.status !== 'running') {
      throw new BadRequestException(
        `Cannot stop test in "${test.status}" status — must be "running"`,
      );
    }

    return this.prisma.aBTest.update({
      where: { id: testId },
      data: { status: 'completed', completedAt: new Date() },
      include: { variants: true },
    });
  }

  async getABTestResults(
    projectId: string,
    promptId: string,
    testId: string,
    userId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const test = await this.prisma.aBTest.findFirst({
      where: { id: testId, managedPromptId: promptId },
      include: {
        variants: {
          include: { promptVersion: true },
        },
      },
    });
    if (!test) {
      throw new NotFoundException('A/B test not found');
    }

    // Aggregate events per variant (by promptVersionId)
    const variantResults = await Promise.all(
      test.variants.map(async (variant) => {
        const agg = await this.prisma.lLMEvent.aggregate({
          where: {
            projectId,
            promptVersionId: variant.promptVersionId,
            createdAt: {
              ...(test.startedAt && { gte: test.startedAt }),
              ...(test.completedAt && { lte: test.completedAt }),
            },
          },
          _count: true,
          _sum: { costUsd: true },
          _avg: { latencyMs: true, costUsd: true },
        });

        return {
          variantId: variant.id,
          promptVersionId: variant.promptVersionId,
          version: variant.promptVersion.version,
          trafficPercent: variant.trafficPercent,
          callCount: agg._count,
          totalCostUsd: agg._sum.costUsd ?? 0,
          avgLatencyMs: agg._avg.latencyMs ?? 0,
          avgCostPerCall: agg._avg.costUsd ?? 0,
        };
      }),
    );

    return {
      ...test,
      results: variantResults,
    };
  }

  async resolvePrompt(
    projectId: string,
    slug: string,
    customerId?: string,
  ) {
    const prompt = await this.prisma.managedPrompt.findFirst({
      where: { projectId, slug },
      include: {
        abTests: {
          where: { status: 'running' },
          include: {
            variants: {
              include: { promptVersion: true },
            },
          },
          take: 1,
        },
        versions: {
          where: { status: 'active' },
          take: 1,
        },
      },
    });

    if (!prompt) {
      throw new NotFoundException(`Prompt "${slug}" not found`);
    }

    // Check for running A/B test first
    const runningTest = prompt.abTests[0];
    if (runningTest && runningTest.variants.length > 0) {
      const hashKey = customerId
        ? `${customerId}:${slug}`
        : `${Math.random()}:${slug}`;

      const selectedVariantId = selectVariant(
        runningTest.variants.map((v) => ({
          id: v.id,
          trafficPercent: v.trafficPercent,
        })),
        hashKey,
      );

      const selectedVariant = runningTest.variants.find((v) => v.id === selectedVariantId);
      if (selectedVariant) {
        return {
          content: selectedVariant.promptVersion.content,
          managedPromptId: prompt.id,
          promptVersionId: selectedVariant.promptVersionId,
          version: selectedVariant.promptVersion.version,
        };
      }
    }

    // No A/B test — use active version
    const activeVersion = prompt.versions[0];
    if (!activeVersion) {
      throw new NotFoundException('No active version for this prompt');
    }

    return {
      content: activeVersion.content,
      managedPromptId: prompt.id,
      promptVersionId: activeVersion.id,
      version: activeVersion.version,
    };
  }

  // ── Prompt Analytics ──

  async getPromptAnalytics(
    projectId: string,
    promptId: string,
    userId: string,
    days = 30,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const prompt = await this.prisma.managedPrompt.findFirst({
      where: { id: promptId, projectId },
      include: { versions: { select: { id: true, version: true, status: true } } },
    });
    if (!prompt) {
      throw new NotFoundException('Prompt not found');
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const analytics = await Promise.all(
      prompt.versions.map(async (ver) => {
        const agg = await this.prisma.lLMEvent.aggregate({
          where: {
            projectId,
            promptVersionId: ver.id,
            createdAt: { gte: since },
          },
          _count: true,
          _sum: { costUsd: true },
          _avg: { latencyMs: true, costUsd: true },
        });

        return {
          promptVersionId: ver.id,
          version: ver.version,
          status: ver.status,
          callCount: agg._count,
          totalCostUsd: agg._sum.costUsd ?? 0,
          avgLatencyMs: agg._avg.latencyMs ?? 0,
          avgCostPerCall: agg._avg.costUsd ?? 0,
        };
      }),
    );

    return analytics;
  }

  async getPromptTimeSeries(
    projectId: string,
    promptId: string,
    userId: string,
    days = 30,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const prompt = await this.prisma.managedPrompt.findFirst({
      where: { id: promptId, projectId },
      include: { versions: { select: { id: true, version: true } } },
    });
    if (!prompt) {
      throw new NotFoundException('Prompt not found');
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await this.prisma.lLMEvent.groupBy({
      by: ['promptVersionId', 'createdAt'],
      where: {
        projectId,
        promptVersionId: { in: prompt.versions.map((v) => v.id) },
        createdAt: { gte: since },
      },
      _count: true,
      _sum: { costUsd: true },
    });

    // Build a version lookup
    const versionMap = new Map(prompt.versions.map((v) => [v.id, v.version]));

    // Group by date and version
    const seriesMap = new Map<string, Map<number, { costUsd: number; callCount: number }>>();
    for (const event of events) {
      const dateKey = event.createdAt.toISOString().slice(0, 10);
      const versionNum = versionMap.get(event.promptVersionId!) ?? 0;

      if (!seriesMap.has(dateKey)) {
        seriesMap.set(dateKey, new Map());
      }
      const dayMap = seriesMap.get(dateKey)!;
      const existing = dayMap.get(versionNum) ?? { costUsd: 0, callCount: 0 };
      dayMap.set(versionNum, {
        costUsd: existing.costUsd + (event._sum.costUsd ?? 0),
        callCount: existing.callCount + event._count,
      });
    }

    // Convert to array format
    const timeSeries = Array.from(seriesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, versions]) => ({
        date,
        versions: Array.from(versions.entries()).map(([version, data]) => ({
          version,
          ...data,
        })),
      }));

    return timeSeries;
  }

  // ── Prompt Optimization ──

  async generateOptimizedVersion(
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

    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return {
        message: 'AI optimization unavailable (ANTHROPIC_API_KEY not set)',
        version: null,
      };
    }

    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Rewrite this system prompt to be more concise and effective while preserving all instructions and meaning. Reduce token count where possible. Return ONLY the optimized prompt, no explanations.\n\nOriginal prompt:\n${version.content}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const optimizedContent =
      textBlock && 'text' in textBlock ? textBlock.text : version.content;

    // Auto-increment version
    const maxVersion = await this.prisma.promptVersion.aggregate({
      where: { managedPromptId: promptId },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    const newVersion = await this.prisma.promptVersion.create({
      data: {
        managedPromptId: promptId,
        version: nextVersion,
        content: optimizedContent,
        status: 'draft',
      },
    });

    return { message: 'Optimized version created', version: newVersion };
  }
}
