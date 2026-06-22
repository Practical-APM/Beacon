export type JiraStatusCategory = 'todo' | 'in_progress' | 'done';

export interface JiraIssueTypeMapping {
  epic: string[];
  story: string[];
  task: string[];
  subtask: string[];
}

export interface JiraIntegrationMetadata {
  cloudId: string;
  siteUrl: string;
  issueTypeMapping: JiraIssueTypeMapping;
  orphanProjectIds: string[];
  lastSyncAt?: string | null;
  webhookRegistered?: boolean;
  syncProgress?: {
    status: 'idle' | 'running' | 'completed' | 'failed';
    recordsProcessed: number;
    recordsTotal: number | null;
    startedAt?: string;
    completedAt?: string;
    error?: string | null;
  };
}

export interface JiraProjectSummary {
  id: string;
  key: string;
  name: string;
}

export const DEFAULT_JIRA_ISSUE_TYPE_MAPPING: JiraIssueTypeMapping = {
  epic: ['Epic'],
  story: ['Story', 'User Story'],
  task: ['Task', 'Bug'],
  subtask: ['Sub-task', 'Subtask'],
};

export function mapJiraStatusCategory(statusCategory?: string | null): JiraStatusCategory {
  const normalized = (statusCategory ?? '').toLowerCase();
  if (normalized.includes('done') || normalized === 'complete' || normalized === 'closed') {
    return 'done';
  }
  if (
    normalized.includes('progress') ||
    normalized.includes('review') ||
    normalized === 'indeterminate'
  ) {
    return 'in_progress';
  }
  return 'todo';
}

export function classifyJiraIssueType(
  issueType: string,
  mapping: JiraIssueTypeMapping,
): 'epic' | 'story' | 'task' | 'subtask' | 'unknown' {
  const normalized = issueType.trim().toLowerCase();
  for (const [kind, values] of Object.entries(mapping) as Array<
    [keyof JiraIssueTypeMapping, string[]]
  >) {
    if (values.some((value) => value.toLowerCase() === normalized)) {
      return kind;
    }
  }
  return 'unknown';
}

export function suggestProjectMappings(
  jiraProjects: JiraProjectSummary[],
  beaconProjects: Array<{ id: string; name: string }>,
): Array<{ jiraProjectId: string; jiraProjectName: string; suggestedProjectId: string | null; suggestedProjectName: string | null; confidence: number }> {
  return jiraProjects.map((jiraProject) => {
    const jiraName = jiraProject.name.toLowerCase();
    let best: { id: string; name: string; score: number } | null = null;

    for (const project of beaconProjects) {
      const projectName = project.name.toLowerCase();
      let score = 0;
      if (projectName === jiraName) score = 100;
      else if (projectName.includes(jiraName) || jiraName.includes(projectName)) score = 70;
      else if (projectName.split(/\s+/).some((word) => jiraName.includes(word) && word.length > 3)) {
        score = 40;
      }
      if (!best || score > best.score) {
        best = { id: project.id, name: project.name, score };
      }
    }

    return {
      jiraProjectId: jiraProject.id,
      jiraProjectName: jiraProject.name,
      suggestedProjectId: best && best.score >= 40 ? best.id : null,
      suggestedProjectName: best && best.score >= 40 ? best.name : null,
      confidence: best?.score ?? 0,
    };
  });
}
