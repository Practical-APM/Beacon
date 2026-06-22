import type { DynamicsOpportunityRecord } from './types.js';

export function getMockOpportunities(): DynamicsOpportunityRecord[] {
  const baseDate = Date.now();
  const accounts = [
    { id: 'dyn-acct-001', name: 'Northwind Traders' },
    { id: 'dyn-acct-002', name: 'Contoso Ltd' },
    { id: 'dyn-acct-003', name: 'Fabrikam Inc' },
    { id: 'dyn-acct-004', name: 'Adventure Works' },
    { id: 'dyn-acct-005', name: 'Tailspin Toys' },
    { id: 'dyn-acct-006', name: 'Wide World Importers' },
  ];

  const stages = ['Proposal', 'Negotiation', 'Implementation', 'Onboarding'];
  const owners = [
    { name: 'Alex Rivera', email: 'alex.rivera@acme-demo.test' },
    { name: 'Jamie Chen', email: 'jamie.chen@acme-demo.test' },
    { name: 'Morgan Lee', email: 'morgan.lee@acme-demo.test' },
    { name: 'Taylor Brooks', email: 'contributor-a@acme-demo.test' },
  ];

  return Array.from({ length: 12 }, (_, index) => {
    const account = accounts[index % accounts.length]!;
    const owner = owners[index % owners.length]!;
    const hasGoLive = index !== 2 && index !== 7;
    const hasArr = index !== 4;
    const modified = new Date(baseDate - index * 60_000).toISOString();

    return {
      opportunityid: `dyn-opp-${String(index + 1).padStart(4, '0')}`,
      name: `${account.name} — Phase ${index + 1}`,
      accountId: account.id,
      accountName: account.name,
      ownerName: owner.name,
      ownerEmail: owner.email,
      stageName: stages[index % stages.length] ?? 'Implementation',
      amount: hasArr ? 30_000 + index * 4_000 : null,
      closedate: hasGoLive
        ? new Date(baseDate + (20 + index) * 86_400_000).toISOString().slice(0, 10)
        : null,
      modifiedon: modified,
    };
  });
}

export function createMockCredentials(orgId = 'mock-dynamics-org-001') {
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    orgUrl: 'https://mock.crm.dynamics.com',
    orgId,
    azureTenantId: 'mock-azure-tenant',
    issuedAt: String(Date.now()),
  };
}
