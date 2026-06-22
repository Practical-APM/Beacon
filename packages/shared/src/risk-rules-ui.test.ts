import { applyRiskSettingsPatch, buildRiskRulesApiResponse } from './risk-rules-ui.js';
import { describe, expect, it } from 'vitest';

describe('risk rules UI helpers', () => {
  it('builds API response with merged defaults', () => {
    const response = buildRiskRulesApiResponse({
      rules: { project_inactivity: { enabled: false } },
    });
    expect(response.rules).toHaveLength(6);
    expect(response.rules.find((rule) => rule.key === 'project_inactivity')?.config.enabled).toBe(
      false,
    );
  });

  it('applies sanitized rule patches', () => {
    const next = applyRiskSettingsPatch({}, {
      rules: {
        project_inactivity: {
          enabled: true,
          baseScore: 150,
          thresholdBusinessDays: 5,
          level: 'critical',
        },
        critical_dependency_overdue: {
          thresholdBusinessDays: 99,
        },
      },
    });
    expect(next.rules?.project_inactivity?.baseScore).toBe(100);
    expect(next.rules?.project_inactivity?.thresholdBusinessDays).toBe(5);
    expect(next.rules?.critical_dependency_overdue?.thresholdBusinessDays).toBeUndefined();
  });
});
