import { describe, expect, it } from 'vitest';
import { buildAuthorizationHeader } from './api-auth';

describe('buildAuthorizationHeader', () => {
  it('uses dev token prefix in dev mode', async () => {
    const header = await buildAuthorizationHeader(true, 'admin-a', async () => null);
    expect(header).toBe('Bearer dev:admin-a');
  });

  it('uses Clerk JWT when not in dev mode', async () => {
    const header = await buildAuthorizationHeader(false, 'user_123', async () => 'jwt-token');
    expect(header).toBe('Bearer jwt-token');
  });

  it('throws when Clerk token is missing', async () => {
    await expect(
      buildAuthorizationHeader(false, 'user_123', async () => null),
    ).rejects.toThrow('Missing Clerk session token');
  });
});
