import { Hono } from 'hono';
import { z } from 'zod';
import { canonicalEventSchema, validateCanonicalEvent } from '@beacon/shared/events';
import { badRequest, notFound, problemResponse } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/rbac.js';
import { ingestEventSynchronously, publishEvent } from '../../services/events/ingest.js';
import { listDlqJobs, getWorkerMetrics, replayDlqJob } from '../../workers/event-worker.js';

const ingestSchema = canonicalEventSchema
  .omit({ tenantId: true })
  .extend({
    tenantId: z.string().uuid().optional(),
    queue: z.enum(['realtime', 'bulk']).optional(),
    sync: z.boolean().optional(),
  });

export const ingestionAdminRoutes = new Hono();

ingestionAdminRoutes.get('/admin/ingestion/metrics', requireAuth, requireAdmin(), async (c) => {
  const metrics = await getWorkerMetrics();
  return c.json({ metrics });
});

ingestionAdminRoutes.get('/admin/ingestion/dlq', requireAuth, requireAdmin(), async (c) => {
  const jobs = await listDlqJobs();
  return c.json({ data: jobs });
});

ingestionAdminRoutes.post(
  '/admin/ingestion/dlq/:jobId/replay',
  requireAuth,
  requireAdmin(),
  async (c) => {
    const jobId = c.req.param('jobId');
    if (!jobId) return problemResponse(c, badRequest('Missing jobId'));

    const replayed = await replayDlqJob(jobId);
    if (!replayed) return problemResponse(c, notFound('DLQ job not found'));

    return c.json({ replayed: true, jobId });
  },
);

ingestionAdminRoutes.post('/admin/events/ingest', requireAuth, requireAdmin(), async (c) => {
  const auth = getAuth(c);
  const body = ingestSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const event = validateCanonicalEvent({
    ...body.data,
    tenantId: body.data.tenantId ?? auth.tenantId,
  });

  if (body.data.sync) {
    const result = await ingestEventSynchronously(event);
    return c.json(result);
  }

  const result = await publishEvent(event, body.data.queue ?? 'realtime');
  return c.json(result, 202);
});
