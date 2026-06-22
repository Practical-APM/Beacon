export interface EvidenceItem {
  source?: string;
  signal?: string;
  description?: string;
  deepLink?: string | null;
  entityId?: string | null;
  timestamp?: string | null;
  unavailable?: boolean;
}

function buildFallbackDeepLink(item: EvidenceItem): string | null {
  if (item.deepLink) return item.deepLink;
  if (!item.entityId) return null;

  switch (item.source) {
    case 'jira':
      return `https://jira.example.com/browse/${item.entityId}`;
    case 'salesforce':
      return `https://login.salesforce.com/${item.entityId}`;
    case 'slack':
      return `https://slack.com/app_redirect?channel=${item.entityId}`;
    default:
      return null;
  }
}

export function resolveEvidenceLink(item: EvidenceItem): {
  href: string | null;
  unavailable: boolean;
} {
  if (item.unavailable) {
    return { href: null, unavailable: true };
  }

  const href = buildFallbackDeepLink(item);
  if (!href) {
    return { href: null, unavailable: true };
  }

  return { href, unavailable: false };
}

export function formatTimelineEvent(event: {
  eventType: string;
  source: string;
  payload?: Record<string, unknown> | null;
  externalId?: string | null;
}): string {
  const payload = event.payload ?? {};
  switch (event.eventType) {
    case 'task_updated':
      return `Task updated${payload.title ? `: ${payload.title}` : ''}`;
    case 'task_completed':
      return `Task completed${payload.title ? `: ${payload.title}` : ''}`;
    case 'milestone_updated':
      return `Milestone updated${payload.name ? `: ${payload.name}` : ''}`;
    case 'customer_updated':
      return payload.field === 'goLiveDate' || payload.field === 'targetGoLiveDate'
        ? 'Go-live date updated in Salesforce'
        : 'Customer record updated in Salesforce';
    case 'slack_message':
      return `Slack activity in ${payload.channelName ? `#${payload.channelName}` : 'channel'}`;
    case 'integration_health':
      return `Integration health event (${event.source})`;
    default:
      return `${event.eventType.replace(/_/g, ' ')} (${event.source})`;
  }
}

export function timelineDeepLink(event: {
  source: string;
  externalId?: string | null;
  payload?: Record<string, unknown> | null;
}): string | null {
  const payload = event.payload ?? {};
  if (typeof payload.deepLink === 'string') return payload.deepLink;
  if (typeof payload.url === 'string') return payload.url;
  if (!event.externalId) return null;

  switch (event.source) {
    case 'jira':
      return `https://jira.example.com/browse/${event.externalId}`;
    case 'salesforce':
      return `https://login.salesforce.com/${event.externalId}`;
    case 'slack':
      return `https://slack.com/app_redirect?channel=${event.externalId}`;
    default:
      return null;
  }
}
