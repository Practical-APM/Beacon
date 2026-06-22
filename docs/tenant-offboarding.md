# Tenant Offboarding Procedure

When a pilot or customer ends their subscription, complete data purge within **30 days**.

## Steps

1. **Disable access**
   - Revoke Clerk/org membership or disable tenant users
   - Set org feature flags: LLM and Slack alerts off
   - Disable notifications org-wide via admin settings

2. **Export (optional)**
   - Customer admin runs `POST /v1/privacy/export` per user
   - Store export delivery confirmation in support ticket

3. **Process deletion requests**
   - Review `GET /v1/admin/privacy/deletion-requests`
   - Mark requests `processing` → `completed` after purge

4. **Purge tenant data**
   - Soft-delete tenant (`tenants.deleted_at`) to block API access
   - Hard delete tenant row (cascades to projects, risks, events, integrations, audit logs)
   - Invalidate Redis cache keys for tenant

5. **Verify**
   - Confirm tenant ID returns 404 on authenticated routes
   - Confirm no residual PII in logs (search by tenant slug/email)

6. **Audit trail**
   - Retain offboarding ticket and completion timestamp outside the product DB for compliance records

## Timeline
| Day | Action |
| --- | ------ |
| 0 | Offboarding request received |
| 7 | Access disabled, exports delivered |
| 30 | Hard purge completed |
