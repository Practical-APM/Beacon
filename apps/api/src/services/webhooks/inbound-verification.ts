import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySlackRequestSignature(
  signingSecret: string,
  rawBody: string,
  timestamp: string | undefined,
  signature: string | undefined,
): boolean {
  if (!timestamp || !signature) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const digest = `v0=${createHmac('sha256', signingSecret).update(base).digest('hex')}`;

  if (signature.length !== digest.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export function verifySharedWebhookSecret(
  configuredSecret: string | undefined,
  providedSecret: string | undefined,
): boolean {
  if (!configuredSecret || !providedSecret) return false;
  if (configuredSecret.length !== providedSecret.length) return false;
  return timingSafeEqual(Buffer.from(configuredSecret), Buffer.from(providedSecret));
}

export function verifyJiraWebhookRequest(params: {
  configuredSecret: string | undefined;
  providedSecret: string | undefined;
  rawBody: string;
  signature: string | undefined;
}): boolean {
  if (
    verifySharedWebhookSecret(params.configuredSecret, params.providedSecret) ||
    verifySharedWebhookSecret(params.configuredSecret, params.signature)
  ) {
    return true;
  }

  if (!params.configuredSecret || !params.signature) return false;

  const normalized = params.signature.replace(/^sha256=/, '');
  const digest = createHmac('sha256', params.configuredSecret).update(params.rawBody).digest('hex');

  if (normalized.length !== digest.length) return false;
  return timingSafeEqual(Buffer.from(normalized), Buffer.from(digest));
}
