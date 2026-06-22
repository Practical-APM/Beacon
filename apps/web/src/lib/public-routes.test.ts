import { describe, expect, it } from 'vitest';
import { isPublicWebPath } from './public-routes';

describe('isPublicWebPath', () => {
  it('allows marketing and auth routes without Clerk session', () => {
    expect(isPublicWebPath('/')).toBe(true);
    expect(isPublicWebPath('/sign-in')).toBe(true);
    expect(isPublicWebPath('/sign-up')).toBe(true);
    expect(isPublicWebPath('/docs')).toBe(true);
    expect(isPublicWebPath('/docs/connect-stack')).toBe(true);
    expect(isPublicWebPath('/legal/dpa')).toBe(true);
    expect(isPublicWebPath('/notifications/unsubscribe')).toBe(true);
  });

  it('requires auth for product routes', () => {
    expect(isPublicWebPath('/dashboard')).toBe(false);
    expect(isPublicWebPath('/integrations')).toBe(false);
    expect(isPublicWebPath('/integrations/setup')).toBe(false);
    expect(isPublicWebPath('/settings')).toBe(false);
    expect(isPublicWebPath('/projects/abc-123')).toBe(false);
  });
});
