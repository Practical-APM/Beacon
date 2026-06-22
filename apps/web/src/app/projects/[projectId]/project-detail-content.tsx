'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { AppPageHeader } from '@/components/app-page-header';
import { ContributorReadOnlyBanner } from '@/components/contributor-read-only-banner';
import { ContextualDocsLink } from '@/components/contextual-docs-link';
import { FeedbackBanner } from '@/components/feedback-banner';
import { AiExplanationPanel } from '@/components/project/ai-explanation-panel';
import { AiExplanationEmptyState } from '@/components/project/ai-explanation-empty-state';
import {
  DelayPredictionPanel,
  type DelayPredictionData,
} from '@/components/project/delay-prediction-panel';
import { ProjectOverview, type ProjectOverviewData } from '@/components/project/project-overview';
import {
  ProjectRisksPanel,
  type ProjectRiskItem,
} from '@/components/project/project-risks-panel';
import { ProjectTimeline } from '@/components/project/project-timeline';
import { ProjectSectionNav } from '@/components/project/project-section-nav';
import { SetupIncompleteBanner } from '@/components/project/setup-incomplete-banner';
import { UnlinkedJiraProjectBanner } from '@/components/project/unlinked-jira-project-banner';
import { DependencyCycleBanner } from '@/components/project/dependency-cycle-banner';
import { ProjectDetailSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { markProjectViewedForChecklist } from '@/lib/getting-started';
import { useActiveMembership } from '@/components/providers/app-session-provider';
import { useApiClient } from '@/lib/use-api-client';

interface ProjectDetailResponse extends ProjectOverviewData {
  setupIncomplete?: boolean;
  jiraLinked?: boolean;
  openRisks: ProjectRiskItem[];
}

interface TimelineResponse {
  data: Array<{
    id: string;
    eventType: string;
    source: string;
    occurredAt: string;
    externalId?: string | null;
    payload?: Record<string, unknown> | null;
  }>;
}

interface InsightItem {
  id?: string;
  riskId: string;
  rootCause: string;
  recommendedAction: string;
  confidence: number;
  evidence?: Array<{ description?: string; signal?: string }>;
}

interface FeedbackItem {
  insightId: string | null;
  rating: 'helpful' | 'not_helpful';
}

export function ProjectDetailContent({ projectId }: { projectId: string }) {
  const { apiFetch, ready } = useApiClient();
  const membership = useActiveMembership();
  const isContributor = membership?.role === 'contributor';
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [delayPrediction, setDelayPrediction] = useState<DelayPredictionData | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse['data']>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [feedbackByInsightId, setFeedbackByInsightId] = useState<
    Record<string, 'helpful' | 'not_helpful'>
  >({});
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dependencyCycleCount, setDependencyCycleCount] = useState(0);

  useEffect(() => {
    markProjectViewedForChecklist();
  }, []);

  const loadProject = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const response = (await apiFetch(`/v1/projects/${projectId}?detail=full`)) as ProjectDetailResponse;
      setDetail(response);

      try {
        const predictionResponse = (await apiFetch(
          `/v1/projects/${projectId}/delay-prediction`,
        )) as { prediction: DelayPredictionData };
        setDelayPrediction(predictionResponse.prediction);
      } catch {
        setDelayPrediction(null);
      }

      setTimelineLoading(true);
      const timelineResponse = (await apiFetch(
        `/v1/projects/${projectId}/timeline?since=30d&limit=100`,
      )) as TimelineResponse;
      setTimeline(timelineResponse.data);
      setTimelineLoading(false);

      try {
        const blockersResponse = (await apiFetch(
          `/v1/graph/projects/${projectId}/blockers`,
        )) as { cycles?: string[][] };
        setDependencyCycleCount(blockersResponse.cycles?.length ?? 0);
      } catch {
        setDependencyCycleCount(0);
      }

      try {
        const insightResponse = (await apiFetch(`/v1/projects/${projectId}/insights`)) as {
          data: InsightItem[];
        };
        setInsights(insightResponse.data ?? []);

        const feedbackResponse = (await apiFetch(`/v1/projects/${projectId}/feedback`)) as {
          data: FeedbackItem[];
        };
        const nextFeedback: Record<string, 'helpful' | 'not_helpful'> = {};
        for (const item of feedbackResponse.data ?? []) {
          if (item.insightId) nextFeedback[item.insightId] = item.rating;
        }
        setFeedbackByInsightId(nextFeedback);
      } catch {
        setInsights([]);
        setFeedbackByInsightId({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, projectId, ready]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const updateRiskStatus = useCallback(
    async (riskId: string, status: 'acknowledged' | 'snoozed' | 'resolved', version: number) => {
      if (!detail) return;

      const previous = detail.openRisks;
      setDetail({
        ...detail,
        openRisks: previous.map((risk) =>
          risk.id === riskId
            ? {
                ...risk,
                status,
                version: version + 1,
              }
            : risk,
        ),
      });

      try {
        await apiFetch(`/v1/risks/${riskId}`, {
          method: 'PATCH',
          headers: { 'Idempotency-Key': `project-risk-${riskId}-${Date.now()}` },
          body: JSON.stringify({ status, version }),
        });
        await loadProject();
      } catch (err) {
        setDetail({ ...detail, openRisks: previous });
        setError(err instanceof Error ? err.message : 'Failed to update risk');
        throw err;
      }
    },
    [apiFetch, detail, loadProject],
  );

  const submitInsightFeedback = useCallback(
    async (
      insightId: string,
      _riskId: string,
      rating: 'helpful' | 'not_helpful',
      comment?: string,
    ) => {
      await apiFetch('/v1/feedback', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          targetType: 'insight',
          targetId: insightId,
          rating,
          comment,
        }),
      });
      setFeedbackByInsightId((current) => ({ ...current, [insightId]: rating }));
    },
    [apiFetch, projectId],
  );

  if (loading) {
    return <ProjectDetailSkeleton />;
  }

  if (error && !detail) {
    return (
      <div className="settings-section text-center">
        <p className="font-medium text-destructive">Unable to load project</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn-primary" onClick={() => void loadProject()}>
            Retry
          </button>
          <Link href="/dashboard" className="btn-secondary">
            Back to portfolio
          </Link>
          <Link href="/docs?guide=triage-risk&step=1" className="btn-secondary">
            Triage guide
          </Link>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const hasOpenRisks = detail.openRisks.length > 0;
  const topAction = detail.openRisks.find((risk) => risk.suggestedAction)?.suggestedAction;

  return (
    <div className="dashboard-print space-y-8">
      <AppPageHeader
        title={detail.project.name}
        description={
          detail.customer?.name
            ? `${detail.customer.name} · Implementation health and risk intelligence`
            : 'Implementation health and risk intelligence'
        }
      >
        <ContextualDocsLink className="no-print" />
        <Link href="/dashboard" className="btn-secondary no-print">
          ← Portfolio
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-secondary no-print inline-flex items-center gap-2"
          aria-label="Print project summary"
        >
          <Printer className="h-4 w-4" aria-hidden />
          Print
        </button>
      </AppPageHeader>

      {error ? (
        <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
      ) : null}

      {isContributor ? (
        <div className="no-print">
          <ContributorReadOnlyBanner
            context="this project's risks and timeline"
            adminHint="To acknowledge risks, sign in as an admin or operational lead."
          />
        </div>
      ) : null}

      {topAction ? (
        <div className="no-print rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-primary/80">
            Do this next
          </p>
          <p className="mt-1 font-medium text-primary">{topAction}</p>
        </div>
      ) : null}

      <ProjectSectionNav hasRisks={hasOpenRisks} />

      {detail.setupIncomplete ? (
        <div className="no-print">
          <SetupIncompleteBanner />
        </div>
      ) : null}

      {detail.jiraLinked === false ? (
        <div className="no-print">
          <UnlinkedJiraProjectBanner />
        </div>
      ) : null}

      {dependencyCycleCount > 0 ? (
        <div className="no-print">
          <DependencyCycleBanner cycleCount={dependencyCycleCount} />
        </div>
      ) : null}

      <div id="project-overview">
        <ProjectOverview data={detail} hasOpenRisks={hasOpenRisks} />
      </div>

      {delayPrediction ? (
        <div id="predicted-delay">
          <DelayPredictionPanel prediction={delayPrediction} />
        </div>
      ) : null}

      <div id="project-risks">
        <ProjectRisksPanel
          risks={detail.openRisks}
          arrAmount={detail.project.arrAmount}
          arrCurrency={detail.project.arrCurrency}
          onUpdateStatus={updateRiskStatus}
        />
      </div>

      {hasOpenRisks ? (
        <div id="ai-explanation">
          {insights.length > 0 ? (
            <AiExplanationPanel
              insights={insights}
              projectId={projectId}
              feedbackByInsightId={feedbackByInsightId}
              onSubmitFeedback={submitInsightFeedback}
            />
          ) : (
            <AiExplanationEmptyState />
          )}
        </div>
      ) : null}

      <ProjectTimeline events={timeline} loading={timelineLoading} />
    </div>
  );
}
