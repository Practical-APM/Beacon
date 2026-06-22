'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function AiExplanationEmptyState() {
  return (
    <section className="settings-section scroll-mt-24" aria-labelledby="ai-panel-heading">
      <h2 id="ai-panel-heading" className="settings-section-title">
        Why is this project at risk?
      </h2>
      <p className="settings-section-lead">
        The AI summary is not available yet. Review the risk cards above for suggested actions and
        evidence. Connecting Jira and Slack improves root-cause depth.
      </p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/integrations/setup" className="font-medium text-primary hover:underline">
          Improve signal coverage
        </Link>
        <Link href="/docs?guide=triage-risk&step=1" className="font-medium text-primary hover:underline">
          How to investigate risks
        </Link>
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Summaries generate when enough cross-tool evidence is available.
      </p>
    </section>
  );
}
