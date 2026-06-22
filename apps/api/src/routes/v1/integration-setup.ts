import { createDb } from '@beacon/db';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { badRequest, problemResponse } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import {
  advanceSetup,
  autoApplyJiraMappings,
  autoApplyLinearMappings,
  autoApplySlackMappings,
  getSetupState,
} from '../../services/integrations/setup-orchestrator.js';
import {
  getCoreCrmPreference,
  setCoreCrmPreference,
} from '../../services/integrations/tenant-integration-settings.js';
import { getCoreCrmReadinessSnapshot } from '../../services/integrations/core-crm-resolver.js';
import { runSalesforceMappingHealthCheck } from '../../services/salesforce/field-mapping-rails.js';
import { runHubSpotMappingHealthCheck } from '../../services/hubspot/field-mapping-rails.js';
import { runDynamicsMappingHealthCheck } from '../../services/dynamics/field-mapping-rails.js';
import { runPipedriveMappingHealthCheck } from '../../services/pipedrive/field-mapping-rails.js';

const coreCrmPreferenceSchema = z.object({
  coreCrmId: z.string().min(1),
});

export const integrationSetupRoutes = new Hono();

integrationSetupRoutes.get(
  '/integrations/core-crm/preference',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const preference = await getCoreCrmPreference(db, auth.tenantId);
    return c.json(preference);
  },
);

integrationSetupRoutes.patch(
  '/integrations/core-crm/preference',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const body = coreCrmPreferenceSchema.safeParse(await c.req.json());
    if (!body.success) {
      return problemResponse(c, badRequest(body.error.message));
    }

    const { db } = createDb(env.DATABASE_URL);
    try {
      const preference = await setCoreCrmPreference(db, auth.tenantId, body.data.coreCrmId);
      return c.json(preference);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update CRM preference';
      return problemResponse(c, badRequest(message));
    }
  },
);

integrationSetupRoutes.get(
  '/integrations/core-crm/readiness',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const readiness = await getCoreCrmReadinessSnapshot(db, auth.tenantId);
    return c.json(readiness);
  },
);

integrationSetupRoutes.get(
  '/integrations/setup/state',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const state = await getSetupState(db, auth.tenantId);
    return c.json(state);
  },
);

integrationSetupRoutes.post(
  '/integrations/setup/advance',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const result = await advanceSetup(db, auth.tenantId);
    return c.json(result);
  },
);

integrationSetupRoutes.post(
  '/integrations/salesforce/ensure-mappings',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const metadata = await runSalesforceMappingHealthCheck(db, auth.tenantId);
    return c.json({ metadata });
  },
);

integrationSetupRoutes.post(
  '/integrations/hubspot/ensure-mappings',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const metadata = await runHubSpotMappingHealthCheck(db, auth.tenantId);
    return c.json({ metadata });
  },
);

integrationSetupRoutes.post(
  '/integrations/microsoft-dynamics/ensure-mappings',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const metadata = await runDynamicsMappingHealthCheck(db, auth.tenantId);
    return c.json({ metadata });
  },
);

integrationSetupRoutes.post(
  '/integrations/pipedrive/ensure-mappings',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const metadata = await runPipedriveMappingHealthCheck(db, auth.tenantId);
    return c.json({ metadata });
  },
);

integrationSetupRoutes.post(
  '/integrations/jira/auto-map',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const mapped = await autoApplyJiraMappings(db, auth.tenantId);
    return c.json({ mapped });
  },
);

integrationSetupRoutes.post(
  '/integrations/linear/auto-map',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const mapped = await autoApplyLinearMappings(db, auth.tenantId);
    return c.json({ mapped });
  },
);

integrationSetupRoutes.post(
  '/integrations/slack/auto-map',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const mapped = await autoApplySlackMappings(db, auth.tenantId);
    return c.json({ mapped });
  },
);
