import type { RiskLevel } from './constants.js';
import {
  DEFAULT_RISK_RULES,
  RISK_RULE_KEYS,
  mergeRiskSettings,
  type RiskRuleConfig,
  type RiskRuleKey,
  type TenantRiskSettings,
} from './risk.js';

export interface RiskRuleDefinition {
  key: RiskRuleKey;
  label: string;
  description: string;
  supportsThreshold: boolean;
  defaultConfig: RiskRuleConfig;
}

export const RISK_RULE_DEFINITIONS: RiskRuleDefinition[] = [
  {
    key: 'project_inactivity',
    label: 'Project inactivity',
    description: 'Flags projects with no Jira, Slack, or calendar activity within the threshold.',
    supportsThreshold: true,
    defaultConfig: DEFAULT_RISK_RULES.project_inactivity,
  },
  {
    key: 'critical_dependency_overdue',
    label: 'Critical dependency overdue',
    description: 'Detects blocked work when a critical upstream task is past due.',
    supportsThreshold: false,
    defaultConfig: DEFAULT_RISK_RULES.critical_dependency_overdue,
  },
  {
    key: 'no_assigned_owner',
    label: 'No assigned owner',
    description: 'Detects open tasks without an assignee on active projects.',
    supportsThreshold: false,
    defaultConfig: DEFAULT_RISK_RULES.no_assigned_owner,
  },
  {
    key: 'customer_response_delay',
    label: 'Customer response delay',
    description: 'Detects gaps in customer engagement from Slack or calendar signals.',
    supportsThreshold: true,
    defaultConfig: DEFAULT_RISK_RULES.customer_response_delay,
  },
  {
    key: 'milestone_behind_schedule',
    label: 'Milestone behind schedule',
    description: 'Flags milestones whose due dates have passed while still open.',
    supportsThreshold: false,
    defaultConfig: DEFAULT_RISK_RULES.milestone_behind_schedule,
  },
  {
    key: 'past_due_go_live',
    label: 'Past due go-live',
    description: 'Flags active projects whose Salesforce go-live date has passed.',
    supportsThreshold: false,
    defaultConfig: DEFAULT_RISK_RULES.past_due_go_live,
  },
];

export interface RiskRulesApiResponse {
  timezone: string;
  hysteresisBuffer: number;
  acknowledgedSuppressionDays: number;
  blackoutPeriods: NonNullable<TenantRiskSettings['blackoutPeriods']>;
  rules: Array<
    RiskRuleDefinition & {
      config: RiskRuleConfig;
    }
  >;
}

export function buildRiskRulesApiResponse(
  tenantSettings?: TenantRiskSettings | null,
): RiskRulesApiResponse {
  const merged = mergeRiskSettings(tenantSettings);
  return {
    timezone: merged.timezone,
    hysteresisBuffer: merged.hysteresisBuffer,
    acknowledgedSuppressionDays: merged.acknowledgedSuppressionDays,
    blackoutPeriods: merged.blackoutPeriods,
    rules: RISK_RULE_DEFINITIONS.map((definition) => ({
      ...definition,
      config: merged.rules[definition.key],
    })),
  };
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical';
}

function sanitizeRulePatch(
  key: RiskRuleKey,
  patch: Partial<RiskRuleConfig>,
): Partial<RiskRuleConfig> {
  const next: Partial<RiskRuleConfig> = {};
  if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
  if (patch.level !== undefined && isRiskLevel(patch.level)) next.level = patch.level;
  if (patch.baseScore !== undefined) {
    next.baseScore = Math.min(100, Math.max(0, Math.round(Number(patch.baseScore))));
  }
  if (patch.thresholdBusinessDays !== undefined) {
    next.thresholdBusinessDays = Math.min(90, Math.max(1, Math.round(Number(patch.thresholdBusinessDays))));
  }
  if (
    next.thresholdBusinessDays !== undefined &&
    !RISK_RULE_DEFINITIONS.find((item) => item.key === key)?.supportsThreshold
  ) {
    delete next.thresholdBusinessDays;
  }
  return next;
}

export function applyRiskSettingsPatch(
  current: TenantRiskSettings | null | undefined,
  patch: TenantRiskSettings,
): TenantRiskSettings {
  const base = current ?? {};
  const nextRules: Partial<Record<RiskRuleKey, Partial<RiskRuleConfig>>> = {
    ...(base.rules ?? {}),
  };

  if (patch.rules) {
    for (const key of RISK_RULE_KEYS) {
      const rulePatch = patch.rules[key];
      if (!rulePatch) continue;
      nextRules[key] = {
        ...(nextRules[key] ?? {}),
        ...sanitizeRulePatch(key, rulePatch),
      };
    }
  }

  return {
    ...base,
    timezone: patch.timezone ?? base.timezone,
    hysteresisBuffer:
      patch.hysteresisBuffer !== undefined
        ? Math.min(20, Math.max(0, Math.round(Number(patch.hysteresisBuffer))))
        : base.hysteresisBuffer,
    acknowledgedSuppressionDays:
      patch.acknowledgedSuppressionDays !== undefined
        ? Math.min(30, Math.max(1, Math.round(Number(patch.acknowledgedSuppressionDays))))
        : base.acknowledgedSuppressionDays,
    blackoutPeriods: patch.blackoutPeriods ?? base.blackoutPeriods,
    rules: nextRules,
  };
}

export function resetRiskSettings(): TenantRiskSettings {
  return {};
}
