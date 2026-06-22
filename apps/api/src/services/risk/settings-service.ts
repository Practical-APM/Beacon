import { tenants, withTenantContext, type Database } from '@beacon/db';
import {
  applyRiskSettingsPatch,
  buildRiskRulesApiResponse,
  resetRiskSettings,
  type RiskRulesApiResponse,
} from '@beacon/shared/risk-rules-ui';
import type { TenantRiskSettings } from '@beacon/shared';
import { eq } from 'drizzle-orm';

export async function getTenantRiskRules(
  db: Database,
  tenantId: string,
): Promise<RiskRulesApiResponse> {
  return withTenantContext(db, tenantId, async () => {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    return buildRiskRulesApiResponse((tenant?.riskSettings ?? {}) as TenantRiskSettings);
  });
}

export async function updateTenantRiskRules(
  db: Database,
  tenantId: string,
  patch: TenantRiskSettings,
): Promise<RiskRulesApiResponse> {
  return withTenantContext(db, tenantId, async () => {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const current = (tenant?.riskSettings ?? {}) as TenantRiskSettings;
    const next = applyRiskSettingsPatch(current, patch);

    await db
      .update(tenants)
      .set({ riskSettings: next as Record<string, unknown>, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    return buildRiskRulesApiResponse(next);
  });
}

export async function resetTenantRiskRules(
  db: Database,
  tenantId: string,
): Promise<RiskRulesApiResponse> {
  return withTenantContext(db, tenantId, async () => {
    const next = resetRiskSettings();
    await db
      .update(tenants)
      .set({ riskSettings: next as Record<string, unknown>, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
    return buildRiskRulesApiResponse(next);
  });
}
