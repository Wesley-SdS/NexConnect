-- ============================================================================
-- Row Level Security for Multi-Tenant Isolation
-- ============================================================================
-- This migration enables RLS on all tenant-scoped tables to enforce data
-- isolation at the database level. The application sets the tenant context
-- via: SET LOCAL app.tenant_id = '<uuid>';
--
-- This acts as a defense-in-depth layer — even if the application has a bug
-- in its WHERE clauses, RLS prevents cross-tenant data access.
-- ============================================================================

-- ─── Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist ENABLE ROW LEVEL SECURITY;

-- ─── Direct tenant_id Policies ──────────────────────────────────────────────
-- Tables that have a direct tenant_id column.

CREATE POLICY tenant_isolation_instances ON instances
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_webhooks ON webhooks
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_messages ON messages
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_events ON events
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_media_assets ON media_assets
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_scheduled_messages ON scheduled_messages
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_broadcasts ON broadcasts
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── Indirect tenant_id Policies ────────────────────────────────────────────
-- Tables that reference tenant-scoped tables but do not have a direct
-- tenant_id column. Use subqueries to resolve tenant ownership.

CREATE POLICY tenant_isolation_webhook_deliveries ON webhook_deliveries
  FOR ALL USING (
    webhook_id IN (
      SELECT id FROM webhooks
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

CREATE POLICY tenant_isolation_cron_jobs ON cron_jobs
  FOR ALL USING (
    instance_id IN (
      SELECT id FROM instances
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

CREATE POLICY tenant_isolation_blacklist ON blacklist
  FOR ALL USING (
    instance_id IN (
      SELECT id FROM instances
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

CREATE POLICY tenant_isolation_whitelist ON whitelist
  FOR ALL USING (
    instance_id IN (
      SELECT id FROM instances
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

-- ─── Bypass for Service Role ────────────────────────────────────────────────
-- The application's main database user (used for migrations, background jobs,
-- and cross-tenant operations like instance scheduling) should bypass RLS.
-- RLS only applies to the connection-pool user used by tenant-scoped requests.
--
-- To configure:
--   ALTER ROLE nexconnect_service BYPASSRLS;
--   ALTER ROLE nexconnect_tenant NOBYPASSRLS;
--
-- The application uses SET LOCAL app.tenant_id before each tenant-scoped query
-- on the nexconnect_tenant role connection pool.

-- ─── Performance Notes ──────────────────────────────────────────────────────
-- The subquery-based policies on webhook_deliveries, cron_jobs, blacklist, and
-- whitelist add overhead. For high-volume tables, consider adding a redundant
-- tenant_id column with a trigger to populate it, converting the policy to a
-- direct comparison.
