/** Detect OAuth / credential failures that require admin reconnection. */
export function isAuthRelatedIntegrationError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('token refresh failed') ||
    normalized.includes('invalid_grant') ||
    normalized.includes('invalid_token') ||
    normalized.includes('oauth') ||
    normalized.includes('unauthorized') ||
    normalized.includes('authentication required') ||
    normalized.includes('revoked') ||
    (normalized.includes('expired') && normalized.includes('token')) ||
    /\b401\b/.test(message)
  );
}

const INTEGRATION_LABELS: Record<string, string> = {
  salesforce: 'Salesforce',
  jira: 'Jira',
  slack: 'Slack',
  google_calendar: 'Google Calendar',
  hubspot: 'HubSpot',
};

export function integrationDisplayName(source: string): string {
  return INTEGRATION_LABELS[source] ?? source;
}

export function buildIntegrationAuthAlertContent(input: {
  source: string;
  errorMessage: string;
  integrationsUrl: string;
}): { title: string; body: string; subject: string; text: string; html: string } {
  const label = integrationDisplayName(input.source);
  const title = `${label} connection needs attention`;
  const body = `${label} authentication failed. Reconnect the integration to restore data sync. Error: ${input.errorMessage}`;
  const text = [
    body,
    '',
    `Reconnect in Integrations → ${input.integrationsUrl}`,
  ].join('\n');
  const html = [
    `<p><strong>${label}</strong> authentication failed.</p>`,
    `<p>Reconnect the integration to restore data sync.</p>`,
    `<p><code>${escapeHtml(input.errorMessage)}</code></p>`,
    `<p><a href="${input.integrationsUrl}">Open Integrations</a></p>`,
  ].join('');

  return { title, body, subject: title, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
