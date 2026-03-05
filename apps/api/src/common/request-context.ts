import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  method?: string;
  url?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Get the current request ID (or 'no-request' if outside a request). */
export function getRequestId(): string {
  return requestContext.getStore()?.requestId ?? 'no-request';
}
