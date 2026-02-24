export interface CustomerContext {
  id: string;
  feature?: string;
}

export interface PlanForgeOptions {
  apiKey: string;
  endpoint?: string;
  flushAt?: number;
  flushInterval?: number;
  promptCacheTtl?: number;
}

export interface WrapOptions {
  customer?: () => CustomerContext | Promise<CustomerContext>;
  feature?: string;
  traceId?: string;
  spanName?: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatCompletionCreateParams {
  model: string;
  messages: ChatMessage[];
  [key: string]: unknown;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletion {
  usage?: ChatCompletionUsage;
  [key: string]: unknown;
}
