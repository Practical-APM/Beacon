import { mergeFeatureFlags, resolveFeatureFlags } from './feature-flags.js';
import { describe, expect, it } from 'vitest';

describe('feature flags', () => {
  it('merges tenant overrides with defaults', () => {
    expect(mergeFeatureFlags({ llmEnabled: false })).toEqual({
      llmEnabled: false,
      slackAlertsEnabled: true,
      outboundWebhooksEnabled: true,
      benchmarkParticipationEnabled: false,
      delayPredictionsEnabled: true,
    });
  });

  it('applies global env kill switches', () => {
    expect(
      resolveFeatureFlags(
        {
          FEATURE_LLM_ENABLED: false,
          FEATURE_SLACK_ALERTS_ENABLED: true,
          FEATURE_OUTBOUND_WEBHOOKS_ENABLED: true,
          FEATURE_BENCHMARKS_ENABLED: true,
          FEATURE_DELAY_PREDICTIONS_ENABLED: true,
        },
        {
          llmEnabled: true,
          slackAlertsEnabled: true,
          outboundWebhooksEnabled: true,
          benchmarkParticipationEnabled: true,
          delayPredictionsEnabled: true,
        },
      ),
    ).toEqual({
      llmEnabled: false,
      slackAlertsEnabled: true,
      outboundWebhooksEnabled: true,
      benchmarkParticipationEnabled: true,
      delayPredictionsEnabled: true,
    });
  });
});
