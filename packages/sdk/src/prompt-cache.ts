interface CacheEntry {
  content: string;
  managedPromptId: string;
  promptVersionId: string;
  version: number;
  expiresAt: number;
}

export class PromptCache {
  private cache = new Map<string, CacheEntry>();

  get(slug: string): CacheEntry | null {
    const entry = this.cache.get(slug);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) return null;
    return entry;
  }

  /** Returns entry even if expired (for stale-while-error fallback) */
  getStale(slug: string): CacheEntry | null {
    return this.cache.get(slug) ?? null;
  }

  set(
    slug: string,
    data: { content: string; managedPromptId: string; promptVersionId: string; version: number },
    ttlMs: number,
  ): void {
    this.cache.set(slug, {
      ...data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(slug: string): void {
    this.cache.delete(slug);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}
