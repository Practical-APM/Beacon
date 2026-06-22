export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Beacon API',
    version: '0.3.0',
    description:
      'REST API for implementation risk intelligence. Tenant-scoped routes require Authorization (Bearer dev:{externalAuthId} locally) and x-tenant-id. Rate limit: 100 requests/minute per tenant (429 + Retry-After). Dashboard aggregates cached 60s in Redis.',
  },
  servers: [{ url: 'http://localhost:3001/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
      tenantHeader: { type: 'apiKey', in: 'header', name: 'x-tenant-id' },
    },
    parameters: {
      Limit: { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100, default: 20 } },
      Cursor: { name: 'cursor', in: 'query', schema: { type: 'string' } },
      Sort: {
        name: 'sort',
        in: 'query',
        schema: { type: 'string', example: 'created_at:desc' },
      },
      IdempotencyKey: {
        name: 'Idempotency-Key',
        in: 'header',
        schema: { type: 'string', minLength: 8, maxLength: 128 },
      },
      ProjectStatus: {
        name: 'status',
        in: 'query',
        schema: { type: 'string', enum: ['active', 'on_hold', 'completed', 'cancelled'] },
      },
      RiskLevel: {
        name: 'risk_level',
        in: 'query',
        schema: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      },
      OwnerEmail: { name: 'owner', in: 'query', schema: { type: 'string', format: 'email' } },
      FormatCsv: {
        name: 'format',
        in: 'query',
        schema: { type: 'string', enum: ['csv'] },
        description: 'Return CSV instead of JSON (projects, revenue-impact)',
      },
      ProjectDetail: {
        name: 'detail',
        in: 'query',
        schema: { type: 'string', enum: ['full', 'true'] },
        description: 'Include customer, health, and open risks',
      },
    },
    schemas: {
      Problem: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'integer' },
          detail: { type: 'string' },
          requestId: { type: 'string' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          limit: { type: 'integer' },
          hasMore: { type: 'boolean' },
          nextCursor: { type: 'string', nullable: true },
        },
      },
      HealthSummary: {
        type: 'object',
        properties: {
          openRiskCount: { type: 'integer' },
          highestRiskLevel: { type: 'string', nullable: true },
          highestRiskScore: { type: 'integer', nullable: true },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          externalId: { type: 'string' },
          externalSource: { type: 'string' },
        },
      },
      PaginatedCustomers: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Customer' } },
          pagination: { $ref: '#/components/schemas/Pagination' },
        },
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          customerId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          status: { type: 'string' },
          arrAmount: { type: 'integer', nullable: true },
          arrCurrency: { type: 'string' },
          ownerEmail: { type: 'string', nullable: true },
          healthSummary: { $ref: '#/components/schemas/HealthSummary' },
        },
      },
      PaginatedProjects: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Project' } },
          pagination: { $ref: '#/components/schemas/Pagination' },
        },
      },
      ProjectDetail: {
        type: 'object',
        properties: {
          project: { $ref: '#/components/schemas/Project' },
          customer: { $ref: '#/components/schemas/Customer', nullable: true },
          health: { $ref: '#/components/schemas/HealthSummary' },
          openRisks: { type: 'array', items: { $ref: '#/components/schemas/Risk' } },
        },
      },
      Risk: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
          level: { type: 'string' },
          status: { type: 'string' },
          score: { type: 'integer' },
          reason: { type: 'string' },
          version: { type: 'integer' },
        },
      },
      PaginatedRisks: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Risk' } },
          pagination: { $ref: '#/components/schemas/Pagination' },
        },
      },
      PatchRisk: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['open', 'acknowledged', 'resolved', 'snoozed'] },
          snoozedUntil: { type: 'string', format: 'date-time', nullable: true },
          feedback: { type: 'string', maxLength: 500 },
          version: {
            type: 'integer',
            minimum: 1,
            description: 'Optimistic lock; 409 if stale',
          },
        },
      },
      DashboardSummary: {
        type: 'object',
        properties: {
          activeProjects: { type: 'integer' },
          atRiskProjects: { type: 'integer' },
          totalDelayedArr: { type: 'integer', nullable: true },
          currency: { type: 'string', nullable: true },
          multiCurrency: { type: 'boolean' },
          currencyBreakdown: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                currency: { type: 'string' },
                totalDelayedArr: { type: 'integer' },
                projectCount: { type: 'integer' },
              },
            },
          },
          averageRiskScore: { type: 'integer', nullable: true },
          averageConfidence: { type: 'integer', nullable: true },
          projectsWithUnknownArr: { type: 'integer' },
          openRiskCount: { type: 'integer' },
          lastUpdated: { type: 'string', format: 'date-time' },
          cached: { type: 'boolean' },
        },
      },
      RevenueImpact: {
        type: 'object',
        properties: {
          totalDelayedArr: { type: 'integer', nullable: true },
          currency: { type: 'string', nullable: true },
          multiCurrency: { type: 'boolean' },
          currencyBreakdown: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                currency: { type: 'string' },
                totalDelayedArr: { type: 'integer' },
                projectCount: { type: 'integer' },
              },
            },
          },
          activeProjects: { type: 'integer' },
          atRiskProjects: { type: 'integer' },
          projectsWithUnknownArr: { type: 'integer' },
          projects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                projectId: { type: 'string', format: 'uuid' },
                projectName: { type: 'string' },
                arrAmount: { type: 'integer', nullable: true },
                openRiskCount: { type: 'integer' },
                highestRiskLevel: { type: 'string', nullable: true },
              },
            },
          },
          lastUpdated: { type: 'string', format: 'date-time' },
          cached: { type: 'boolean' },
        },
      },
    },
  },
  security: [{ bearerAuth: [], tenantHeader: [] }],
  paths: {
    '/dashboard': {
      get: {
        summary: 'Portfolio dashboard summary',
        description: 'Cached 60s per tenant and role scope. Invalidated on events and risk updates.',
        responses: {
          '200': {
            description: 'Dashboard aggregates',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/DashboardSummary' } },
            },
          },
        },
      },
    },
    '/customers': {
      get: {
        summary: 'List customers',
        parameters: [
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Cursor' },
          { $ref: '#/components/parameters/Sort' },
        ],
        responses: {
          '200': {
            description: 'Paginated customers',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedCustomers' },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create customer',
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        responses: { '201': { description: 'Customer created' } },
      },
    },
    '/projects': {
      get: {
        summary: 'List projects with health summary',
        parameters: [
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Cursor' },
          { $ref: '#/components/parameters/Sort' },
          { $ref: '#/components/parameters/ProjectStatus' },
          { $ref: '#/components/parameters/RiskLevel' },
          { $ref: '#/components/parameters/OwnerEmail' },
          { $ref: '#/components/parameters/FormatCsv' },
          {
            name: 'include_health',
            in: 'query',
            schema: { type: 'boolean', default: true },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated projects or CSV export',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PaginatedProjects' } },
              'text/csv': { schema: { type: 'string' } },
            },
          },
        },
      },
      post: {
        summary: 'Create project',
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        responses: { '201': { description: 'Project created' } },
      },
    },
    '/projects/{projectId}': {
      get: {
        summary: 'Get project',
        parameters: [{ $ref: '#/components/parameters/ProjectDetail' }],
        responses: {
          '200': {
            description: 'Project detail (use detail=full for risks and customer)',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      properties: { project: { $ref: '#/components/schemas/Project' } },
                    },
                    { $ref: '#/components/schemas/ProjectDetail' },
                  ],
                },
              },
            },
          },
        },
      },
      delete: { summary: 'Soft delete project', responses: { '204': { description: 'Deleted' } } },
    },
    '/risks': {
      get: {
        summary: 'List risks',
        parameters: [
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Cursor' },
          { $ref: '#/components/parameters/RiskLevel' },
        ],
        responses: {
          '200': {
            description: 'Paginated risk feed',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PaginatedRisks' } },
            },
          },
        },
      },
    },
    '/risks/{riskId}': {
      get: {
        summary: 'Get risk',
        responses: {
          '200': {
            description: 'Risk detail',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { risk: { $ref: '#/components/schemas/Risk' } },
                },
              },
            },
          },
        },
      },
      patch: {
        summary: 'Update risk status (acknowledge, snooze, resolve)',
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PatchRisk' } },
          },
        },
        responses: {
          '200': { description: 'Updated risk' },
          '409': { description: 'Version conflict (optimistic lock)' },
        },
      },
    },
    '/revenue-impact': {
      get: {
        summary: 'Portfolio revenue impact (deduped by project)',
        parameters: [{ $ref: '#/components/parameters/FormatCsv' }],
        responses: {
          '200': {
            description: 'Revenue summary',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/RevenueImpact' } },
              'text/csv': { schema: { type: 'string' } },
            },
          },
        },
      },
    },
    '/integrations': {
      get: { summary: 'List integrations', responses: { '200': { description: 'Integration statuses' } } },
    },
    '/integration-mappings': {
      post: {
        summary: 'Create integration mapping',
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        responses: { '201': { description: 'Mapping created' } },
      },
    },
  },
} as const;
