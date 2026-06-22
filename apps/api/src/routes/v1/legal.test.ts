import { createApp } from '../../app.js';
import { describe, expect, it } from 'vitest';

describe('legal API', () => {
  const app = createApp();

  it('returns DPA document publicly', async () => {
    const res = await app.request('/v1/legal/dpa');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { document: { version: string; sections: unknown[] } };
    expect(body.document.version).toBeTruthy();
    expect(body.document.sections.length).toBeGreaterThan(0);
  });
});
