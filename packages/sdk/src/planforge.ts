import { EventBatcher } from './batcher';
import { calculateEventCost, fingerprintMessages } from '@aiecon/calculators';
import type {
  PlanForgeOptions,
  WrapOptions,
  ChatCompletionCreateParams,
  ChatCompletion,
} from './types';
import type { IngestEventPayload } from '@aiecon/types';

const DEFAULT_ENDPOINT = 'https://api.planforge.dev';

type CreateFn = (params: ChatCompletionCreateParams) => Promise<ChatCompletion>;

export class PlanForge {
  private readonly batcher: EventBatcher;

  constructor(options: PlanForgeOptions) {
    this.batcher = new EventBatcher(
      options.apiKey,
      options.endpoint ?? DEFAULT_ENDPOINT,
      options.flushAt ?? 10,
      options.flushInterval ?? 5000,
    );
  }

  wrap<T extends object>(client: T, options: WrapOptions = {}): T {
    const batcher = this.batcher;
    const customerFn = options.customer;
    const featureTag = options.feature;

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
