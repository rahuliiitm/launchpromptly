import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { TeamService } from '../team/team.service';
import { selectVariant, MODEL_PRICING, calculatePerRequestCost } from '@aiecon/calculators';
import type { CreateManagedPromptDto } from './dto/create-managed-prompt.dto';
import type { UpdateManagedPromptDto } from './dto/update-managed-prompt.dto';
import type { CreatePromptVersionDto } from './dto/create-prompt-version.dto';
import type { CreateABTestDto } from './dto/create-ab-test.dto';
import type { PromptAnalysis } from '@aiecon/types';
import { extractTemplateVariables } from './template-utils';

@Injectable()
export class PromptService {
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly teamService: TeamService,
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

    // If assigning to a team, verify editor+ access
    if (dto.teamId) {
      await this.teamService.assertTeamRole(dto.teamId, userId, 'editor');
    }

    try {
      if (dto.initialContent) {
        return await this.prisma.$transaction(async (tx) => {
          const prompt = await tx.managedPrompt.create({
            data: {
              projectId,
              slug: dto.slug,
              name: dto.name,
              description: dto.description ?? '',
              ...(dto.teamId && { teamId: dto.teamId }),
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
          ...(dto.teamId && { teamId: dto.teamId }),
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

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Org admin sees all; org member sees own teams + unassigned
    let where: any = { projectId };
    if (user?.role !== 'admin') {
      const memberships = await this.prisma.teamMember.findMany({
        where: { userId },
        select: { teamId: true },
      });
      const teamIds = memberships.map((m) => m.teamId);
      where = {
        projectId,
        OR: [
          { teamId: null },
          ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
        ],
      };
    }

    return this.prisma.managedPrompt.findMany({
      where,
      include: {
        versions: {
          where: { status: 'active' },
          take: 1,
        },
        _count: { select: { versions: true } },
        team: { select: { id: true, name: true, slug: true, color: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPrompt(projectId: string, promptId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'viewer');

    const prompt = await this.prisma.managedPrompt.findFirst({
      where: { id: promptId, projectId },
      include: {
        versions: { orderBy: { version: 'desc' } },
        abTests: {
          include: { variants: true },
          orderBy: { createdAt: 'desc' },
        },
        deployments: {
          include: {
            environment: true,
            promptVersion: true,
          },
          orderBy: { environment: { sortOrder: 'asc' } },
        },
        team: { select: { id: true, name: true, slug: true, color: true } },
      },
    });

    if (!prompt) {
      throw new NotFoundException('Prompt not found');
    }

    return {
      ...prompt,
      deployments: prompt.deployments.map((d) => ({
        id: d.id,
        environmentId: d.environmentId,
        environmentName: d.environment.name,
        environmentSlug: d.environment.slug,
        environmentColor: d.environment.color,
        promptVersionId: d.promptVersionId,
        version: d.promptVersion.version,
        deployedAt: d.deployedAt.toISOString(),
        deployedBy: d.deployedBy,
      })),
    };
  }

  async updatePrompt(
    projectId: string,
    promptId: string,
    userId: string,
    dto: UpdateManagedPromptDto,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'editor');

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
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'lead');

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
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'editor');

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

  // ── Environment Deployments ──

  async deployToEnvironment(
    projectId: string,
    promptId: string,
    versionId: string,
    environmentId: string,
    userId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    // Check environment first to determine required team role
    const envForRole = await this.prisma.environment.findFirst({
      where: { id: environmentId, projectId },
    });
    const requiredRole = envForRole?.isCritical ? 'lead' : 'editor';
    await this.teamService.assertPromptTeamAccess(promptId, userId, requiredRole as any);

    const version = await this.prisma.promptVersion.findFirst({
      where: { id: versionId, managedPromptId: promptId },
    });
    if (!version) throw new NotFoundException('Version not found');

    const env = await this.prisma.environment.findFirst({
      where: { id: environmentId, projectId },
    });
    if (!env) throw new NotFoundException('Environment not found');

    // Eval gate: environments with evalGateEnabled require a passing eval
    if (env.evalGateEnabled) {
      const hasDatasets = await this.prisma.evalDataset.count({
        where: { managedPromptId: promptId },
      });
      if (hasDatasets > 0) {
        const passingRun = await this.prisma.evalRun.findFirst({
          where: {
            promptVersionId: versionId,
            passed: true,
            dataset: { managedPromptId: promptId },
          },
        });
        if (!passingRun) {
          throw new BadRequestException(
            `Cannot deploy to "${env.name}" — eval gate is enabled and no passing evaluation exists for this version. ` +
            'Run an eval on this version first, or disable the eval gate on this environment.',
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Upsert deployment (one version per prompt per environment)
      const deployment = await tx.promptDeployment.upsert({
        where: {
          managedPromptId_environmentId: { managedPromptId: promptId, environmentId },
        },
        create: {
          managedPromptId: promptId,
          environmentId,
          promptVersionId: versionId,
          deployedBy: userId,
        },
        update: {
          promptVersionId: versionId,
          deployedAt: new Date(),
          deployedBy: userId,
        },
        include: {
          environment: true,
          promptVersion: true,
        },
      });

      // If version was draft, mark as active
      if (version.status === 'draft') {
        await tx.promptVersion.update({
          where: { id: versionId },
          data: { status: 'active' },
        });
      }

      return {
        id: deployment.id,
        environmentId: deployment.environmentId,
        environmentName: deployment.environment.name,
        environmentSlug: deployment.environment.slug,
        environmentColor: deployment.environment.color,
        promptVersionId: deployment.promptVersionId,
        version: deployment.promptVersion.version,
        deployedAt: deployment.deployedAt.toISOString(),
        deployedBy: deployment.deployedBy,
      };
    });
  }

  async promoteVersion(
    projectId: string,
    promptId: string,
    sourceEnvId: string,
    targetEnvId: string,
    userId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const sourceDeployment = await this.prisma.promptDeployment.findUnique({
      where: {
        managedPromptId_environmentId: { managedPromptId: promptId, environmentId: sourceEnvId },
      },
    });
    if (!sourceDeployment) {
      throw new NotFoundException('No deployment found in source environment');
    }

    const targetEnv = await this.prisma.environment.findFirst({
      where: { id: targetEnvId, projectId },
    });
    if (!targetEnv) throw new NotFoundException('Target environment not found');

    return this.deployToEnvironment(
      projectId,
      promptId,
      sourceDeployment.promptVersionId,
      targetEnvId,
      userId,
    );
  }

  async getDeployments(projectId: string, promptId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const deployments = await this.prisma.promptDeployment.findMany({
      where: { managedPromptId: promptId },
      include: {
        environment: true,
        promptVersion: true,
      },
      orderBy: { environment: { sortOrder: 'asc' } },
    });

    return deployments.map((d) => ({
      id: d.id,
      environmentId: d.environmentId,
      environmentName: d.environment.name,
      environmentSlug: d.environment.slug,
      environmentColor: d.environment.color,
      promptVersionId: d.promptVersionId,
      version: d.promptVersion.version,
      deployedAt: d.deployedAt.toISOString(),
      deployedBy: d.deployedBy,
    }));
  }

  async undeployFromEnvironment(
    projectId: string,
    promptId: string,
    environmentId: string,
    userId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const deployment = await this.prisma.promptDeployment.findUnique({
      where: {
        managedPromptId_environmentId: { managedPromptId: promptId, environmentId },
      },
    });
    if (!deployment) {
      throw new NotFoundException('No deployment found for this environment');
    }

    await this.prisma.promptDeployment.delete({ where: { id: deployment.id } });
    return { undeployed: true };
  }

  async getDeploymentUsageStats(projectId: string, promptId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const environments = await this.prisma.environment.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });

    const deployments = await this.prisma.promptDeployment.findMany({
      where: { managedPromptId: promptId },
      include: { promptVersion: true },
    });
    const deploymentByEnv = new Map(deployments.map((d) => [d.environmentId, d]));

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const stats = await Promise.all(
      environments.map(async (env) => {
        const deployment = deploymentByEnv.get(env.id);

        // 24h stats
        const agg24h = await this.prisma.lLMEvent.aggregate({
          where: {
            projectId,
            managedPromptId: promptId,
            environmentId: env.id,
            createdAt: { gte: oneDayAgo },
          },
          _count: true,
          _sum: { costUsd: true },
          _avg: { latencyMs: true },
        });

        // 1h stats (for "is it live?" check)
        const agg1h = await this.prisma.lLMEvent.aggregate({
          where: {
            projectId,
            managedPromptId: promptId,
            environmentId: env.id,
            createdAt: { gte: oneHourAgo },
          },
          _count: true,
        });

        // Most recent event
        const lastEvent = await this.prisma.lLMEvent.findFirst({
          where: {
            projectId,
            managedPromptId: promptId,
            environmentId: env.id,
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        return {
          environmentId: env.id,
          environmentName: env.name,
          environmentColor: env.color,
          promptVersionId: deployment?.promptVersionId ?? null,
          version: deployment?.promptVersion.version ?? null,
          callCount24h: agg24h._count,
          callCount1h: agg1h._count,
          totalCostUsd24h: agg24h._sum.costUsd ?? 0,
          avgLatencyMs: agg24h._avg.latencyMs ?? 0,
          lastCalledAt: lastEvent?.createdAt.toISOString() ?? null,
        };
      }),
    );

    return stats;
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
    environmentId?: string,
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
        ...(environmentId && {
          deployments: {
            where: { environmentId },
            include: {
              promptVersion: true,
              environment: true,
            },
            take: 1,
          },
        }),
      },
    });

    if (!prompt) {
      throw new NotFoundException(`Prompt "${slug}" not found`);
    }

    // 1. Check for running A/B test first (global priority)
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
        const content = selectedVariant.promptVersion.content;
        const variables = extractTemplateVariables(content);
        return {
          content,
          managedPromptId: prompt.id,
          promptVersionId: selectedVariant.promptVersionId,
          version: selectedVariant.promptVersion.version,
          ...(variables.length > 0 && { variables }),
        };
      }
    }

    // 2. Environment-based deployment (if environmentId present)
    if (environmentId && (prompt as any).deployments?.length > 0) {
      const deployment = (prompt as any).deployments[0];
      const content = deployment.promptVersion.content;
      const variables = extractTemplateVariables(content);
      return {
        content,
        managedPromptId: prompt.id,
        promptVersionId: deployment.promptVersionId,
        version: deployment.promptVersion.version,
        environment: deployment.environment.slug,
        ...(variables.length > 0 && { variables }),
      };
    }

    // 3. Legacy fallback — use active version (for keys without environmentId)
    const activeVersion = prompt.versions[0];
    if (!activeVersion) {
      throw new NotFoundException('No active version for this prompt');
    }

    const content = activeVersion.content;
    const variables = extractTemplateVariables(content);
    return {
      content,
      managedPromptId: prompt.id,
      promptVersionId: activeVersion.id,
      version: activeVersion.version,
      ...(variables.length > 0 && { variables }),
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
        message:
          'AI optimization requires an Anthropic API key. ' +
          'Add ANTHROPIC_API_KEY to your .env file. ' +
          'Get one at https://console.anthropic.com/settings/keys',
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

  // ── Team Assignment ──

  async assignTeam(projectId: string, promptId: string, userId: string, teamId: string | null) {
    await this.projectService.assertProjectAccess(projectId, userId);

    // Only org administrators can assign/transfer prompts between teams
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'admin') {
      throw new ForbiddenException('Only org administrators can assign prompts to teams');
    }

    const prompt = await this.prisma.managedPrompt.findFirst({
      where: { id: promptId, projectId },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');

    // Validate the target team exists in this project
    if (teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: teamId, projectId },
      });
      if (!team) throw new NotFoundException('Team not found');
    }

    return this.prisma.managedPrompt.update({
      where: { id: promptId },
      data: { teamId },
      include: { team: { select: { id: true, name: true, slug: true, color: true } } },
    });
  }

  // ── Standalone Prompt Analysis ──

  async analyzePrompt(content: string, model?: string): Promise<PromptAnalysis> {
    const targetModel = model && MODEL_PRICING[model] ? model : 'gpt-4o';
    const words = content.split(/\s+/).filter(Boolean).length;
    const originalTokenEstimate = Math.ceil(words / 0.75);

    // Estimate cost: assume output is ~half of input for a typical call
    const originalCostPerCall = calculatePerRequestCost(
      targetModel,
      originalTokenEstimate,
      Math.ceil(originalTokenEstimate / 2),
    );

    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return {
        originalTokenEstimate,
        originalCostPerCall,
        optimizedContent: null,
        analysis:
          'AI-powered analysis requires an Anthropic API key. ' +
          'Add ANTHROPIC_API_KEY to your .env file. ' +
          'Get one at https://console.anthropic.com/settings/keys',
        optimizedTokenEstimate: null,
        optimizedCostPerCall: null,
        tokenSavings: null,
        costSavings: null,
        model: targetModel,
      };
    }

    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a prompt engineering expert. Analyze and optimize this prompt.

1. First, rewrite it to be more concise and effective while preserving ALL instructions and meaning. Reduce token count.
2. Then provide a brief analysis (2-3 sentences) of what you changed and why.

Return your response in this exact format:
---OPTIMIZED---
[the optimized prompt here]
---ANALYSIS---
[your analysis here]

Original prompt:
${content}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const responseText = textBlock && 'text' in textBlock ? textBlock.text : null;

    if (!responseText) {
      return {
        originalTokenEstimate,
        originalCostPerCall,
        optimizedContent: null,
        analysis: null,
        optimizedTokenEstimate: null,
        optimizedCostPerCall: null,
        tokenSavings: null,
        costSavings: null,
        model: targetModel,
      };
    }

    // Parse structured response
    const optimizedMatch = responseText.match(/---OPTIMIZED---\s*([\s\S]*?)\s*---ANALYSIS---/);
    const analysisMatch = responseText.match(/---ANALYSIS---\s*([\s\S]*)/);

    const optimizedContent = optimizedMatch?.[1]?.trim() ?? responseText;
    const analysis = analysisMatch?.[1]?.trim() ?? null;

    const optimizedWords = optimizedContent.split(/\s+/).filter(Boolean).length;
    const optimizedTokenEstimate = Math.ceil(optimizedWords / 0.75);
    const optimizedCostPerCall = calculatePerRequestCost(
      targetModel,
      optimizedTokenEstimate,
      Math.ceil(optimizedTokenEstimate / 2),
    );

    return {
      originalTokenEstimate,
      originalCostPerCall,
      optimizedContent,
      analysis,
      optimizedTokenEstimate,
      optimizedCostPerCall,
      tokenSavings: originalTokenEstimate - optimizedTokenEstimate,
      costSavings: originalCostPerCall - optimizedCostPerCall,
      model: targetModel,
    };
  }
}
