import { expect, test } from '@playwright/test';
import { isApiReady, isDevAuthE2EReady } from './helpers';

const DEV_SESSION_KEY = 'beacon.dev.session';
const TENANT_KEY = 'beacon.activeTenantId';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function seedDevSession(page: import('@playwright/test').Page, externalAuthId = 'admin-a') {
  const response = await page.request.get(`${API_URL}/v1/me`, {
    headers: { Authorization: `Bearer dev:${externalAuthId}` },
  });
  expect(response.ok()).toBeTruthy();
  const profile = (await response.json()) as {
    memberships: Array<{ tenantId: string }>;
  };
  const activeTenantId = profile.memberships[0]?.tenantId ?? null;

  await page.addInitScript(
    ({ sessionKey, tenantKey, session, tenantId }) => {
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
      if (tenantId) {
        window.localStorage.setItem(tenantKey, tenantId);
      }
    },
    {
      sessionKey: DEV_SESSION_KEY,
      tenantKey: TENANT_KEY,
      session: { externalAuthId, activeTenantId },
      tenantId: activeTenantId,
    },
  );
}

test.describe('public marketing routes', () => {
  test('loads home and sign-in without Clerk keys', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Beacon/i);
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Sign in', exact: true }),
    ).toBeVisible();

    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: /enter the demo workspace/i })).toBeVisible();
  });
});

test.describe('authenticated product routes (dev auth)', () => {
  test.beforeAll(async () => {
    if (!(await isApiReady()) || !isDevAuthE2EReady()) {
      test.skip(true, 'Requires API on :3001 and web on :3000');
    }
  });

  test('loads dashboard, integrations, settings, and onboarding', async ({ page }) => {
    await seedDevSession(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard(\?|$)/);
    await expect(
      page.getByRole('link', { name: /connections|integraciones|integrationen|intégrations/i }),
    ).toBeVisible({ timeout: 15_000 });

    await page.goto('/integrations');
    await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();

    await page.goto('/integrations/setup');
    await expect(page.getByText('Connect your CRM')).toBeVisible();

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole('tab', { name: 'Preferences' })).toBeVisible();
  });
});
