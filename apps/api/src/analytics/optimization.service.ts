import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import type { OptimizationRecommendation } from '@aiecon/types';
import { MODEL_PRICING } from '@aiecon/calculators';

const EXPENSIVE_MODELS: Record<string, string> = {
  'gpt-4o': 'gpt-4o-mini',
  'gpt-4': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4o-mini',
  'claude-3-opus-20240229': 'claude-3-5-haiku-latest',
  'claude-3-5-sonnet-20241022': 'claude-3-5-haiku-latest',
  'o1': 'o3-mini',
};

@Injectable()
export class OptimizationService {
  private readonly client: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.client = new Anthropic({ apiKey: apiKey ?? '' });
  }

  async getRecommendations(
    projectId: string,
    userId: string,
  ): Promise<OptimizationRecommendation[]> {
    await this.projectService.assertProjectAccess(projectId, userId);
    const recommendations: OptimizationRecommendation[] = [];
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Rule 1: Model downgrade opportunities
    const modelGroups = await this.prisma.lLMEvent.groupBy({
      by: ['model'],
      where: { projectId, createdAt: { gte: since } },
      _sum: { costUsd: true },
      _count: { id: true },
    });

    for (const group of modelGroups) {
      const suggestedModel = EXPENSIVE_MODELS[group.model];
      if (!suggestedModel) continue;

      const currentPricing = MODEL_PRICING[group.model];
      const suggestedPricing = MODEL_PRICING[suggestedModel];
      if (!currentPricing || !suggestedPricing) continue;

      const currentAvgCost = currentPricing.input + currentPricing.output;
      const suggestedAvgCost = suggestedPricing.input + suggestedPricing.output;
      const savingsRatio = 1 - suggestedAvgCost / currentAvgCost;
      const estimatedSavingsUsd = (group._sum.costUsd ?? 0) * savingsRatio;

      if (estimatedSavingsUsd > 0.01) {
        recommendations.push({
          type: 'model_downgrade',
          title: `Switch ${group.model} to ${suggestedModel}`,
          description: `${group._count.id} calls use ${group.model}. Switching to ${suggestedModel} could save ~$${estimatedSavingsUsd.toFixed(2)}/month with similar quality for most tasks.`,
          estimatedSavingsUsd,
          affectedTemplateHash: null,
          currentModel: group.model,
          suggestedModel,
        });
      }
    }

    // Rule 2: Verbose prompt detection (avg input tokens > 4000)
    const verboseTemplates = await this.prisma.lLMEvent.groupBy({
      by: ['systemHash'],
      where: { projectId, createdAt: { gte: since }, systemHash: { not: null } },
      _avg: { inputTokens: true },
      _sum: { costUsd: true },
      _count: { id: true },
    });

    for (const tmpl of verboseTemplates) {
      if (!tmpl.systemHash) continue;
      if ((tmpl._avg.inputTokens ?? 0) <= 4000) continue;

      const estimatedSavingsUsd = (tmpl._sum.costUsd ?? 0) * 0.3;
      recommendations.push({
        type: 'verbose_prompt',
        title: 'Verbose prompt template detected',
        description: `Template ${tmpl.systemHash.slice(0, 8)}... averages ${Math.round(tmpl._avg.inputTokens ?? 0)} input tokens across ${tmpl._count.id} calls. Compressing the system prompt could reduce costs by ~30%.`,
        estimatedSavingsUsd,
        affectedTemplateHash: tmpl.systemHash,
        currentModel: null,
        suggestedModel: null,
      });
    }

    // Rule 3: Caching opportunity (high repeat rate)
    const repeatGroups = await this.prisma.lLMEvent.groupBy({
      by: ['systemHash'],
      where: { projectId, createdAt: { gte: since }, systemHash: { not: null } },
      _count: { id: true },
      _sum: { costUsd: true },
    });

    for (const group of repeatGroups) {
      if (!group.systemHash) continue;
      if (group._count.id <= 100) continue;

      const estimatedSavingsUsd = (group._sum.costUsd ?? 0) * 0.5;
      recommendations.push({
        type: 'caching_opportunity',
        title: 'High-frequency prompt — consider semantic caching',
        description: `Template ${group.systemHash.slice(0, 8)}... was called ${group._count.id} times. Implementing prompt caching could cut costs by ~50%.`,
        estimatedSavingsUsd,
        affectedTemplateHash: group.systemHash,
        currentModel: null,
        suggestedModel: null,
      });
    }

    return recommendations.sort((a, b) => b.estimatedSavingsUsd - a.estimatedSavingsUsd);
  }

  async analyzeTemplateWithClaude(
    projectId: string,
    userId: string,
    systemHash: string,
  ): Promise<string> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const template = await this.prisma.promptTemplate.findUnique({
      where: { projectId_systemHash: { projectId, systemHash } },
    });

    if (!template) return 'Template not found.';

    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) return 'AI analysis unavailable (ANTHROPIC_API_KEY not set).';

    const message = await this.client.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Analyze this system prompt template and suggest specific ways to reduce token count while preserving meaning. Be concrete and brief (under 200 words).\n\nTemplate:\n${template.normalizedContent}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    return textBlock && 'text' in textBlock ? textBlock.text : 'Unable to analyze.';
  }
}
