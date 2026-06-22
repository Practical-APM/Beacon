'use client';

import { FeedbackBanner } from '@/components/feedback-banner';

export function DomainCollisionBanner({ message }: { message: string }) {
  return <FeedbackBanner variant="warning" message={message} />;
}
