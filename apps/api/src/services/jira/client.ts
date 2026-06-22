import type { JiraCredentials, JiraIssueLinkRecord, JiraIssueRecord, JiraProjectRecord } from './types.js';

const MAX_RETRIES = 3;

export class JiraClient {
  constructor(
    private credentials: JiraCredentials,
    private readonly onTokenRefreshed?: (credentials: JiraCredentials) => Promise<void>,
  ) {}

  async listProjects(): Promise<JiraProjectRecord[]> {
    const data = await this.request<{ values: JiraProjectRecord[] }>(
      `/rest/api/3/project/search?maxResults=100`,
    );
    return data.values ?? [];
  }

  async searchIssues(jql: string): Promise<JiraIssueRecord[]> {
    const data = await this.request<{ issues: JiraIssueRecord[] }>(
      `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary,issuetype,status,assignee,duedate,priority,labels,parent,updated`,
    );
    return data.issues ?? [];
  }

  async getIssueLinks(issueKeys: string[]): Promise<JiraIssueLinkRecord[]> {
    const links: JiraIssueLinkRecord[] = [];
    for (const key of issueKeys) {
      const issue = await this.request<{ fields?: { issuelinks?: JiraIssueLinkRecord[] } }>(
        `/rest/api/3/issue/${key}?fields=issuelinks`,
      );
      links.push(...(issue.fields?.issuelinks ?? []));
    }
    return links;
  }

  private async request<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
    if (this.credentials.accessToken === 'mock-access-token') {
      throw new Error('Mock Jira client should not call live API');
    }

    const url = `https://api.atlassian.com/ex/jira/${this.credentials.cloudId}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (res.status === 401 && attempt < MAX_RETRIES && this.onTokenRefreshed) {
      await this.onTokenRefreshed(this.credentials);
      return this.request(path, init, attempt + 1);
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '2');
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 * (attempt + 1)));
      return this.request(path, init, attempt + 1);
    }

    if (!res.ok) {
      throw new Error(`Jira API error (${res.status}): ${await res.text()}`);
    }

    return (await res.json()) as T;
  }
}
