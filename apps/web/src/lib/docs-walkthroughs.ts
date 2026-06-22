import { MARKETING_SCREENSHOTS, type MarketingScreenshotKey } from '@/lib/marketing-screenshots';

export type DocsWalkthroughStep = {
  id: string;
  title: string;
  body: string;
  screenshot?: MarketingScreenshotKey;
  screenshotTitle?: string;
  screenshotAlt?: string;
  /** Primary action — opens app route in one click */
  action?: { href: string; label: string };
  code?: string;
};

export type DocsWalkthrough = {
  id: string;
  title: string;
  description: string;
  duration: string;
  outcome: string;
  steps: DocsWalkthroughStep[];
};

export const DOC_WALKTHROUGHS: DocsWalkthrough[] = [
  {
    id: 'try-prototype',
    title: 'Try the prototype',
    description: 'See portfolio risk with demo data in under two minutes. No OAuth required locally.',
    duration: '2 min',
    outcome: 'You will land on the portfolio dashboard with seeded at-risk projects.',
    steps: [
      {
        id: 'sign-in',
        title: 'Open the workspace',
        body: 'Go to sign-in and choose Enter demo workspace. Locally this uses dev mode with seeded Acme Corp data.',
        action: { href: '/sign-in', label: 'Open sign-in' },
      },
      {
        id: 'portfolio',
        title: 'Scan the portfolio',
        body: 'The dashboard highlights at-risk implementations, revenue delayed, and a prioritized risk feed sorted by impact.',
        screenshot: 'dashboard',
        screenshotTitle: 'Portfolio dashboard',
        screenshotAlt: 'Portfolio dashboard with at-risk projects and revenue metrics',
        action: { href: '/dashboard', label: 'Open dashboard' },
      },
      {
        id: 'first-project',
        title: 'Open your first at-risk project',
        body: 'Click the top priority card or use Open top priority. Each project shows predicted delay, root cause, and suggested actions.',
        screenshot: 'project',
        screenshotTitle: 'Project intelligence',
        screenshotAlt: 'Project detail with predicted delay and recommended action',
        action: { href: '/dashboard', label: 'Find top priority' },
      },
    ],
  },
  {
    id: 'connect-stack',
    title: 'Connect your stack',
    description: 'Wire Salesforce, Jira, Slack, and Calendar so risk signals have evidence behind them.',
    duration: '10 min',
    outcome: 'Core integrations connected and first Salesforce sync running.',
    steps: [
      {
        id: 'wizard',
        title: 'Start the setup wizard',
        body: 'The guided wizard walks admins through OAuth, field mapping, and the first bulk sync. Contributors can view progress read-only.',
        screenshot: 'integrations',
        screenshotTitle: 'Connections',
        screenshotAlt: 'Integrations page with connected systems',
        action: { href: '/integrations/setup', label: 'Open setup wizard' },
      },
      {
        id: 'salesforce',
        title: 'Map Salesforce fields',
        body: 'Required opportunity fields must map to Beacon project attributes before sync. The UI blocks bulk sync until mappings are complete.',
        screenshot: 'integrations',
        screenshotTitle: 'Field mappings',
        screenshotAlt: 'Salesforce field mapping configuration',
        action: { href: '/integrations#salesforce-mappings', label: 'Open field mappings' },
      },
      {
        id: 'sync',
        title: 'Run the first sync',
        body: 'After mappings save, run bulk sync. The dashboard unlocks risk scoring when opportunities import successfully.',
        action: { href: '/integrations#salesforce', label: 'Run sync' },
      },
    ],
  },
  {
    id: 'triage-risk',
    title: 'Triage a risk',
    description: 'Move from portfolio alert to owner assignment without another status meeting.',
    duration: '5 min',
    outcome: 'You acknowledged a risk and know the next action to take.',
    steps: [
      {
        id: 'feed',
        title: 'Filter the risk feed',
        body: 'Use owner and severity filters to focus on your book of business. Active filter chips show what is applied — remove any with one click.',
        screenshot: 'dashboard',
        screenshotTitle: 'Risk feed',
        screenshotAlt: 'Dashboard risk feed with filters',
        action: { href: '/dashboard', label: 'Open risk feed' },
      },
      {
        id: 'project',
        title: 'Review project intelligence',
        body: 'Project pages put suggested actions first, then evidence from Jira, Slack, and CRM. Use section jump nav to move between risks, delay forecast, and timeline.',
        screenshot: 'project',
        screenshotTitle: 'Project detail',
        screenshotAlt: 'Project page with risks and recommended action',
        action: { href: '/dashboard', label: 'Open a project' },
      },
      {
        id: 'acknowledge',
        title: 'Acknowledge or escalate',
        body: 'Admins and operational leads can acknowledge, snooze, or resolve risks. Contributors see view-only guidance and can mailto the project owner.',
        action: { href: '/settings?tab=preferences', label: 'Set alert preferences' },
      },
    ],
  },
  {
    id: 'self-host',
    title: 'Self-host locally',
    description: 'Run the full stack on your machine for evaluation or internal pilots.',
    duration: '5 min',
    outcome: 'Website, app, and API running locally with seeded demo data.',
    steps: [
      {
        id: 'clone',
        title: 'Clone and install',
        body: 'The monorepo includes web, API, workers, and shared packages. make dev starts everything with hot reload.',
        code: `git clone https://github.com/beacon/beacon.git
cd beacon && npm install
make dev
# App: http://localhost:3000
# API: http://localhost:3001`,
      },
      {
        id: 'seed',
        title: 'Seed demo data',
        body: 'Run db-seed to load Acme and Globex tenants, sample projects, and risk signals. Then sign in via the dev user picker.',
        code: 'make db-seed',
        action: { href: '/sign-in', label: 'Sign in locally' },
      },
      {
        id: 'configure',
        title: 'Configure for production',
        body: 'Swap dev auth for Clerk, set environment variables, and connect real OAuth credentials when you are ready to pilot with live data.',
        action: { href: '/security', label: 'Read security overview' },
      },
    ],
  },
];

export const DOC_REFERENCE_SECTIONS = [
  {
    id: 'getting-started',
    label: 'Getting started',
    summary: 'Prototype, self-host, and workspace basics.',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    summary: 'Salesforce, Jira, Slack, Google Calendar, and webhooks.',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    summary: 'Portfolio metrics, benchmarks, filters, and executive print.',
  },
  {
    id: 'settings',
    label: 'Settings',
    summary: 'Notifications, risk rules, privacy, and admin controls.',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    summary: 'Export, deletion, DPA, and compliance.',
  },
] as const;

export function getWalkthrough(id: string | null): DocsWalkthrough | undefined {
  if (!id) return undefined;
  return DOC_WALKTHROUGHS.find((guide) => guide.id === id);
}

export function screenshotSrc(key: MarketingScreenshotKey): string {
  return MARKETING_SCREENSHOTS[key];
}
