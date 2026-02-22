import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculatePerRequestCost,
  calculateCostPerUser,
  calculateMonthlyCost,
  calculateGrossMargin,
  assessRisk,
  simulateArchitectures,
} from '@aiecon/calculators';
import type { AdvisoryResponse } from '@aiecon/types';

const SYSTEM_PROMPT = `You are a financial advisor specializing in AI SaaS unit economics. You provide concise, actionable recommendations based on cost structures, margins, and architecture choices. Keep responses under 300 words. Use specific numbers from the data provided. Do not hedge or use vague language.`;

@Injectable()
export class AdvisoryService {
  private readonly logger = new Logger(AdvisoryService.name);
  private readonly client: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY is not configured — advisory feature will be unavailable');
    }
    this.client = new Anthropic({ apiKey: apiKey ?? '' });
  }

  async generateInsight(scenarioId: string): Promise<AdvisoryResponse> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new NotFoundException('AI advisory is not configured. Set ANTHROPIC_API_KEY in environment.');
    }

    const scenario = await this.prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) {
      throw new NotFoundException(`Scenario with id ${scenarioId} not found`);
    }

    const costPerRequest = calculatePerRequestCost(
      scenario.model,
      scenario.avgInputTokens,
      scenario.avgOutputTokens,
    );
    const costPerUser = calculateCostPerUser(costPerRequest, scenario.requestsPerUser);
    const monthlyCost = calculateMonthlyCost(
      costPerRequest,
      scenario.requestsPerUser,
      scenario.projectedUsers,
    );
    const grossMargin = calculateGrossMargin(scenario.subscriptionPrice, costPerUser);
    const riskLevel = assessRisk(grossMargin);

    const simulations = simulateArchitectures({
      avgInputTokens: scenario.avgInputTokens,
      avgOutputTokens: scenario.avgOutputTokens,
      requestsPerUser: scenario.requestsPerUser,
      projectedUsers: scenario.projectedUsers,
      subscriptionPrice: scenario.subscriptionPrice,
    });

    const simulationLines = simulations
      .map(
        (s) =>
          `- ${s.architectureName}: Margin ${s.grossMargin.toFixed(1)}%, Cost/User $${s.costPerUser.toFixed(4)}`,
      )
      .join('\n');

    const userPrompt = `Analyze the following AI feature economics:

Scenario: ${scenario.name}
Model: ${scenario.model}
Cost per Request: $${costPerRequest.toFixed(6)}
Cost per User/Month: $${costPerUser.toFixed(4)}
Monthly AI Cost (${scenario.projectedUsers.toLocaleString()} users): $${monthlyCost.toFixed(2)}
Subscription Price: $${scenario.subscriptionPrice}/month
Gross Margin: ${grossMargin.toFixed(2)}%
Risk Level: ${riskLevel}

Architecture Comparison:
${simulationLines}

Provide:
1. A one-sentence verdict on the current economics
2. The single most impactful change to improve margin
3. A recommended architecture with justification
4. A risk warning if margin is below 60%`;

    const message = await this.client.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const insight = textBlock && 'text' in textBlock ? textBlock.text : 'Unable to generate insight.';

    return {
      insight,
      generatedAt: new Date(),
    };
  }
}
