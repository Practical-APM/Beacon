import type { JiraIssueLinkRecord, JiraIssueRecord, JiraProjectRecord } from './types.js';

export function getMockJiraProjects(): JiraProjectRecord[] {
  return [
    { id: '10001', key: 'ACME', name: 'Acme Corp Implementation' },
    { id: '10002', key: 'ORPH', name: 'Unmapped Onboarding' },
  ];
}

export function getMockJiraIssues(projectId: string): JiraIssueRecord[] {
  if (projectId !== '10001') {
    return [
      {
        id: '30001',
        key: 'ORPH-1',
        fields: {
          summary: 'Unmapped onboarding checklist',
          issuetype: { name: 'Task' },
          status: { name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
          assignee: null,
          labels: ['onboarding'],
          priority: { name: 'Medium' },
        },
      },
    ];
  }

  return [
    {
      id: '20001',
      key: 'ACME-1',
      fields: {
        summary: 'Platform rollout epic',
        issuetype: { name: 'Epic' },
        status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
        assignee: { displayName: 'Alex Rivera', emailAddress: 'alex.rivera@acme-demo.test' },
        duedate: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10),
        labels: ['rollout', 'critical'],
        priority: { name: 'High' },
      },
    },
    {
      id: '20002',
      key: 'ACME-2',
      fields: {
        summary: 'Complete SSO configuration',
        issuetype: { name: 'Story' },
        status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
        assignee: { displayName: 'Jamie Chen', emailAddress: 'jamie.chen@acme-demo.test' },
        parent: { id: '20001', key: 'ACME-1' },
        labels: ['sso'],
        priority: { name: 'High' },
      },
    },
    {
      id: '20003',
      key: 'ACME-3',
      fields: {
        summary: 'Customer security questionnaire',
        issuetype: { name: 'Story' },
        status: { name: 'Blocked', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
        assignee: null,
        parent: { id: '20001', key: 'ACME-1' },
        labels: ['security'],
        priority: { name: 'Highest' },
      },
    },
    {
      id: '20004',
      key: 'ACME-4',
      fields: {
        summary: 'Upload SOC2 evidence',
        issuetype: { name: 'Sub-task' },
        status: { name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
        assignee: { displayName: 'Taylor Brooks', emailAddress: 'contributor-a@acme-demo.test' },
        parent: { id: '20003', key: 'ACME-3' },
        labels: ['security'],
        priority: { name: 'Medium' },
      },
    },
    {
      id: '20005',
      key: 'ACME-5',
      fields: {
        summary: 'Integration smoke tests',
        issuetype: { name: 'Task' },
        status: { name: 'Done', statusCategory: { key: 'done', name: 'Done' } },
        assignee: { displayName: 'Morgan Lee', emailAddress: 'morgan.lee@acme-demo.test' },
        parent: { id: '20001', key: 'ACME-1' },
        labels: ['qa'],
        priority: { name: 'Low' },
      },
    },
    {
      id: '20006',
      key: 'ACME-6',
      fields: {
        summary: 'Production cutover checklist',
        issuetype: { name: 'Story' },
        status: { name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
        assignee: { displayName: 'Alex Rivera', emailAddress: 'alex.rivera@acme-demo.test' },
        parent: { id: '20001', key: 'ACME-1' },
        labels: ['cutover'],
        priority: { name: 'High' },
      },
    },
  ];
}

export function getMockJiraIssueLinks(projectId: string): JiraIssueLinkRecord[] {
  if (projectId !== '10001') return [];
  return [
    {
      id: 'link-1',
      type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
      inwardIssue: { id: '20003', key: 'ACME-3' },
      outwardIssue: { id: '20002', key: 'ACME-2' },
    },
    {
      id: 'link-2',
      type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
      inwardIssue: { id: '20006', key: 'ACME-6' },
      outwardIssue: { id: '20003', key: 'ACME-3' },
    },
  ];
}

export function createMockJiraCredentials(cloudId = 'mock-cloud-001') {
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    cloudId,
    siteUrl: 'https://mock.atlassian.net',
    issuedAt: String(Date.now()),
  };
}
