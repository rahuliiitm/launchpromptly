import { EventBatcher } from './batcher';
import { PromptCache } from './prompt-cache';
import { calculateEventCost, fingerprintMessages } from '@aiecon/calculators';
import type {
  PlanForgeOptions,
  WrapOptions,
  ChatCompletionCreateParams,
  ChatCompletion,
} from './types';
import type { IngestEventPayload } from '@aiecon/types';

const DEFAULT_ENDPOINT = 'https://api.planforge.dev';
const DEFAULT_PROMPT_CACHE_TTL = 60000; // 60 seconds

type CreateFn = (params: ChatCompletionCreateParams) => Promise<ChatCompletion>;

export class PromptNotFoundError extends Error {
  constructor(slug: string) {
    super(`Prompt "${slug}" not found`);
    this.name = 'PromptNotFoundError';
  }
}

export class PlanForge {
  private readonly batcher: EventBatcher;
  private readonly promptCache: PromptCache;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly promptCacheTtl: number;
  /** Maps content hash → { managedPromptId, promptVersionId } for event metadata injection */
  private readonly resolvedPrompts = new Map<
    string,
    { managedPromptId: string; promptVersionId: string }
  >();

  constructor(options: PlanForgeOptions = {}) {
    const resolvedKey = options.apiKey
      || (typeof process !== 'undefined' && process.env?.PLANFORGE_API_KEY)
      || (typeof process !== 'undefined' && process.env?.PF_API_KEY)
      || '';

    if (!resolvedKey) {
      throw new Error(
        'PlanForge API key not found. Either:\n' +
        '  1. Pass it directly: new PlanForge({ apiKey: "pf_live_..." })\n' +
        '  2. Set PLANFORGE_API_KEY environment variable\n' +
        '  3. Set PF_API_KEY environment variable\n' +
        'Get your key from Settings → Environments in the PlanForge dashboard.',
      );
    }

    this.apiKey = resolvedKey;
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.promptCacheTtl = options.promptCacheTtl ?? DEFAULT_PROMPT_CACHE_TTL;
    this.promptCache = new PromptCache();
    this.batcher = new EventBatcher(
      options.apiKey,
      this.endpoint,
      options.flushAt ?? 10,
      options.flushInterval ?? 5000,
    );
  }

  async prompt(slug: string, options?: { customerId?: string }): Promise<string> {
    // Check cache first
    const cached = this.promptCache.get(slug);
    if (cached) {
      return cached.content;
    }

    // Fetch from API
    const queryParams = options?.customerId
      ? `?customerId=${encodeURIComponent(options.customerId)}`
      : '';
    const url = `${this.endpoint}/v1/prompts/resolve/${encodeURIComponent(slug)}${queryParams}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (response.status === 404) {
        // 404 is authoritative — no stale fallback
        throw new PromptNotFoundError(slug);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        content: string;
        managedPromptId: string;
        promptVersionId: string;
        version: number;
      };

      // Cache the result
      this.promptCache.set(slug, data, this.promptCacheTtl);

      // Store for event metadata injection
      this.resolvedPrompts.set(data.content, {
        managedPromptId: data.managedPromptId,
        promptVersionId: data.promptVersionId,
      });

      return data.content;
    } catch (error) {
      // On PromptNotFoundError, always throw
      if (error instanceof PromptNotFoundError) {
        throw error;
      }

      // On network error, try stale cache
      const stale = this.promptCache.getStale(slug);
      if (stale) {
        return stale.content;
      }

      throw error;
    }
  }

  wrap<T extends object>(client: T, options: WrapOptions = {}): T {
    const batcher = this.batcher;
    const customerFn = options.customer;
    const featureTag = options.feature;
    const traceIdTag = options.traceId;
    const spanNameTag = options.spanName;
    const resolvedPrompts = this.resolvedPrompts;

    return new Proxy(client, {
      get(target, prop) {
        const value = Reflect.get(target, prop);

        if (prop === 'chat') {
          return new Proxy(value as object, {
            get(_chatTarget, chatProp) {
              const chatValue = Reflect.get(value as object, chatProp);
              if (chatProp === 'completions') {
                return new Proxy(chatValue as object, {
                  get(_compTarget, compProp) {
                    const compValue = Reflect.get(chatValue as object, compProp);
                    if (compProp === 'create') {
                      return async (
                        params: ChatCompletionCreateParams,
                      ): Promise<ChatCompletion> => {
                        const startMs = Date.now();
                        const result = await (compValue as CreateFn).call(
                          chatValue,
                          params,
                        );
                        const latencyMs = Date.now() - startMs;

                        void (async () => {
                          try {
                            const usage = result.usage;
                            if (!usage) return;

                            const inputTokens = usage.prompt_tokens;
                            const outputTokens = usage.completion_tokens;
                            const totalTokens = usage.total_tokens;
                            const costUsd = calculateEventCost(
                              'openai',
                              params.model,
                              inputTokens,
                              outputTokens,
                            );

                            const systemMsg = params.messages.find(
                              (m) => m.role === 'system',
                            );
                            const nonSystem = params.messages.filter(
                              (m) => m.role !== 'system',
                            );
                            const fingerprint = fingerprintMessages(
                              nonSystem,
                              systemMsg?.content,
                            );

                            let customerId: string | undefined;
                            let feature: string | undefined = featureTag;

                            if (customerFn) {
                              const ctx = await customerFn();
                              customerId = ctx.id;
                              feature = ctx.feature ?? featureTag;
                            }

                            // Check if system message matches a resolved managed prompt
                            const promptMeta = systemMsg?.content
                              ? resolvedPrompts.get(systemMsg.content)
                              : undefined;

                            const event: IngestEventPayload = {
                              provider: 'openai',
                              model: params.model,
                              inputTokens,
                              outputTokens,
                              totalTokens,
                              costUsd,
                              latencyMs,
                              customerId,
                              feature,
                              systemHash: fingerprint.systemHash ?? undefined,
                              fullHash: fingerprint.fullHash,
                              promptPreview: fingerprint.promptPreview,
                              statusCode: 200,
                              managedPromptId: promptMeta?.managedPromptId,
                              promptVersionId: promptMeta?.promptVersionId,
                              traceId: traceIdTag,
                              spanName: spanNameTag,
                            };

                            batcher.enqueue(event);
                          } catch {
                            // SDK must never throw
                          }
                        })();

                        return result;
                      };
                    }
                    return typeof compValue === 'function'
                      ? (compValue as Function).bind(chatValue)
                      : compValue;
                  },
                });
              }
              return typeof chatValue === 'function'
                ? (chatValue as Function).bind(value)
                : chatValue;
            },
          });
        }

        return typeof value === 'function'
          ? (value as Function).bind(target)
          : value;
      },
    }) as T;
  }

  async flush(): Promise<void> {
    await this.batcher.flush();
  }

  destroy(): void {
    this.batcher.destroy();
  }
}
