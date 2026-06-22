import { describe, expect, it } from 'vitest';
import {
  buildInsightPrompt,
  buildTemplateInsight,
  prepareEvidenceBundle,
  sanitizeEvidenceText,
  validateInsightOutput,
} from './intelligence.js';

describe('evidence sanitization', () => {
  it('redacts emails and truncates text', () => {
    const sanitized = sanitizeEvidenceText(
      'Contact buyer@customer.com urgently about <script>alert(1)</script> rollout delay',
    );
    expect(sanitized).toContain('[email]');
    expect(sanitized).not.toContain('<script>');
  });

  it('redacts @mentions from evidence text', () => {
    const sanitized = sanitizeEvidenceText('Ping @exec and <@U123ABC> about delay');
    expect(sanitized).toContain('[mention]');
    expect(sanitized).not.toContain('@exec');
  });

  it('assigns stable evidence ids and hash', () => {
    const bundle = prepareEvidenceBundle([
      { source: 'jira', signal: 'blocked', description: 'Dependency overdue', days: 12 },
      { source: 'slack', signal: 'customer_inactivity', description: 'No customer reply', days: 16 },
    ]);
    expect(bundle.items[0]?.id).toBe('ev-1');
    expect(bundle.items.length).toBe(2);
    expect(bundle.hash).toHaveLength(32);
  });
});

describe('insight validation', () => {
  it('accepts output referencing known evidence ids', () => {
    const bundle = prepareEvidenceBundle([
      { source: 'jira', signal: 'blocked', description: 'Security review blocked' },
    ]);
    const parsed = validateInsightOutput(
      {
        root_cause: 'Customer security review is stalled',
        recommended_action: 'Escalate to customer security owner',
        suggested_owner: 'CSM',
        escalation_path: 'Notify executive sponsor',
        confidence: 78,
        evidence_ids: ['ev-1'],
      },
      bundle.items,
    );
    expect(parsed.evidence_ids).toEqual(['ev-1']);
  });

  it('rejects hallucinated evidence ids', () => {
    const bundle = prepareEvidenceBundle([
      { source: 'jira', signal: 'blocked', description: 'Security review blocked' },
    ]);
    expect(() =>
      validateInsightOutput(
        {
          root_cause: 'Made up cause',
          recommended_action: 'Do something',
          confidence: 80,
          evidence_ids: ['ev-99'],
        },
        bundle.items,
      ),
    ).toThrow(/unknown evidence/i);
  });
});

describe('template insight fallback', () => {
  it('generates actionable insight without LLM', () => {
    const bundle = prepareEvidenceBundle([
      {
        source: 'slack',
        signal: 'customer_inactivity',
        description: 'No customer Slack response',
        days: 16,
      },
    ]);
    const insight = buildTemplateInsight({
      riskReason: 'Customer response delay (16 business days)',
      ruleKey: 'customer_response_delay',
      evidence: bundle.items,
      bundle,
      locale: 'en',
      projectOwner: 'Alex Rivera',
    });

    expect(insight.source).toBe('template');
    expect(insight.evidence.length).toBeGreaterThan(0);
    expect(insight.recommendedAction.length).toBeGreaterThan(10);
  });
});

describe('insight prompt shaping', () => {
  it('sanitizes project and risk fields in LLM prompts', () => {
    const prompt = buildInsightPrompt({
      projectName: 'Acme <script> Corp',
      riskReason: 'Contact buyer@customer.com',
      riskLevel: 'high',
      evidence: [{ id: 'ev-1', source: 'jira', signal: 'blocked', description: 'Task blocked' }],
      locale: 'en',
    });
    expect(prompt).toContain('[email]');
    expect(prompt).not.toContain('<script>');
  });
});
