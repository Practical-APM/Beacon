import { Hono } from 'hono';
import { corsMiddleware, errorHandler, requestContext } from './middleware/request-context.js';
import { authenticate } from './middleware/auth.js';
import { tenantRateLimit } from './middleware/rate-limit.js';
import { notificationPublicRoutes } from './routes/v1/notifications.js';
import { healthRoutes } from './routes/health.js';
import { v1Routes } from './routes/v1/index.js';
import { ApiError, problemResponse } from './lib/errors.js';

export function createApp() {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return problemResponse(c, err);
    }
    return errorHandler(err, c);
  });

  app.use('*', corsMiddleware);
  app.use('*', requestContext);
  app.use('*', authenticate);
  app.use('*', tenantRateLimit);

  app.route('/v1', notificationPublicRoutes);

  app.route('/', healthRoutes);
  app.route('/v1', v1Routes);

  app.get('/', (c) =>
    c.json({
      name: 'Beacon API',
      version: '0.1.0',
      docs: '/v1/openapi.json',
    }),
  );

  return app;
}

export type App = ReturnType<typeof createApp>;
