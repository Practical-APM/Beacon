import {
  buildOutboundWebhookPayload,
  matchesWebhookEventFilter,
  sanitizeWebhookUrl,
} from './outbound-webhooks.js';
import { describe, expect, it } from 'vitest';

describe('outbound webhooks', () => {
  it('builds risk webhook payload', () => {
    const payload = buildOutboundWebhookPayload({
      eventType: 'risk.created',
      tenantId: 'tenant-1',
      riskId: 'risk-1',
      projectId: 'project-1',
      level: 'high',
      confidence: 0.82,
      reason: 'Customer response delay',
    });

    expect(payload.type).toBe('risk.created');
    expect(payload.data.riskId).toBe('risk-1');
  });

  it('matches subscription event filters', () => {
    expect(matchesWebhookEventFilter(['risk.created'], 'risk.created')).toBe(true);
    expect(matchesWebhookEventFilter(['risk.created'], 'risk.resolved')).toBe(false);
  });

  it('sanitizes webhook URLs', () => {
    expect(sanitizeWebhookUrl('https://hooks.example.com/beacon')).toBe(
      'https://hooks.example.com/beacon',
    );
    expect(sanitizeWebhookUrl('http://insecure.example.com/beacon')).toBeNull();
    expect(sanitizeWebhookUrl('http://localhost:4000/hook')).toContain('localhost');
  });
});
