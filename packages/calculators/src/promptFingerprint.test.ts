import { normalizePrompt, hashPrompt, fingerprintMessages } from './promptFingerprint';

describe('normalizePrompt', () => {
  it('should replace UUIDs with placeholder', () => {
    const text = 'User 550e8400-e29b-41d4-a716-446655440000 requested access';
    expect(normalizePrompt(text)).toBe('User <UUID> requested access');
  });

  it('should replace ISO dates with placeholder', () => {
    const text = 'Created on 2025-01-15T14:30:00Z';
    expect(normalizePrompt(text)).toBe('Created on <DATE>');
  });

  it('should replace emails with placeholder', () => {
    const text = 'Contact user@example.com for details';
    expect(normalizePrompt(text)).toBe('Contact <EMAIL> for details');
  });

  it('should replace long numbers with placeholder', () => {
    const text = 'Order #12345 is ready';
    expect(normalizePrompt(text)).toBe('Order #<NUM> is ready');
  });

  it('should replace URLs with placeholder', () => {
    const text = 'Visit https://example.com/page?id=123 for info';
    expect(normalizePrompt(text)).toBe('Visit <URL> for info');
  });

  it('should normalize whitespace', () => {
    const text = 'Hello   world\n\nfoo';
    expect(normalizePrompt(text)).toBe('Hello world foo');
  });

  it('should be idempotent', () => {
    const text = 'User 550e8400-e29b-41d4-a716-446655440000 at user@test.com';
    const once = normalizePrompt(text);
    const twice = normalizePrompt(once);
    expect(once).toBe(twice);
  });

  it('should produce same output for prompts differing only by variable data', () => {
    const a = normalizePrompt('Order 550e8400-e29b-41d4-a716-446655440000 for user@a.com');
    const b = normalizePrompt('Order 660e8400-e29b-41d4-a716-446655440001 for user@b.com');
    expect(a).toBe(b);
  });
});

describe('hashPrompt', () => {
  it('should return a 64-char hex string', () => {
    const hash = hashPrompt('test prompt');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should return the same hash for the same input', () => {
    expect(hashPrompt('hello')).toBe(hashPrompt('hello'));
  });

  it('should return different hashes for different inputs', () => {
    expect(hashPrompt('hello')).not.toBe(hashPrompt('world'));
  });
});

describe('fingerprintMessages', () => {
  it('should return null systemHash when no system prompt is provided', () => {
    const result = fingerprintMessages([
      { role: 'user', content: 'Hello' },
    ]);
    expect(result.systemHash).toBeNull();
    expect(result.normalizedSystem).toBeNull();
  });

  it('should return non-null systemHash when system prompt is provided', () => {
    const result = fingerprintMessages(
      [{ role: 'user', content: 'Hello' }],
      'You are a helpful assistant.',
    );
    expect(result.systemHash).not.toBeNull();
    expect(result.normalizedSystem).toBe('You are a helpful assistant.');
  });

  it('should always return a fullHash', () => {
    const result = fingerprintMessages([
      { role: 'user', content: 'Hello' },
    ]);
    expect(result.fullHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should truncate promptPreview to 200 chars', () => {
    const longMessage = 'x'.repeat(300);
    const result = fingerprintMessages([
      { role: 'user', content: longMessage },
    ]);
    expect(result.promptPreview.length).toBe(200);
  });

  it('should produce same systemHash for same system prompt with different user messages', () => {
    const a = fingerprintMessages(
      [{ role: 'user', content: 'Question 1' }],
      'You are a bot.',
    );
    const b = fingerprintMessages(
      [{ role: 'user', content: 'Question 2' }],
      'You are a bot.',
    );
    expect(a.systemHash).toBe(b.systemHash);
    expect(a.fullHash).not.toBe(b.fullHash);
  });
});
