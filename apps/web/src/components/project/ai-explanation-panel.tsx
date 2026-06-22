'use client';

import { useState } from 'react';
import { FeedbackBanner } from '@/components/feedback-banner';
import { cn } from '@/lib/utils';

type InsightFeedback = {
  insightId: string;
  riskId: string;
  rating: 'helpful' | 'not_helpful' | null;
};

export function AiExplanationPanel({
  insights,
  projectId,
  feedbackByInsightId,
  onSubmitFeedback,
}: {
  insights: Array<{
    id?: string;
    riskId: string;
    rootCause: string;
    recommendedAction: string;
    confidence: number;
    evidence?: Array<{ description?: string; signal?: string }>;
  }>;
  projectId?: string;
  feedbackByInsightId?: Record<string, InsightFeedback['rating']>;
  onSubmitFeedback?: (
    insightId: string,
    riskId: string,
    rating: 'helpful' | 'not_helpful',
    comment?: string,
  ) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (insights.length === 0) return null;

  const primary = insights[0]!;
  const bullets = [
    ...new Set(
      insights.flatMap((insight) =>
        (insight.evidence ?? []).map((item) => item.description ?? item.signal).filter(Boolean),
      ),
    ),
  ].slice(0, 5);

  const existingRating = primary.id ? feedbackByInsightId?.[primary.id] ?? null : null;

  async function handleFeedback(rating: 'helpful' | 'not_helpful') {
    if (!onSubmitFeedback || !primary.id || !projectId) return;
    setPending(true);
    setMessage(null);
    try {
      await onSubmitFeedback(
        primary.id,
        primary.riskId,
        rating,
        showComment ? comment : undefined,
      );
      setMessage(
        rating === 'helpful'
          ? 'Thanks — marked as helpful.'
          : 'Thanks — we will improve this explanation.',
      );
      setShowComment(false);
      setComment('');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="settings-section scroll-mt-24" aria-labelledby="ai-panel-heading">
      <h2 id="ai-panel-heading" className="settings-section-title">
        Why is this project at risk?
      </h2>
      <p className="settings-section-lead">
        AI summary of the strongest signals. Use the risk cards above for specific actions.
      </p>
      <ul className="mt-4 space-y-2">
        {(bullets.length > 0 ? bullets : [primary.rootCause]).map((item) => (
          <li
            key={item}
            className="flex gap-2.5 text-sm leading-relaxed before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-primary/60 before:content-['']"
          >
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-primary/80">
          Recommended action
        </p>
        <p className="mt-1 font-medium text-primary">{primary.recommendedAction}</p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Confidence: {primary.confidence}%</p>

      {onSubmitFeedback && projectId && primary.id ? (
        <div className="no-print mt-5 space-y-3 border-t border-border/60 pt-4">
          {message ? (
            <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} />
          ) : null}
          <p className="text-sm text-muted-foreground">Was this explanation helpful?</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || existingRating != null}
              onClick={() => void handleFeedback('helpful')}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs disabled:opacity-50',
                existingRating === 'helpful'
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                  : 'border-border hover:bg-muted/40',
              )}
            >
              Helpful
            </button>
            <button
              type="button"
              disabled={pending || existingRating != null}
              onClick={() => void handleFeedback('not_helpful')}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs disabled:opacity-50',
                existingRating === 'not_helpful'
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                  : 'border-border hover:bg-muted/40',
              )}
            >
              Not helpful
            </button>
            {!existingRating ? (
              <button
                type="button"
                onClick={() => setShowComment((value) => !value)}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted/40"
              >
                {showComment ? 'Hide comment' : 'Add comment'}
              </button>
            ) : null}
          </div>
          {showComment && !existingRating ? (
            <textarea
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              rows={2}
              maxLength={500}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Optional feedback for the team"
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
