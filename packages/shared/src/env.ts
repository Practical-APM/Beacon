import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production', 'staging']);

export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url().startsWith('postgres'),
  REDIS_URL: z.string().url().startsWith('redis'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  AUTH_DEV_MODE: z.enum(['true', 'false']).optional(),
  OTEL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  OTEL_SERVICE_NAME: z.string().default('beacon-api'),
  SALESFORCE_CLIENT_ID: z.string().optional(),
  SALESFORCE_CLIENT_SECRET: z.string().optional(),
  SALESFORCE_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3001/v1/integrations/salesforce/callback'),
  INTEGRATION_ENCRYPTION_KEY: z.string().min(32).optional(),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  JIRA_CLIENT_ID: z.string().optional(),
  JIRA_CLIENT_SECRET: z.string().optional(),
  JIRA_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3001/v1/integrations/jira/callback'),
  JIRA_WEBHOOK_SECRET: z.string().optional(),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3001/v1/integrations/slack/callback'),
  SLACK_SIGNING_SECRET: z.string().optional(),
  GOOGLE_CALENDAR_CLIENT_ID: z.string().optional(),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALENDAR_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3001/v1/integrations/google-calendar/callback'),
  HUBSPOT_CLIENT_ID: z.string().optional(),
  HUBSPOT_CLIENT_SECRET: z.string().optional(),
  HUBSPOT_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3001/v1/integrations/hubspot/callback'),
  DYNAMICS_CLIENT_ID: z.string().optional(),
  DYNAMICS_CLIENT_SECRET: z.string().optional(),
  DYNAMICS_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3001/v1/integrations/microsoft-dynamics/callback'),
  DYNAMICS_TENANT_ID: z.string().default('organizations'),
  PIPEDRIVE_CLIENT_ID: z.string().optional(),
  PIPEDRIVE_CLIENT_SECRET: z.string().optional(),
  PIPEDRIVE_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3001/v1/integrations/pipedrive/callback'),
  LINEAR_CLIENT_ID: z.string().optional(),
  LINEAR_CLIENT_SECRET: z.string().optional(),
  LINEAR_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3001/v1/integrations/linear/callback'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-haiku-latest'),
  EVENT_WORKERS_ENABLED: z.enum(['true', 'false']).optional(),
  RISK_SCHEDULER_ENABLED: z.enum(['true', 'false']).optional(),
  NOTIFICATION_SCHEDULER_ENABLED: z.enum(['true', 'false']).optional(),
  FEATURE_LLM_ENABLED: z.enum(['true', 'false']).optional(),
  FEATURE_SLACK_ALERTS_ENABLED: z.enum(['true', 'false']).optional(),
  FEATURE_OUTBOUND_WEBHOOKS_ENABLED: z.enum(['true', 'false']).optional(),
  FEATURE_BENCHMARKS_ENABLED: z.enum(['true', 'false']).optional(),
  FEATURE_DELAY_PREDICTIONS_ENABLED: z.enum(['true', 'false']).optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
}).transform((data) => {
  const devAuthAllowed =
    data.NODE_ENV === 'development' || data.NODE_ENV === 'test';
  const wantsDevAuth =
    data.AUTH_DEV_MODE === 'true' ||
    (data.AUTH_DEV_MODE !== 'false' && !data.CLERK_SECRET_KEY && devAuthAllowed);

  return {
  ...data,
  AUTH_DEV_MODE: devAuthAllowed && wantsDevAuth,
  SALESFORCE_ENABLED: Boolean(data.SALESFORCE_CLIENT_ID && data.SALESFORCE_CLIENT_SECRET),
  JIRA_ENABLED: Boolean(data.JIRA_CLIENT_ID && data.JIRA_CLIENT_SECRET),
  SLACK_ENABLED: Boolean(data.SLACK_CLIENT_ID && data.SLACK_CLIENT_SECRET),
  GOOGLE_CALENDAR_ENABLED: Boolean(data.GOOGLE_CALENDAR_CLIENT_ID && data.GOOGLE_CALENDAR_CLIENT_SECRET),
  HUBSPOT_ENABLED: Boolean(data.HUBSPOT_CLIENT_ID && data.HUBSPOT_CLIENT_SECRET),
  DYNAMICS_ENABLED: Boolean(data.DYNAMICS_CLIENT_ID && data.DYNAMICS_CLIENT_SECRET),
  PIPEDRIVE_ENABLED: Boolean(data.PIPEDRIVE_CLIENT_ID && data.PIPEDRIVE_CLIENT_SECRET),
  LINEAR_ENABLED: Boolean(data.LINEAR_CLIENT_ID && data.LINEAR_CLIENT_SECRET),
  OPENAI_ENABLED: Boolean(data.OPENAI_API_KEY),
  ANTHROPIC_ENABLED: Boolean(data.ANTHROPIC_API_KEY),
  EVENT_WORKERS_ENABLED:
    data.EVENT_WORKERS_ENABLED === 'true' ||
    (data.EVENT_WORKERS_ENABLED !== 'false' && data.NODE_ENV === 'development'),
  RISK_SCHEDULER_ENABLED:
    data.RISK_SCHEDULER_ENABLED === 'true' ||
    (data.RISK_SCHEDULER_ENABLED !== 'false' && data.NODE_ENV === 'development'),
  NOTIFICATION_SCHEDULER_ENABLED:
    data.NOTIFICATION_SCHEDULER_ENABLED === 'true' ||
    (data.NOTIFICATION_SCHEDULER_ENABLED !== 'false' && data.NODE_ENV === 'development'),
  FEATURE_LLM_ENABLED:
    data.FEATURE_LLM_ENABLED !== 'false',
  FEATURE_SLACK_ALERTS_ENABLED:
    data.FEATURE_SLACK_ALERTS_ENABLED !== 'false',
  FEATURE_OUTBOUND_WEBHOOKS_ENABLED:
    data.FEATURE_OUTBOUND_WEBHOOKS_ENABLED !== 'false',
  FEATURE_BENCHMARKS_ENABLED:
    data.FEATURE_BENCHMARKS_ENABLED !== 'false',
  FEATURE_DELAY_PREDICTIONS_ENABLED:
    data.FEATURE_DELAY_PREDICTIONS_ENABLED !== 'false',
  EMAIL_ENABLED: Boolean(data.RESEND_API_KEY && data.EMAIL_FROM),
};
});

export const webEnvSchema = baseEnvSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
}).transform((data) => ({
  ...data,
  AUTH_DEV_MODE: !data.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !data.CLERK_SECRET_KEY,
}));

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    const message = Object.entries(formatted)
      .map(([key, errors]) => `${key}: ${(errors ?? []).join(', ')}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  return result.data;
}
