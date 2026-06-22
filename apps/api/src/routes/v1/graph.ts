import { createDb } from '@beacon/db';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { badRequest, notFound, problemResponse } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { getLatestGraphRebuildJob, runGraphRebuild, startGraphRebuild } from '../../services/graph/builder.js';
import {
  createManualEntityLink,
  listEntityLinks,
} from '../../services/graph/entity-resolution.js';
import {
  getOwnerWorkload,
  getPortfolioSummary,
  getProjectBlockers,
  getProjectGraph,
} from '../../services/graph/queries.js';

const entityLinkSchema = z.object({
  linkType: z.enum(['owner', 'customer_account', 'project_mapping']),
  canonicalKey: z.string().min(1),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  source: z.enum(['salesforce', 'jira', 'slack', 'google_calendar']).optional(),
  externalId: z.string().optional(),
  internalEntityId: z.string().uuid().optional(),
  confidence: z.number().int().min(0).max(100).optional(),
});

export const graphRoutes = new Hono();

graphRoutes.get('/graph/portfolio', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const includeInactive = c.req.query('includeInactive') === 'true';
  const { db } = createDb(env.DATABASE_URL);
  const summary = await getPortfolioSummary(db, auth.tenantId, includeInactive);
  return c.json(summary);
});

graphRoutes.get('/graph/projects/:projectId', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const projectId = c.req.param('projectId');
  if (!projectId) return problemResponse(c, badRequest('Missing projectId'));

  const { db } = createDb(env.DATABASE_URL);
  const graph = await getProjectGraph(db, auth.tenantId, projectId);
  if (graph.nodes.length === 0 && graph.warnings?.includes('Project not found')) {
    return problemResponse(c, notFound('Project not found'));
  }
  return c.json(graph);
});

graphRoutes.get(
  '/graph/projects/:projectId/blockers',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const projectId = c.req.param('projectId');
    if (!projectId) return problemResponse(c, badRequest('Missing projectId'));

    const { db } = createDb(env.DATABASE_URL);
    const blockers = await getProjectBlockers(db, auth.tenantId, projectId);
    return c.json(blockers);
  },
);

graphRoutes.get('/graph/owners/workload', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const workload = await getOwnerWorkload(db, auth.tenantId);
  return c.json({ data: workload });
});

graphRoutes.get('/graph/entity-links', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const linkType = c.req.query('linkType');
  const parsedType =
    linkType === 'owner' || linkType === 'customer_account' || linkType === 'project_mapping'
      ? linkType
      : undefined;
  const { db } = createDb(env.DATABASE_URL);
  const links = await listEntityLinks(db, auth.tenantId, parsedType);
  return c.json({ data: links });
});

graphRoutes.post('/graph/entity-links', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = entityLinkSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  const link = await createManualEntityLink(db, auth.tenantId, body.data);
  return c.json({ link }, 201);
});

graphRoutes.post('/graph/rebuild', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = (await c.req.json().catch(() => ({}))) as {
    rebuildType?: 'full' | 'incremental';
    projectId?: string;
    async?: boolean;
  };
  const rebuildType = body.rebuildType === 'incremental' ? 'incremental' : 'full';
  const { db } = createDb(env.DATABASE_URL);

  if (body.async) {
    startGraphRebuild(db, auth.tenantId, rebuildType, body.projectId);
    return c.json({ status: 'started', rebuildType }, 202);
  }

  try {
    const result = await runGraphRebuild(db, auth.tenantId, rebuildType, body.projectId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Graph rebuild failed';
    return problemResponse(c, badRequest(message));
  }
});

graphRoutes.get('/graph/rebuild/status', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const job = await getLatestGraphRebuildJob(db, auth.tenantId);
  return c.json({ job });
});
