import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderKeyService } from '../provider-key/provider-key.service';
import { LlmGatewayService } from './llm-gateway.service';
import { MODEL_PRICING, MODEL_PROVIDER, getModelProvider } from '@aiecon/calculators';
import type { PlaygroundResponse, PlaygroundModelResult, LLMProvider } from '@aiecon/types';

@Injectable()
export class PlaygroundService {
  private readonly platformAnthropicKey: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly llmGateway: LlmGatewayService,
    private readonly config: ConfigService,
  ) {
    this.platformAnthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
  }

  async testPrompt(
    userId: string,
    systemPrompt: string,
    userMessage: string,
    models: string[],
  ): Promise<PlaygroundResponse> {
    if (models.length === 0 || models.length > 3) {
      throw new BadRequestException(
        'Select between 1 and 3 models. Available models depend on which provider API keys you have configured in Settings.',
      );
    }

    for (const m of models) {
      if (!MODEL_PRICING[m]) {
        throw new BadRequestException(
          `Unknown model "${m}". Check the model name matches exactly (e.g., "gpt-4o", "claude-3-5-sonnet-latest"). ` +
          'See Settings > LLM Providers for available models.',
        );
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
    let usingPlatformCredits = false;
    for (const provider of providerModels.keys()) {
      const key = await this.providerKeyService.getDecryptedKey(orgId, provider);
      if (key) {
        providerKeys.set(provider, key);
      } else if (provider === 'anthropic' && this.platformAnthropicKey) {
        // Fallback to PlanForge's bundled Anthropic credits
        providerKeys.set(provider, this.platformAnthropicKey);
        usingPlatformCredits = true;
      } else {
        throw new BadRequestException(
          `No API key configured for "${provider}". ` +
          `Go to Settings → LLM Providers and add your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key. ` +
          `Get one at ${provider === 'openai' ? 'https://platform.openai.com/api-keys' : 'https://console.anthropic.com/settings/keys'}`,
        );
      }
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

  async getAvailableModels(userId: string): Promise<{ models: string[]; platformCredits: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.organizationId) return { models: [], platformCredits: false };

    const keys = await this.providerKeyService.listKeys(user.organizationId);
    const configuredProviders = new Set(keys.map((k) => k.provider));

    // If PlanForge has a platform Anthropic key and the org doesn't have their own,
    // include Anthropic models via bundled credits
    let platformCredits = false;
    if (!configuredProviders.has('anthropic') && this.platformAnthropicKey) {
      configuredProviders.add('anthropic');
      platformCredits = true;
    }

    const models = Object.entries(MODEL_PROVIDER)
      .filter(([, provider]) => configuredProviders.has(provider))
      .map(([model]) => model);

    return { models, platformCredits };
  }
}
