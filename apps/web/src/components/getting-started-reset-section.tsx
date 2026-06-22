'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppSection } from '@/components/app-section';
import { FeedbackBanner } from '@/components/feedback-banner';
import { resetGettingStarted } from '@/lib/getting-started';

export function GettingStartedResetSection() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  function handleReset() {
    resetGettingStarted();
    setMessage('Getting started checklist reset. Visit the dashboard to see it again.');
    router.refresh();
  }

  return (
    <AppSection
      title="Getting started checklist"
      description="Reset the dashboard onboarding checklist if you dismissed it or want to walk through the demo flow again."
    >
      <button type="button" className="btn-secondary" onClick={handleReset}>
        Show checklist again
      </button>
      {message ? (
        <FeedbackBanner
          variant="success"
          message={message}
          onDismiss={() => setMessage(null)}
        />
      ) : null}
    </AppSection>
  );
}
