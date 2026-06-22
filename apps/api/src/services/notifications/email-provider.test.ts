import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('sendEmail', () => {
  const originalEnv = { ...process.env };
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('mocks email delivery in development', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/beacon';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const { sendEmail: send } = await import('./email-provider.js');
    const result = await send({
      to: 'admin@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result).toBe('sent');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends via Resend in production when configured', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'Beacon <notifications@example.com>';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/beacon';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.CLERK_SECRET_KEY = 'sk_test';

    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => '{"id":"email_123"}',
    });

    const { sendEmail: send } = await import('./email-provider.js');
    const result = await send({
      to: 'admin@example.com',
      subject: 'Digest',
      text: 'Body',
      html: '<p>Body</p>',
    });

    expect(result).toBe('sent');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
        }),
      }),
    );
  });

  it('returns failed when Resend is not configured in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/beacon';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.CLERK_SECRET_KEY = 'sk_test';

    const { sendEmail: send } = await import('./email-provider.js');
    const result = await send({
      to: 'admin@example.com',
      subject: 'Digest',
      text: 'Body',
    });

    expect(result).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
