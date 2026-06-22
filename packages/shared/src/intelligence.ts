import { createHash } from 'node:crypto';
import { z } from 'zod';

export const INSIGHT_EVIDENCE_MAX = 8 as const;
export const INSIGHT_TEXT_MAX = 500 as const;
export const INSIGHT_CACHE_TTL_SECONDS = 3600 as const;
export const INSIGHT_DEFAULT_MAX_TOKENS = 800 as const;
export const INSIGHT_DEFAULT_DAILY_TOKEN_CAP = 50_000 as const;
export const INSIGHT_LLM_TIMEOUT_MS = 10_000 as const;

export interface IntelligenceSettings {
  llmEnabled?: boolean;
  locale?: string;
  dailyTokenCap?: number;
  maxTokensPerRequest?: number;
  provider?: 'openai' | 'anthropic' | 'mock';
}

export interface SanitizedEvidenceItem {
  id: string;
  source: string;
  signal: string;
  description: string;
  timestamp?: string;
  deepLink?: string;
  days?: number;
}

export interface InsightEvidenceBundle {
  items: SanitizedEvidenceItem[];
  hash: string;
}

export const insightOutputSchema = z.object({
  root_cause: z.string().min(1),
  recommended_action: z.string().min(1),
  suggested_owner: z.string().nullable().optional(),
  escalation_path: z.string().nullable().optional(),
  confidence: z.number().int().min(0).max(100),
  evidence_ids: z.array(z.string()).min(1),
});

export type InsightOutput = z.infer<typeof insightOutputSchema>;

export interface GeneratedInsight {
  rootCause: string;
  recommendedAction: string;
  suggestedOwner: string | null;
  escalationPath: string | null;
  confidence: number;
  evidence: SanitizedEvidenceItem[];
  evidenceHash: string;
  source: 'llm' | 'template' | 'cached';
  locale: string;
  tokensUsed?: number;
}

export const DEFAULT_INTELLIGENCE_SETTINGS: Required<
  Pick<IntelligenceSettings, 'llmEnabled' | 'locale' | 'dailyTokenCap' | 'maxTokensPerRequest' | 'provider'>
> = {
  llmEnabled: true,
  locale: 'en',
  dailyTokenCap: INSIGHT_DEFAULT_DAILY_TOKEN_CAP,
  maxTokensPerRequest: INSIGHT_DEFAULT_MAX_TOKENS,
  provider: 'mock',
};

export function mergeIntelligenceSettings(
  tenantSettings?: IntelligenceSettings | null,
): Required<
  Pick<IntelligenceSettings, 'llmEnabled' | 'locale' | 'dailyTokenCap' | 'maxTokensPerRequest' | 'provider'>
> {
  return {
    ...DEFAULT_INTELLIGENCE_SETTINGS,
    ...(tenantSettings ?? {}),
    llmEnabled: tenantSettings?.llmEnabled ?? DEFAULT_INTELLIGENCE_SETTINGS.llmEnabled,
  };
}

export function sanitizeEvidenceText(input: string): string {
  const withoutHtml = input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const redacted = withoutHtml
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b\+?\d[\d\s().-]{7,}\b/g, '[phone]')
    .replace(/<@[A-Z0-9]+>/gi, '[mention]')
    .replace(/@[a-z0-9._-]{2,}/gi, '[mention]');
  return redacted.slice(0, INSIGHT_TEXT_MAX);
}

export function sanitizePromptField(input: string): string {
  return sanitizeEvidenceText(input);
}

export function prepareEvidenceBundle(
  rawEvidence: Array<Record<string, unknown>>,
  maxItems = INSIGHT_EVIDENCE_MAX,
): InsightEvidenceBundle {
  const sorted = [...rawEvidence]
    .map((item, index) => ({
      source: String(item.source ?? 'system'),
      signal: String(item.signal ?? 'signal'),
      description: sanitizeEvidenceText(String(item.description ?? item.signal ?? 'Evidence item')),
      timestamp: item.timestamp ? String(item.timestamp) : undefined,
      deepLink: item.deepLink ? String(item.deepLink) : item.entityId ? String(item.entityId) : undefined,
      days: typeof item.days === 'number' ? item.days : undefined,
      severity:
        typeof item.days === 'number'
          ? item.days
          : String(item.signal ?? '').includes('overdue')
            ? 50
            : index,
    }))
    .sort((a, b) => Number(b.severity) - Number(a.severity))
    .slice(0, maxItems);

  const items: SanitizedEvidenceItem[] = sorted.map((item, index) => ({
    id: `ev-${index + 1}`,
    source: item.source,
    signal: item.signal,
    description: item.description,
    timestamp: item.timestamp,
    deepLink: item.deepLink,
    days: item.days,
  }));

  const hash = createHash('sha256')
    .update(JSON.stringify(items))
    .digest('hex')
    .slice(0, 32);

  return { items, hash };
}

export function validateInsightOutput(
  output: unknown,
  evidence: SanitizedEvidenceItem[],
): InsightOutput {
  const parsed = insightOutputSchema.parse(output);
  const allowedIds = new Set(evidence.map((item) => item.id));
  const invalidIds = parsed.evidence_ids.filter((id) => !allowedIds.has(id));
  if (invalidIds.length > 0) {
    throw new Error(`Insight references unknown evidence IDs: ${invalidIds.join(', ')}`);
  }
  return parsed;
}

export function insightOutputToGenerated(
  parsed: InsightOutput,
  bundle: InsightEvidenceBundle,
  source: GeneratedInsight['source'],
  locale: string,
  tokensUsed?: number,
): GeneratedInsight {
  const linkedEvidence = parsed.evidence_ids
    .map((id) => bundle.items.find((item) => item.id === id))
    .filter((item): item is SanitizedEvidenceItem => Boolean(item));

  return {
    rootCause: parsed.root_cause.trim(),
    recommendedAction: parsed.recommended_action.trim(),
    suggestedOwner: parsed.suggested_owner?.trim() ?? null,
    escalationPath: parsed.escalation_path?.trim() ?? null,
    confidence: parsed.confidence,
    evidence: linkedEvidence.length > 0 ? linkedEvidence : bundle.items.slice(0, 1),
    evidenceHash: bundle.hash,
    source,
    locale,
    tokensUsed,
  };
}

export function buildInsightPrompt(params: {
  projectName: string;
  riskReason: string;
  riskLevel: string;
  evidence: SanitizedEvidenceItem[];
  locale: string;
}): string {
  const evidenceLines = params.evidence
    .map(
      (item) =>
        `- ${item.id}: [${item.source}/${item.signal}] ${item.description}${
          item.days != null ? ` (${item.days} days)` : ''
        }`,
    )
    .join('\n');

  return [
    'You are an implementation risk analyst. Use ONLY the evidence below.',
    'Respond in JSON with keys: root_cause, recommended_action, suggested_owner, escalation_path, confidence, evidence_ids.',
    `Locale: ${params.locale}`,
    `Project: ${sanitizePromptField(params.projectName)}`,
    `Risk: ${sanitizePromptField(params.riskReason)} (${params.riskLevel})`,
    'Evidence:',
    evidenceLines,
    'Rules:',
    '- evidence_ids must reference only listed IDs',
    '- do not invent facts not supported by evidence',
    '- confidence 0-100 based on evidence completeness',
    '- temperature 0; be concise and actionable',
  ].join('\n');
}

export function buildTemplateInsight(params: {
  riskReason: string;
  ruleKey?: string | null;
  evidence: SanitizedEvidenceItem[];
  bundle: InsightEvidenceBundle;
  locale: string;
  projectOwner?: string | null;
}): GeneratedInsight {
  const primary = params.evidence[0];
  const ruleKey = params.ruleKey ?? 'general';
  const templates: Record<string, { action: string; escalation: string }> = {
    customer_response_delay: {
      action: 'Schedule a customer follow-up and confirm owner for the waiting item.',
      escalation: 'Escalate to customer success manager if no response within 3 business days.',
    },
    project_inactivity: {
      action: 'Review recent project activity and assign next actions with owners.',
      escalation: 'Notify delivery lead if inactivity persists beyond one week.',
    },
    critical_dependency_overdue: {
      action: 'Unblock the overdue dependency or re-plan the dependent work.',
      escalation: 'Escalate to project executive sponsor if blocker exceeds SLA.',
    },
    no_assigned_owner: {
      action: 'Assign owners to all open unowned tasks immediately.',
      escalation: 'Escalate to operations manager for staffing support.',
    },
    milestone_behind_schedule: {
      action: 'Re-baseline the overdue milestone and communicate revised dates.',
      escalation: 'Escalate to account executive if customer impact is high.',
    },
    past_due_go_live: {
      action: 'Run a go-live recovery plan review with customer and internal leads.',
      escalation: 'Escalate to executive sponsor for recovery decision.',
    },
    general: {
      action: 'Review linked evidence and assign a corrective action with owner.',
      escalation: 'Escalate to project sponsor if risk remains open.',
    },
  };

  const template = templates[ruleKey] ?? templates.general!;
  const parsed = validateInsightOutput(
    {
      root_cause: `${sanitizePromptField(params.riskReason)}. Primary signal: ${primary?.description ?? 'Risk detected from synced operational data.'}`,
      recommended_action: template.action,
      suggested_owner: params.projectOwner ? sanitizePromptField(params.projectOwner) : null,
      escalation_path: template.escalation,
      confidence: Math.max(45, 90 - params.evidence.length * 3),
      evidence_ids: params.evidence.slice(0, 3).map((item) => item.id),
    },
    params.evidence,
  );

  return insightOutputToGenerated(parsed, params.bundle, 'template', params.locale);
}
