import { createDb } from '@beacon/db';
import { Hono } from 'hono';
import { env } from '../../env.js';
import { badRequest, problemResponse } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { auditContextFromRequest, recordAuditEvent } from '../../services/audit/audit-service.js';
import {
  getBenchmarkAdminStatus,
  getPortfolioBenchmark,
  refreshBenchmarkSnapshots,
} from '../../services/benchmarks/benchmark-service.js';

export const benchmarkRoutes = new Hono();

benchmarkRoutes.get('/benchmarks/portfolio', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const benchmark = await getPortfolioBenchmark(db, auth.tenantId);
  return c.json({ benchmark });
});

benchmarkRoutes.get('/admin/benchmarks/status', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const status = await getBenchmarkAdminStatus(db, auth.tenantId);
  return c.json({ status });
});

benchmarkRoutes.post('/admin/benchmarks/refresh', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);

  if (!env.FEATURE_BENCHMARKS_ENABLED) {
    return problemResponse(c, badRequest('Benchmarking is disabled for this environment'));
  }

  try {
    const result = await refreshBenchmarkSnapshots(db, { tenantId: auth.tenantId });
    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'benchmarks_refreshed',
      resourceType: 'benchmark_snapshot',
      resourceId: auth.tenantId,
      metadata: result,
      ...auditContextFromRequest(c),
    });
    return c.json({ result });
  } catch (error) {
    return problemResponse(
      c,
      badRequest(error instanceof Error ? error.message : 'Failed to refresh benchmarks'),
    );
  }
});

benchmarkRoutes.post(
  '/admin/benchmarks/refresh-cohort',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);

    if (!env.FEATURE_BENCHMARKS_ENABLED) {
      return problemResponse(c, badRequest('Benchmarking is disabled for this environment'));
    }

    try {
      const result = await refreshBenchmarkSnapshots(db);
      await recordAuditEvent(db, {
        tenantId: auth.tenantId,
        userId: auth.userId,
        action: 'benchmarks_refreshed',
        resourceType: 'benchmark_cohort',
        resourceId: null,
        metadata: { scope: 'all_participants', ...result },
        ...auditContextFromRequest(c),
      });
      return c.json({ result });
    } catch (error) {
      return problemResponse(
        c,
        badRequest(error instanceof Error ? error.message : 'Failed to refresh cohort benchmarks'),
      );
    }
  },
);
