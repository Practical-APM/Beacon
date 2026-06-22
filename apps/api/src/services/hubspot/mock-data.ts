import type { HubSpotDealRecord } from './types.js';

export function getMockDeals(): HubSpotDealRecord[] {
  const baseDate = Date.now();
  const companies = [
    { id: 'co-mock-001', name: 'Northwind Traders' },
    { id: 'co-mock-002', name: 'Contoso Ltd' },
    { id: 'co-mock-003', name: 'Fabrikam Inc' },
    { id: 'co-mock-004', name: 'Adventure Works' },
    { id: 'co-mock-005', name: 'Tailspin Toys' },
    { id: 'co-mock-006', name: 'Wide World Importers' },
  ];

  const stages = ['implementation', 'onboarding', 'negotiation', 'proposal'];
  const owners = [
    { name: 'Alex Rivera', email: 'alex.rivera@acme-demo.test' },
    { name: 'Jamie Chen', email: 'jamie.chen@acme-demo.test' },
    { name: 'Morgan Lee', email: 'morgan.lee@acme-demo.test' },
    { name: 'Taylor Brooks', email: 'contributor-a@acme-demo.test' },
  ];

  return Array.from({ length: 12 }, (_, index) => {
    const company = companies[index % companies.length]!;
    const owner = owners[index % owners.length]!;
    const hasGoLive = index !== 2 && index !== 7;
    const hasArr = index !== 4;
    const modified = new Date(baseDate - index * 60_000).toISOString();

    return {
      id: `deal-mock-${String(index + 1).padStart(4, '0')}`,
      dealname: `${company.name} — Phase ${index + 1}`,
      companyId: company.id,
      companyName: company.name,
      ownerName: owner.name,
      ownerEmail: owner.email,
      dealstage: stages[index % stages.length] ?? 'implementation',
      amount: hasArr ? 25_000 + index * 5_000 : null,
      closedate: hasGoLive
        ? new Date(baseDate + (20 + index) * 86_400_000).toISOString().slice(0, 10)
        : null,
      hs_lastmodifieddate: modified,
    };
  });
}

export function createMockCredentials(portalId = 'mock-portal-001') {
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    portalId,
    issuedAt: String(Date.now()),
  };
}
