import { describe, expect, it } from 'vitest';
import {
  buildDomainCollisionWarning,
  findOverlappingDomains,
  hasUnresolvedDomainCollision,
  parseDomainOverrideInput,
} from './domains.js';

describe('domain collision helpers', () => {
  it('finds overlapping internal and customer domains', () => {
    expect(findOverlappingDomains(['acme.com', 'beacon.test'], ['customer.com', 'acme.com'])).toEqual([
      'acme.com',
    ]);
  });

  it('detects unresolved collisions without overrides', () => {
    expect(hasUnresolvedDomainCollision(['acme.com'], ['acme.com'])).toBe(true);
    expect(hasUnresolvedDomainCollision(['acme.com'], ['acme.com'], ['acme.com'])).toBe(false);
  });

  it('builds a warning when mappings lack overrides', () => {
    const warning = buildDomainCollisionWarning(['acme.com'], ['acme.com'], [[]]);
    expect(warning?.overlappingDomains).toEqual(['acme.com']);
    expect(warning?.message).toContain('acme.com');
  });

  it('parses comma-separated override input', () => {
    expect(parseDomainOverrideInput(' Acme.COM, partner.io ')).toEqual(['acme.com', 'partner.io']);
  });
});
