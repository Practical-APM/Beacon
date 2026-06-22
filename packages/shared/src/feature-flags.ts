export interface TenantFeatureFlags {
  llmEnabled?: boolean;
  slackAlertsEnabled?: boolean;
  outboundWebhooksEnabled?: boolean;
  benchmarkParticipationEnabled?: boolean;
  delayPredictionsEnabled?: boolean;
}

export const DEFAULT_TENANT_FEATURE_FLAGS: Required<TenantFeatureFlags> = {
  llmEnabled: true,
  slackAlertsEnabled: true,
  outboundWebhooksEnabled: true,
  benchmarkParticipationEnabled: false,
  delayPredictionsEnabled: true,
};

export function mergeFeatureFlags(
  raw: TenantFeatureFlags | Record<string, unknown> | null | undefined,
): Required<TenantFeatureFlags> {
  const input = (raw ?? {}) as TenantFeatureFlags;
  return {
    llmEnabled: input.llmEnabled ?? DEFAULT_TENANT_FEATURE_FLAGS.llmEnabled,
    slackAlertsEnabled: input.slackAlertsEnabled ?? DEFAULT_TENANT_FEATURE_FLAGS.slackAlertsEnabled,
    outboundWebhooksEnabled:
      input.outboundWebhooksEnabled ?? DEFAULT_TENANT_FEATURE_FLAGS.outboundWebhooksEnabled,
    benchmarkParticipationEnabled:
      input.benchmarkParticipationEnabled ??
      DEFAULT_TENANT_FEATURE_FLAGS.benchmarkParticipationEnabled,
    delayPredictionsEnabled:
      input.delayPredictionsEnabled ?? DEFAULT_TENANT_FEATURE_FLAGS.delayPredictionsEnabled,
  };
}

export function resolveFeatureFlags(
  env: {
    FEATURE_LLM_ENABLED: boolean;
    FEATURE_SLACK_ALERTS_ENABLED: boolean;
    FEATURE_OUTBOUND_WEBHOOKS_ENABLED: boolean;
    FEATURE_BENCHMARKS_ENABLED: boolean;
    FEATURE_DELAY_PREDICTIONS_ENABLED: boolean;
  },
  tenantFlags: Required<TenantFeatureFlags>,
): Required<TenantFeatureFlags> {
  return {
    llmEnabled: env.FEATURE_LLM_ENABLED && tenantFlags.llmEnabled,
    slackAlertsEnabled: env.FEATURE_SLACK_ALERTS_ENABLED && tenantFlags.slackAlertsEnabled,
    outboundWebhooksEnabled:
      env.FEATURE_OUTBOUND_WEBHOOKS_ENABLED && tenantFlags.outboundWebhooksEnabled,
    benchmarkParticipationEnabled:
      env.FEATURE_BENCHMARKS_ENABLED && tenantFlags.benchmarkParticipationEnabled,
    delayPredictionsEnabled:
      env.FEATURE_DELAY_PREDICTIONS_ENABLED && tenantFlags.delayPredictionsEnabled,
  };
}
