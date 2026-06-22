import type { JiraIssueTypeMapping } from '@beacon/shared';

export interface JiraCredentials {
  accessToken: string;
  refreshToken: string;
  cloudId: string;
  siteUrl: string;
  issuedAt: string;
}

export interface JiraIssueRecord {
  id: string;
  key: string;
  fields: {
    summary: string;
    issuetype: { name: string; subtask?: boolean };
    status: { name: string; statusCategory?: { key?: string; name?: string } | null };
    assignee?: { displayName?: string | null; emailAddress?: string | null } | null;
    duedate?: string | null;
    priority?: { name?: string | null } | null;
    labels?: string[] | null;
    parent?: { id: string; key?: string } | null;
    updated?: string | null;
  };
}

export interface JiraIssueLinkRecord {
  id: string;
  type: { inward?: string; outward?: string; name?: string };
  inwardIssue?: { id: string; key: string } | null;
  outwardIssue?: { id: string; key: string } | null;
}

export interface JiraProjectRecord {
  id: string;
  key: string;
  name: string;
}

export interface MappedJiraIssue {
  externalId: string;
  externalKey: string;
  title: string;
  issueKind: 'epic' | 'story' | 'task' | 'subtask' | 'unknown';
  status: string;
  statusCategory: 'todo' | 'in_progress' | 'done';
  assigneeName: string | null;
  assigneeEmail: string | null;
  dueDate: Date | null;
  priority: string | null;
  labels: string[];
  parentExternalId: string | null;
  jiraProjectId: string;
}

export interface JiraSyncIssueTypeMapping extends JiraIssueTypeMapping {}
