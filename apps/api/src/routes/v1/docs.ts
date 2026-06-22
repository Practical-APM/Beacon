import { Hono } from 'hono';
import { openApiSpec } from '../../openapi/spec.js';

export const docsRoutes = new Hono();

docsRoutes.get('/openapi.json', (c) => c.json(openApiSpec));
