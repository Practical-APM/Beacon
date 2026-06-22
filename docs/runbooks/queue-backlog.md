# Queue Backlog Runbook

## Symptoms
- Risk evaluations delayed
- Event processor metrics show growing backlog
- Redis queue depth increasing (if instrumented)

## Immediate actions
1. Verify workers: `EVENT_WORKERS_ENABLED=true` and API process healthy
2. Check API logs for repeated processor errors
3. Temporarily disable non-critical schedulers if CPU bound:
   - `RISK_SCHEDULER_ENABLED=false`
   - `NOTIFICATION_SCHEDULER_ENABLED=false`
4. Scale API worker replicas horizontally

## Recovery validation
- Confirm new events insert and dedupe correctly
- Dashboard cache invalidates after risk evaluation
- p95 API latency returns under 2s (see `scripts/load-test.mjs`)
