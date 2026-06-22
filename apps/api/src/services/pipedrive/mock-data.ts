import type { PipedriveDealRecord } from './types.js';

export function getMockDeals(): PipedriveDealRecord[] {
  const baseDate = Date.now();
  const companies = [
    { id: 'pd-org-001', name: 'Northwind Traders' },
    { id: 'pd-org-002', name: 'Contoso Ltd' },
    { id: 'pd-org-003', name: 'Fabrikam Inc' },
    { id: 'pd-org-004', name: 'Adventure Works' },
    { id: 'pd-org-005', name: 'Tailspin Toys' },
    { id: 'pd-org-006', name: 'Wide World Importers' },
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
      id: `pd-deal-${String(index + 1).padStart(4, '0')}`,
      title: `${company.name} — Phase ${index + 1}`,
      org_id: company.id,
      org_name: company.name,
      owner_name: owner.name,
      owner_email: owner.email,
      stage_name: stages[index % stages.length] ?? 'implementation',
      value: hasArr ? 25_000 + index * 5_000 : null,
      expected_close_date: hasGoLive
        ? new Date(baseDate + (20 + index) * 86_400_000).toISOString().slice(0, 10)
        : null,
      update_time: modified,
    };
  });
}

export function createMockCredentials(companyId = 'mock-pipedrive-company-001') {
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    companyId,
    apiDomain: 'mock-company.pipedrive.com',
    issuedAt: String(Date.now()),
  };
}
