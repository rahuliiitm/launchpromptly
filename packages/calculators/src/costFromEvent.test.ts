import { calculateEventCost } from './costFromEvent';

describe('calculateEventCost', () => {
  it('should calculate cost for a known OpenAI model', () => {
    // gpt-4o: input=0.0025/1K, output=0.01/1K
    const cost = calculateEventCost('openai', 'gpt-4o', 1000, 500);
    expect(cost).toBeCloseTo(0.0025 + 0.005, 6);
  });

  it('should calculate cost for a known Anthropic model', () => {
    // claude-3-5-haiku-latest: input=0.0008/1K, output=0.004/1K
    const cost = calculateEventCost('anthropic', 'claude-3-5-haiku-latest', 2000, 1000);
    expect(cost).toBeCloseTo(0.0016 + 0.004, 6);
  });

  it('should return 0 for an unknown model', () => {
    const cost = calculateEventCost('openai', 'nonexistent-model', 1000, 500);
    expect(cost).toBe(0);
  });

  it('should return 0 for zero tokens', () => {
    const cost = calculateEventCost('openai', 'gpt-4o', 0, 0);
    expect(cost).toBe(0);
  });

  it('should handle legacy gpt-4 model pricing', () => {
    // gpt-4: input=0.01/1K, output=0.03/1K
    const cost = calculateEventCost('openai', 'gpt-4', 1000, 500);
    expect(cost).toBeCloseTo(0.01 + 0.015, 6);
  });

  it('should calculate correctly for large token counts', () => {
    // gpt-4o-mini: input=0.00015/1K, output=0.0006/1K
    const cost = calculateEventCost('openai', 'gpt-4o-mini', 100000, 50000);
    expect(cost).toBeCloseTo(0.015 + 0.03, 6);
  });

  it('should accept provider argument without error', () => {
    expect(() => calculateEventCost('anthropic', 'gpt-4o', 100, 100)).not.toThrow();
  });
});
