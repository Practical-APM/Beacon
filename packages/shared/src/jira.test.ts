import { describe, expect, it } from 'vitest';
import {
  classifyJiraIssueType,
  DEFAULT_JIRA_ISSUE_TYPE_MAPPING,
  mapJiraStatusCategory,
  suggestProjectMappings,
} from './jira.js';

describe('jira shared helpers', () => {
  it('maps Jira status categories', () => {
    expect(mapJiraStatusCategory('done')).toBe('done');
    expect(mapJiraStatusCategory('indeterminate')).toBe('in_progress');
    expect(mapJiraStatusCategory('new')).toBe('todo');
  });

  it('classifies issue types from tenant mapping', () => {
    expect(classifyJiraIssueType('Epic', DEFAULT_JIRA_ISSUE_TYPE_MAPPING)).toBe('epic');
    expect(classifyJiraIssueType('Story', DEFAULT_JIRA_ISSUE_TYPE_MAPPING)).toBe('story');
    expect(classifyJiraIssueType('Sub-task', DEFAULT_JIRA_ISSUE_TYPE_MAPPING)).toBe('subtask');
  });

  it('suggests project mappings by name similarity', () => {
    const suggestions = suggestProjectMappings(
      [{ id: '1', key: 'ACME', name: 'Acme Corp Implementation' }],
      [{ id: 'p1', name: 'Acme Corp Implementation' }],
    );
    expect(suggestions[0]?.suggestedProjectId).toBe('p1');
    expect(suggestions[0]?.confidence).toBeGreaterThanOrEqual(40);
  });
});
