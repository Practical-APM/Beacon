import { buildOutboundWebhookPayload } from '@beacon/shared/outbound-webhooks';
import { describe, expect, it } from 'vitest';
import { signOutboundWebhookPayload, verifyOutboundWebhookSignature } from './signing.js';

describe('outbound webhook signing', () => {
  it('signs and verifies payloads', () => {
    const payload = buildOutboundWebhookPayload({
      eventType: 'risk.created',
      tenantId: 'tenant-1',
      riskId: 'risk-1',
      projectId: 'project-1',
      level: 'high',
      confidence: 0.9,
      reason: 'Delay detected',
    });
    const timestamp = 1_700_000_000;
    const signature = signOutboundWebhookPayload('secret-key', payload, timestamp);

    expect(
      verifyOutboundWebhookSignature('secret-key', payload, timestamp, `v1=${signature}`),
    ).toBe(true);
    expect(
      verifyOutboundWebhookSignature('wrong-key', payload, timestamp, `v1=${signature}`),
    ).toBe(false);
  });
});
