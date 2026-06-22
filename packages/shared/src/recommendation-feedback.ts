export const FEEDBACK_RATINGS = ['helpful', 'not_helpful'] as const;
export type FeedbackRating = (typeof FEEDBACK_RATINGS)[number];

export const FEEDBACK_TARGET_TYPES = ['insight', 'recommendation'] as const;
export type FeedbackTargetType = (typeof FEEDBACK_TARGET_TYPES)[number];

export interface RecommendationFeedbackRecord {
  id: string;
  tenantId: string;
  userId: string;
  projectId: string;
  riskId: string | null;
  insightId: string | null;
  recommendationId: string | null;
  targetType: FeedbackTargetType;
  rating: FeedbackRating;
  comment: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingFeedbackExportRow {
  feedbackId: string;
  tenantId: string;
  projectId: string;
  riskId: string | null;
  ruleKey: string | null;
  targetType: FeedbackTargetType;
  rating: FeedbackRating;
  comment: string | null;
  rootCause: string | null;
  recommendedAction: string | null;
  insightSource: string | null;
  evidenceHash: string | null;
  createdAt: string;
}

export interface FeedbackSummary {
  total: number;
  helpful: number;
  notHelpful: number;
  helpfulRate: number;
  byTargetType: Record<FeedbackTargetType, { helpful: number; notHelpful: number }>;
  byInsightSource: Record<string, { helpful: number; notHelpful: number }>;
}

export function computeFeedbackSummary(
  rows: Array<{
    rating: FeedbackRating;
    targetType: FeedbackTargetType;
    insightSource?: string | null;
  }>,
): FeedbackSummary {
  const byTargetType: FeedbackSummary['byTargetType'] = {
    insight: { helpful: 0, notHelpful: 0 },
    recommendation: { helpful: 0, notHelpful: 0 },
  };
  const byInsightSource: FeedbackSummary['byInsightSource'] = {};
  let helpful = 0;
  let notHelpful = 0;

  for (const row of rows) {
    if (row.rating === 'helpful') helpful += 1;
    else notHelpful += 1;

    byTargetType[row.targetType][row.rating === 'helpful' ? 'helpful' : 'notHelpful'] += 1;

    if (row.insightSource) {
      const bucket = byInsightSource[row.insightSource] ?? { helpful: 0, notHelpful: 0 };
      bucket[row.rating === 'helpful' ? 'helpful' : 'notHelpful'] += 1;
      byInsightSource[row.insightSource] = bucket;
    }
  }

  const total = helpful + notHelpful;
  return {
    total,
    helpful,
    notHelpful,
    helpfulRate: total > 0 ? helpful / total : 0,
    byTargetType,
    byInsightSource,
  };
}

export function recommendationStatusFromFeedback(
  rating: FeedbackRating,
): 'accepted' | 'dismissed' {
  return rating === 'helpful' ? 'accepted' : 'dismissed';
}
