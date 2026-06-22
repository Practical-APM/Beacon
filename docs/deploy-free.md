# Free-tier deployment guide

Deploy **Beacon** for staging or demos using free (or near-free) managed services.

| Component | Platform | Why |
| --------- | -------- | --- |
| Web (`apps/web`) | [Vercel](https://vercel.com) | Native Next.js 15 hosting |
| API (`apps/api`) | [Railway](https://railway.app) | Long-running Node + BullMQ workers |
| PostgreSQL | [Neon](https://neon.tech) | Serverless Postgres, Drizzle-compatible |
| Redis | [Upstash](https://upstash.com) | BullMQ queues + dashboard cache |
| Auth | [Clerk](https://clerk.com) | Required in production (dev tokens are disabled) |
| Email (optional) | [Resend](https://resend.com) | Notification emails |

Repo config:

- `railway.toml` — API build/start + health check
- `apps/web/vercel.json` — monorepo install/build from repo root
- `nixpacks.toml` — Node 22 on Railway

---

## Architecture

```text
Browser
   │
   ▼
Vercel (apps/web) ──NEXT_PUBLIC_API_URL──► Railway (apps/api)
                                                  │
                                    ┌─────────────┴─────────────┐
                                    ▼                           ▼
                              Neon Postgres              Upstash Redis
                                    ▲
Clerk webhook ──────────────────────┘
```

---

## 1. Prerequisites

- GitHub repo pushed (Railway and Vercel connect via GitHub)
- [Clerk](https://dashboard.clerk.com) application created
- [Neon](https://console.neon.tech) project created
- [Upstash](https://console.upstash.com) Redis database created

Generate secrets locally:

```bash
# 32+ chars for OAuth token encryption at rest
openssl rand -base64 32
```

---

## 2. Database (Neon)

1. Copy the **pooled** connection string (`postgres://...`).
2. Run migrations from your machine (one-time per environment):

```bash
export DATABASE_URL="postgres://USER:PASS@HOST/DB?sslmode=require"
npm ci
npm run db:migrate --workspace=@beacon/db
```

3. Optional demo data:

```bash
DATABASE_URL="$DATABASE_URL" npm run db:seed --workspace=@beacon/db
```

Re-run `db:migrate` after pulling schema changes.

---

## 3. Redis (Upstash)

1. Create a regional database close to your API region.
2. Copy the **TLS** URL (`rediss://...`) into `REDIS_URL`.

---

## 4. API (Railway)

1. **New Project → Deploy from GitHub** → select this repository.
2. Use the **repository root** (do not set a subdirectory).
3. Railway reads `railway.toml` automatically.
4. Add environment variables:

### Required

| Variable | Value |
| -------- | ----- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon connection string |
| `REDIS_URL` | Upstash `rediss://...` URL |
| `CORS_ORIGIN` | `https://YOUR-APP.vercel.app` (update after Vercel deploy) |
| `WEB_APP_URL` | Same as `CORS_ORIGIN` |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |
| `INTEGRATION_ENCRYPTION_KEY` | Output of `openssl rand -base64 32` |
| `EVENT_WORKERS_ENABLED` | `true` |
| `RISK_SCHEDULER_ENABLED` | `true` |
| `NOTIFICATION_SCHEDULER_ENABLED` | `true` |

### Recommended

| Variable | Value |
| -------- | ----- |
| `LOG_LEVEL` | `info` |
| `AUTH_DEV_MODE` | `false` |
| `FEATURE_LLM_ENABLED` | `false` (until you add LLM keys) |

Railway injects `PORT`; the API reads it via `packages/shared/src/env.ts`.

### Optional (enable when needed)

| Variable | Purpose |
| -------- | ------- |
| `RESEND_API_KEY` + `EMAIL_FROM` | Transactional email |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | LLM insights |
| `SALESFORCE_*`, `JIRA_*`, `SLACK_*`, etc. | Integrations — set `*_REDIRECT_URI` to `https://YOUR-API.up.railway.app/v1/integrations/.../callback` |

5. Deploy and note the public URL (e.g. `https://beacon-api-production.up.railway.app`).
6. Verify:

```bash
curl -sS "https://YOUR-API.up.railway.app/health"
curl -sS "https://YOUR-API.up.railway.app/ready"
```

`/ready` must return 200 once Neon and Upstash are reachable.

---

## 5. Web (Vercel)

1. **Add New Project** → import the same GitHub repo.
2. **Root Directory:** `apps/web` (required — do not deploy from repo root).
3. **Node.js version:** 22 (matches `.nvmrc`; Vercel reads it from the repo when Root Directory is set).
4. Vercel picks up `apps/web/vercel.json` (`installCommand` / `buildCommand` run from monorepo root via `cd ../..`).
5. Environment variables (see also `apps/web/.env.example`):

| Variable | Value |
| -------- | ----- |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-APP.vercel.app` |
| `NEXT_PUBLIC_API_URL` | Railway API URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NODE_ENV` | `production` |

6. Deploy.

7. Go back to Railway and set `CORS_ORIGIN` / `WEB_APP_URL` to the final Vercel URL if you used a placeholder earlier.

**Pre-deploy check (local):** `make verify-vercel` simulates the Vercel install + build.

---

## 6. Clerk

In the Clerk dashboard:

1. **Domains** — add your Vercel URL.
2. **Webhooks** — endpoint:
   `https://YOUR-API.up.railway.app/v1/webhooks/clerk`
   - Subscribe to user/org events your app syncs.
   - Copy the signing secret → `CLERK_WEBHOOK_SECRET` on Railway.
3. **JWT** — ensure the API can verify session tokens (default Clerk setup works with `@clerk/backend`).

Sign in at `https://YOUR-APP.vercel.app/sign-in`. Dev auth (`Bearer dev:...`) is **blocked** in production.

---

## 7. Smoke test

```bash
# API
curl -sS "https://YOUR-API/health" | jq .
curl -sS "https://YOUR-API/ready" | jq .

# Web (should return HTML)
curl -sS -o /dev/null -w "%{http_code}\n" "https://YOUR-APP.vercel.app"
```

In the browser: sign in → open `/dashboard` → confirm portfolio loads.

With seeded data, use Clerk users mapped via webhook sync (not `dev:admin-a`).

---

## 8. Integration OAuth callbacks

When enabling Salesforce, Jira, Slack, Google Calendar, etc., register redirect URIs on each provider:

```text
https://YOUR-API.up.railway.app/v1/integrations/salesforce/callback
https://YOUR-API.up.railway.app/v1/integrations/jira/callback
https://YOUR-API.up.railway.app/v1/integrations/slack/callback
https://YOUR-API.up.railway.app/v1/integrations/google-calendar/callback
```

Match the same values in Railway env (`*_REDIRECT_URI`).

Inbound webhooks (Jira, Slack) must point at the API host, not Vercel.

---

## Free-tier limits

| Service | Typical constraint |
| ------- | ------------------ |
| Vercel Hobby | Build minutes, bandwidth, serverless duration |
| Railway | ~$5/month trial credits; monitor usage |
| Neon | Storage, compute hours, connection limits |
| Upstash | Daily command quota |
| Clerk | MAU cap on free plan |
| Resend | Daily send limit |

Fine for staging and demos; upgrade before a real pilot.

---

## Alternatives

### Fly.io (API instead of Railway)

```bash
fly launch --no-deploy
# Set secrets: fly secrets set DATABASE_URL=... REDIS_URL=... ...
fly deploy
```

Use the same env vars as Railway. API must stay running for workers/schedulers.

### All-in-one VM (Oracle Always Free, etc.)

```bash
docker compose up -d          # Postgres + Redis on VM
# Run API + optional web with pm2/systemd
```

More ops overhead; good if you want zero per-service billing.

### Render

Free web services sleep when idle; free Postgres expires after 90 days — OK for short demos only.

---

## Troubleshooting

| Symptom | Check |
| ------- | ----- |
| `/ready` 503 | `DATABASE_URL` / `REDIS_URL`, Neon IP allowlist, Upstash TLS URL |
| CORS errors in browser | `CORS_ORIGIN` exactly matches Vercel URL (scheme + host, no trailing slash) |
| 401 on all API calls | Clerk keys on Vercel + Railway; user synced via webhook |
| Workers idle | `EVENT_WORKERS_ENABLED=true` on Railway |
| No digests / risk refresh | `RISK_SCHEDULER_ENABLED` / `NOTIFICATION_SCHEDULER_ENABLED` = `true` |
| Build fails on Vercel | Ensure root install runs (`vercel.json` `installCommand`); Node 22 in project settings |
| Build fails on Railway | Check `nixpacks.toml` / Node 22; run `npx turbo build --filter=@beacon/api` locally |

---

## CI migration (optional)

Add a GitHub Action that runs on deploy:

```yaml
- run: npm ci && npm run db:migrate --workspace=@beacon/db
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Run migrations before or immediately after API deploy when schema changes ship.

---

*See also: [README.md](../README.md), [.env.example](../.env.example), [security-checklist.md](./security-checklist.md).*
