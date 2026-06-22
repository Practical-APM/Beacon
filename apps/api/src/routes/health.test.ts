import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('health routes', () => {
  const app = createApp();

  it('GET /health returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('beacon-api');
  });

  it('propagates x-request-id header', async () => {
    const res = await app.request('/health', {
      headers: { 'x-request-id': 'test-request-123' },
    });
    expect(res.headers.get('x-request-id')).toBe('test-request-123');
  });

  it('generates x-request-id when missing', async () => {
    const res = await app.request('/health');
    const requestId = res.headers.get('x-request-id');
    expect(requestId).toBeTruthy();
    expect(requestId!.length).toBeGreaterThan(10);
  });
});
