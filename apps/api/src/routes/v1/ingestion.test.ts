import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  clearIntegrationSyncLocks,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('event ingestion admin API', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(async () => {
    tenantId = testTenantAcmeId();
    await clearIntegrationSyncLocks(tenantId);
    await app.request('/v1/integrations/jira/disconnect', {
      method: 'DELETE',
      headers: authHeaders('admin-a', tenantId),
    });
  });

  it.skipIf(!dbIntegrationReady())('ingests events synchronously with deduplication', async () => {
    await app.request('/v1/integrations/jira/disconnect', {
      method: 'DELETE',
      headers: authHeaders('admin-a', tenantId),
    });

    const payload = {
      sync: true,
      eventType: 'task_updated',
      source: 'jira',
      externalEventId: `test-event-dedup-${Date.now()}`,
      sourceUpdatedAt: new Date().toISOString(),
      payload: { issueId: '10001' },
    };

    const first = await app.request('/v1/admin/events/ingest', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { status: string };
    expect(firstBody.status).toBe('dropped');

    await app.request('/v1/integrations/jira/mock-connect', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: '{}',
    });

    const second = await app.request('/v1/admin/events/ingest', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify(payload),
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { status: string };
    expect(secondBody.status).toBe('inserted');

    const third = await app.request('/v1/admin/events/ingest', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify(payload),
    });
    expect(third.status).toBe(200);
    const thirdBody = (await third.json()) as { status: string };
    expect(thirdBody.status).toBe('deduplicated');
  });
});
