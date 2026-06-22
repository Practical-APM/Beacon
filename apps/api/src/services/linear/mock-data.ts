import type { LinearIssueRecord, LinearTeamRecord } from './types.js';

export function getMockLinearTeams(): LinearTeamRecord[] {
  return [
    { id: 'linear-team-001', key: 'IMP', name: 'Implementation' },
    { id: 'linear-team-002', key: 'CS', name: 'Customer Success' },
    { id: 'linear-team-003', key: 'DEL', name: 'Delivery' },
  ];
}

export function getMockLinearIssues(): LinearIssueRecord[] {
  const baseDate = Date.now();
  const teams = getMockLinearTeams();
  const owners = [
    { name: 'Alex Rivera', email: 'alex.rivera@acme-demo.test' },
    { name: 'Jamie Chen', email: 'jamie.chen@acme-demo.test' },
    { name: 'Morgan Lee', email: 'morgan.lee@acme-demo.test' },
  ];

  return Array.from({ length: 18 }, (_, index) => {
    const team = teams[index % teams.length]!;
    const owner = owners[index % owners.length]!;
    const states = ['Backlog', 'In Progress', 'In Review', 'Done', 'Blocked'];
    return {
      id: `linear-issue-${String(index + 1).padStart(4, '0')}`,
      identifier: `${team.key}-${index + 1}`,
      title: `${team.name} rollout task ${index + 1}`,
      state: states[index % states.length] ?? 'In Progress',
      assigneeName: owner.name,
      assigneeEmail: owner.email,
      priority: index % 4 === 0 ? 'High' : 'Medium',
      teamId: team.id,
      updatedAt: new Date(baseDate - index * 45_000).toISOString(),
    };
  });
}

export function createMockLinearCredentials(organizationId = 'mock-linear-org-001') {
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    organizationId,
    organizationName: 'Acme Demo Org',
    issuedAt: String(Date.now()),
  };
}
