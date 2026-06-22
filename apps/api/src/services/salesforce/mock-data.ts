import type { SalesforceEnvironment } from '@beacon/shared';
import type { SalesforceOpportunityRecord } from './types.js';

export function getMockOpportunities(): SalesforceOpportunityRecord[] {
  const baseDate = Date.now();
  const accounts = [
    { id: '001MOCK0001', name: 'Northwind Traders' },
    { id: '001MOCK0002', name: 'Contoso Ltd' },
    { id: '001MOCK0003', name: 'Fabrikam Inc' },
    { id: '001MOCK0004', name: 'Adventure Works' },
    { id: '001MOCK0005', name: 'Tailspin Toys' },
    { id: '001MOCK0006', name: 'Wide World Importers' },
  ];

  const stages = ['Implementation', 'Onboarding', 'Negotiation', 'Proposal'];
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
    const modstamp = new Date(baseDate - index * 60_000).toISOString();

    return {
      Id: `006MOCK${String(index + 1).padStart(4, '0')}`,
      Name: `${account.name} — Phase ${index + 1}`,
      AccountId: account.id,
      Account: { Name: account.name },
      Owner: { Name: owner.name, Email: owner.email },
      StageName: stages[index % stages.length] ?? 'Implementation',
      IsClosed: false,
      IsWon: false,
      Amount: hasArr ? 25_000 + index * 5_000 : null,
      CloseDate: hasGoLive
        ? new Date(baseDate + (20 + index) * 86_400_000).toISOString().slice(0, 10)
        : null,
      CurrencyIsoCode: index % 5 === 0 ? 'EUR' : 'USD',
      SystemModstamp: modstamp,
    };
  });
}

export function createMockCredentials(orgId = 'mock-org-001', environment: SalesforceEnvironment = 'sandbox') {
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    instanceUrl: 'https://mock.salesforce.com',
    environment,
    orgId,
    issuedAt: String(Date.now()),
  };
}
