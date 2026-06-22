import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { OutboundWebhookPayload } from '@beacon/shared/outbound-webhooks';

export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

export function signOutboundWebhookPayload(
  secret: string,
  payload: OutboundWebhookPayload,
  timestamp: number,
): string {
  const body = JSON.stringify(payload);
  const signedContent = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(signedContent).digest('hex');
}

export function buildWebhookSignatureHeaders(
  secret: string,
  payload: OutboundWebhookPayload,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signOutboundWebhookPayload(secret, payload, timestamp);
  return {
    'Content-Type': 'application/json',
    'X-Beacon-Event': payload.type,
    'X-Beacon-Delivery-Id': payload.id,
    'X-Beacon-Timestamp': String(timestamp),
    'X-Beacon-Signature': `v1=${signature}`,
  };
}

export function verifyOutboundWebhookSignature(
  secret: string,
  payload: OutboundWebhookPayload,
  timestamp: number,
  signatureHeader: string,
): boolean {
  const expected = signOutboundWebhookPayload(secret, payload, timestamp);
  const provided = signatureHeader.replace(/^v1=/, '');
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function truncateResponseBody(body: string, maxLength = 500): string {
  if (body.length <= maxLength) return body;
  return `${body.slice(0, maxLength)}…`;
}
