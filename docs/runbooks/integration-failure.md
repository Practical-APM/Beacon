# Integration Failure Runbook

## Symptoms
- Dashboard shows stale sync badges
- Integration status `degraded` or `disconnected`
- Event ingestion drops with "disconnected integration" logs

## Immediate actions
1. Confirm integration status: `GET /v1/integrations`
2. Check latest sync job errors in admin ingestion endpoints
3. Retry OAuth reconnect from `/integrations` (admin role)
4. Run manual sync: `POST /v1/integrations/{source}/sync`

## Escalation
- Salesforce token refresh failures: verify client secret rotation and redirect URI
- Jira/Slack OAuth: verify app credentials and callback URLs match environment
- If credentials were rotated, disconnect and reconnect to re-encrypt tokens

## Prevention
- Monitor sync job failure rate per tenant
- Audit log entries for `integration_disconnected` and `integration_mapping_updated`
