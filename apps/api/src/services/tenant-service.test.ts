import { describe, expect, it } from 'vitest';
import { resolveSeedEmailForDevAuth } from './tenant-service.js';

describe('resolveSeedEmailForDevAuth', () => {
  it('maps known dev auth ids to seeded demo emails', () => {
    expect(resolveSeedEmailForDevAuth('contributor-a')).toBe('contributor-a@acme-demo.test');
    expect(resolveSeedEmailForDevAuth('admin-a')).toBe('admin-a@acme-demo.test');
  });

  it('returns null for unknown dev auth ids', () => {
    expect(resolveSeedEmailForDevAuth('unknown-user')).toBeNull();
  });
});
