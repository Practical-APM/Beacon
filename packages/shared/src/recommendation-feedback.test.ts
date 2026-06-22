import { computeFeedbackSummary, recommendationStatusFromFeedback } from './recommendation-feedback.js';
import { describe, expect, it } from 'vitest';

describe('recommendation feedback helpers', () => {
  it('computes summary stats', () => {
    const summary = computeFeedbackSummary([
      { rating: 'helpful', targetType: 'insight', insightSource: 'llm' },
      { rating: 'not_helpful', targetType: 'insight', insightSource: 'template' },
      { rating: 'helpful', targetType: 'recommendation' },
    ]);

    expect(summary.total).toBe(3);
    expect(summary.helpful).toBe(2);
    expect(summary.byInsightSource.llm?.helpful).toBe(1);
  });

  it('maps feedback to recommendation status', () => {
    expect(recommendationStatusFromFeedback('helpful')).toBe('accepted');
    expect(recommendationStatusFromFeedback('not_helpful')).toBe('dismissed');
  });
});
