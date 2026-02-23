import { PromptCache } from './prompt-cache';

describe('PromptCache', () => {
  let cache: PromptCache;

  const sampleData = {
    content: 'You are helpful',
    managedPromptId: 'mp1',
    promptVersionId: 'pv1',
    version: 1,
  };

  beforeEach(() => {
    cache = new PromptCache();
  });

  it('set + get returns cached value', () => {
    cache.set('slug', sampleData, 60000);
    const result = cache.get('slug');
    expect(result).not.toBeNull();
    expect(result!.content).toBe('You are helpful');
    expect(result!.managedPromptId).toBe('mp1');
  });

  it('get returns null for missing key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('get returns null after TTL expires', () => {
    cache.set('slug', sampleData, 0); // expire immediately
    expect(cache.get('slug')).toBeNull();
  });

  it('set overwrites existing entry', () => {
    cache.set('slug', sampleData, 60000);
    cache.set('slug', { ...sampleData, content: 'Updated' }, 60000);
    expect(cache.get('slug')!.content).toBe('Updated');
  });

  it('invalidate removes specific key', () => {
    cache.set('a', sampleData, 60000);
    cache.set('b', sampleData, 60000);
    cache.invalidate('a');
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).not.toBeNull();
  });

  it('invalidateAll clears everything', () => {
    cache.set('a', sampleData, 60000);
    cache.set('b', sampleData, 60000);
    cache.invalidateAll();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
  });

  it('getStale returns expired entries', () => {
    cache.set('slug', sampleData, 0); // expire immediately
    expect(cache.get('slug')).toBeNull(); // normal get returns null
    const stale = cache.getStale('slug');
    expect(stale).not.toBeNull();
    expect(stale!.content).toBe('You are helpful');
  });
});
