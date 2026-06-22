import { describe, expect, it } from 'vitest';
import {
  detectCycles,
  excludeCyclicEdges,
  fuzzyEmailSuggestion,
  isPastDueGoLive,
  normalizeEmail,
  ownerCanonicalKey,
  shouldExcludeFromActivePortfolio,
} from './graph.js';

describe('graph shared helpers', () => {
  it('normalizes owner emails', () => {
    expect(normalizeEmail('  Alex@Example.COM ')).toBe('alex@example.com');
    expect(ownerCanonicalKey('alex@example.com')).toBe('owner:alex@example.com');
  });

  it('detects dependency cycles', () => {
    const cycles = detectCycles([
      { fromId: 'a', toId: 'b' },
      { fromId: 'b', toId: 'c' },
      { fromId: 'c', toId: 'a' },
    ]);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('excludes cyclic edges for stable traversal', () => {
    const edges = [
      { fromId: 'a', toId: 'b', label: 'ab' },
      { fromId: 'b', toId: 'c', label: 'bc' },
      { fromId: 'c', toId: 'a', label: 'ca' },
      { fromId: 'c', toId: 'd', label: 'cd' },
    ];
    const { edges: acyclic, cycleCount } = excludeCyclicEdges(edges);
    expect(cycleCount).toBeGreaterThan(0);
    expect(acyclic.some((edge) => edge.label === 'cd')).toBe(true);
    expect(acyclic.some((edge) => edge.label === 'ca')).toBe(false);
  });

  it('flags past due go-live for active projects', () => {
    expect(isPastDueGoLive('2020-01-01T00:00:00.000Z', 'active')).toBe(true);
    expect(isPastDueGoLive('2030-01-01T00:00:00.000Z', 'active')).toBe(false);
    expect(isPastDueGoLive('2020-01-01T00:00:00.000Z', 'completed')).toBe(false);
  });

  it('excludes inactive portfolio statuses', () => {
    expect(shouldExcludeFromActivePortfolio('on_hold')).toBe(true);
    expect(shouldExcludeFromActivePortfolio('active')).toBe(false);
  });

  it('suggests fuzzy email matches', () => {
    const suggestion = fuzzyEmailSuggestion('alex@contractor.test', [
      'alex@acme-demo.test',
      'jamie@acme-demo.test',
    ]);
    expect(suggestion?.email).toBe('alex@acme-demo.test');
  });
});
