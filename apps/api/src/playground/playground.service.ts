import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderKeyService } from '../provider-key/provider-key.service';
import { LlmGatewayService } from './llm-gateway.service';
import { MODEL_PRICING, MODEL_PROVIDER, getModelProvider } from '@aiecon/calculators';
import type { PlaygroundResponse, PlaygroundModelResult, LLMProvider } from '@aiecon/types';

@Injectable()
export class PlaygroundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly llmGateway: LlmGatewayService,
  ) {}

  async testPrompt(
    userId: string,
    systemPrompt: string,
    userMessage: string,
    models: string[],
  ): Promise<PlaygroundResponse> {
    if (models.length === 0 || models.length > 3) {
      throw new BadRequestException('Select between 1 and 3 models');
    }

    for (const m of models) {
      if (!MODEL_PRICING[m]) {
        throw new BadRequestException(`Unknown model: ${m}`);
      }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.organizationId) {
      throw new ForbiddenException('User is not part of an organization');
    }
    const orgId = user.organizationId;

    // Group models by provider and fetch keys
    const providerModels = new Map<LLMProvider, string[]>();
    for (const m of models) {
      const provider = getModelProvider(m);
      const existing = providerModels.get(provider) ?? [];
      existing.push(m);
      providerModels.set(provider, existing);
    }

    const providerKeys = new Map<LLMProvider, string>();
    for (const provider of providerModels.keys()) {
      const key = await this.providerKeyService.getDecryptedKey(orgId, provider);
      if (!key) {
        throw new BadRequestException(
          `No API key configured for ${provider}. Add one in Settings > LLM Providers.`,
        );
      }
      providerKeys.set(provider, key);
    }

    // Fire all model calls in parallel
    const promises = models.map((model) => {
      const provider = getModelProvider(model);
      const apiKey = providerKeys.get(provider)!;
      return this.llmGateway.callModel(provider, apiKey, model, systemPrompt, userMessage);
    });

    const settled = await Promise.allSettled(promises);
    const results: PlaygroundModelResult[] = settled.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        model: models[i],
        provider: MODEL_PROVIDER[models[i]] as LLMProvider,
        response: '',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        error: (result.reason as Error).message,
      };
    });

    return { results };
  }

  async getAvailableModels(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.organizationId) return [];

    const keys = await this.providerKeyService.listKeys(user.organizationId);
    const configuredProviders = new Set(keys.map((k) => k.provider));

    return Object.entries(MODEL_PROVIDER)
      .filter(([, provider]) => configuredProviders.has(provider))
      .map(([model]) => model);
  }
}
