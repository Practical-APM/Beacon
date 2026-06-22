import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  verifyJiraWebhookRequest,
  verifySlackRequestSignature,
} from './inbound-verification.js';

describe('inbound webhook verification', () => {
  it('verifies Slack request signatures', () => {
    const secret = 'slack-signing-secret';
    const rawBody = '{"type":"event_callback"}';
    const timestamp = '1710000000';
    const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;

    expect(verifySlackRequestSignature(secret, rawBody, timestamp, signature)).toBe(true);
    expect(verifySlackRequestSignature(secret, rawBody, timestamp, 'v0=bad')).toBe(false);
  });

  it('verifies Jira shared secrets and HMAC signatures', () => {
    const secret = 'jira-webhook-secret';
    const rawBody = '{"webhookEvent":"jira:issue_updated"}';

    expect(
      verifyJiraWebhookRequest({
        configuredSecret: secret,
        providedSecret: secret,
        rawBody,
        signature: undefined,
      }),
    ).toBe(true);

    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
    expect(
      verifyJiraWebhookRequest({
        configuredSecret: secret,
        providedSecret: undefined,
        rawBody,
        signature: `sha256=${signature}`,
      }),
    ).toBe(true);
  });
});
