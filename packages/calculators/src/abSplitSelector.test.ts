import { selectVariant, type SplitVariant } from './abSplitSelector';

describe('selectVariant', () => {
  const twoWay: SplitVariant[] = [
    { id: 'A', trafficPercent: 70 },
    { id: 'B', trafficPercent: 30 },
  ];

  it('should return a valid variant id', () => {
    const result = selectVariant(twoWay, 'test-key');
    expect(['A', 'B']).toContain(result);
  });

  it('should be deterministic for same input', () => {
    const r1 = selectVariant(twoWay, 'user-42:my-prompt');
    const r2 = selectVariant(twoWay, 'user-42:my-prompt');
    expect(r1).toBe(r2);
  });

  it('should handle single variant (100%)', () => {
    const single: SplitVariant[] = [{ id: 'only', trafficPercent: 100 }];
    expect(selectVariant(single, 'anything')).toBe('only');
  });

  it('should handle three-way split', () => {
    const threeWay: SplitVariant[] = [
      { id: 'X', trafficPercent: 50 },
      { id: 'Y', trafficPercent: 30 },
      { id: 'Z', trafficPercent: 20 },
    ];
    const result = selectVariant(threeWay, 'some-key');
    expect(['X', 'Y', 'Z']).toContain(result);
  });

  it('should distribute approximately correctly over many inputs', () => {
    const counts: Record<string, number> = { A: 0, B: 0 };
    for (let i = 0; i < 1000; i++) {
      const variant = selectVariant(twoWay, `customer-${i}:slug`);
      counts[variant]!++;
    }
    // 70/30 split — allow 10% tolerance
    expect(counts['A']!).toBeGreaterThan(600);
    expect(counts['A']!).toBeLessThan(800);
    expect(counts['B']!).toBeGreaterThan(200);
    expect(counts['B']!).toBeLessThan(400);
  });

  it('should throw for empty variants array', () => {
    expect(() => selectVariant([], 'key')).toThrow('must not be empty');
  });

  it('should throw when percentages do not sum to 100', () => {
    const bad: SplitVariant[] = [
      { id: 'A', trafficPercent: 60 },
      { id: 'B', trafficPercent: 30 },
    ];
    expect(() => selectVariant(bad, 'key')).toThrow('must sum to 100');
  });

  it('should produce different results for different keys', () => {
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(selectVariant(twoWay, `unique-key-${i}`));
    }
    // With 50 different keys and 70/30 split, we should see both variants
    expect(results.size).toBe(2);
  });
});
