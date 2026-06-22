import type { RiskLevel } from './constants.js';

export const OUTBOUND_WEBHOOK_EVENT_TYPES = [
  'risk.created',
  'risk.updated',
  'risk.escalated',
  'risk.resolved',
  'ping',
] as const;

export type OutboundWebhookEventType = (typeof OUTBOUND_WEBHOOK_EVENT_TYPES)[number];

export const DEFAULT_OUTBOUND_WEBHOOK_EVENT_TYPES: OutboundWebhookEventType[] = [
  'risk.created',
  'risk.updated',
  'risk.escalated',
  'risk.resolved',
];

export interface OutboundWebhookPayload {
  id: string;
  type: OutboundWebhookEventType;
  createdAt: string;
  tenantId: string;
  data: Record<string, unknown>;
}

export interface OutboundRiskWebhookInput {
  eventType: Exclude<OutboundWebhookEventType, 'ping'>;
  tenantId: string;
  riskId: string;
  projectId: string;
  projectName?: string | null;
  level?: RiskLevel;
  previousLevel?: RiskLevel | null;
  confidence?: number;
  reason?: string | null;
  status?: string;
  occurredAt?: string;
}

export function buildOutboundWebhookPayload(input: {
  type: 'ping';
  tenantId: string;
  subscriptionId: string;
}): OutboundWebhookPayload;
export function buildOutboundWebhookPayload(input: OutboundRiskWebhookInput): OutboundWebhookPayload;
export function buildOutboundWebhookPayload(
  input: OutboundRiskWebhookInput | { type: 'ping'; tenantId: string; subscriptionId: string },
): OutboundWebhookPayload {
  if ('type' in input && input.type === 'ping') {
    return {
      id: `ping_${Date.now()}`,
      type: 'ping',
      createdAt: new Date().toISOString(),
      tenantId: input.tenantId,
      data: {
        subscriptionId: input.subscriptionId,
        message: 'Beacon webhook test delivery',
      },
    };
  }

  const riskInput = input as OutboundRiskWebhookInput;
  const occurredAt = riskInput.occurredAt ?? new Date().toISOString();
  return {
    id: `${riskInput.eventType}:${riskInput.riskId}:${occurredAt}`,
    type: riskInput.eventType,
    createdAt: occurredAt,
    tenantId: riskInput.tenantId,
    data: {
      riskId: riskInput.riskId,
      projectId: riskInput.projectId,
      projectName: riskInput.projectName ?? null,
      level: riskInput.level ?? null,
      previousLevel: riskInput.previousLevel ?? null,
      confidence: riskInput.confidence ?? null,
      reason: riskInput.reason ?? null,
      status: riskInput.status ?? null,
    },
  };
}

export function matchesWebhookEventFilter(
  subscriptionEventTypes: string[] | null | undefined,
  eventType: OutboundWebhookEventType,
): boolean {
  const types = subscriptionEventTypes ?? DEFAULT_OUTBOUND_WEBHOOK_EVENT_TYPES;
  return types.includes(eventType);
}

export function mapRiskAlertToWebhookEvents(params: {
  tenantId: string;
  riskId: string;
  projectId: string;
  projectName?: string | null;
  level: RiskLevel;
  previousLevel: RiskLevel | null;
  isNew: boolean;
  severityIncreased: boolean;
  confidence: number;
  reason: string;
}): OutboundRiskWebhookInput[] {
  const base = {
    tenantId: params.tenantId,
    riskId: params.riskId,
    projectId: params.projectId,
    projectName: params.projectName,
    level: params.level,
    previousLevel: params.previousLevel,
    confidence: params.confidence,
    reason: params.reason,
    status: 'open',
  };

  if (params.isNew) {
    return [{ ...base, eventType: 'risk.created' }];
  }
  if (params.severityIncreased) {
    return [{ ...base, eventType: 'risk.escalated' }];
  }
  return [{ ...base, eventType: 'risk.updated' }];
}

export function sanitizeWebhookUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return parsed.toString();
    }
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
