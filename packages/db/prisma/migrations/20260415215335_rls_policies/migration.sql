-- Multi-tenant Row-Level Security
-- Uses app.current_tenant GUC to filter rows per request.

-- === Helpers =============================================================
CREATE OR REPLACE FUNCTION set_tenant(tid uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_tenant', tid::text, false);
END;
$$;

CREATE OR REPLACE FUNCTION clear_tenant()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_tenant', '', false);
END;
$$;

CREATE OR REPLACE FUNCTION current_tenant()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.current_tenant', true);
$$;

-- === tenants =============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self_isolation ON tenants
  USING (id::text = current_tenant())
  WITH CHECK (id::text = current_tenant());

-- === strict tenant_id tables ============================================
DO $$
DECLARE
  t text;
  strict_tables text[] := ARRAY[
    'users',
    'subscriptions',
    'patients',
    'consultations',
    'diet_plans',
    'appointments',
    'payments',
    'invoices',
    'memberships',
    'notifications',
    'documents',
    'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY strict_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id::text = current_tenant()) WITH CHECK (tenant_id::text = current_tenant())',
      t
    );
  END LOOP;
END$$;

-- === permissive tables (tenant_id nullable = global rows allowed) ========
DO $$
DECLARE
  t text;
  permissive_tables text[] := ARRAY[
    'diet_plan_templates',
    'food_catalog'
  ];
BEGIN
  FOREACH t IN ARRAY permissive_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id IS NULL OR tenant_id::text = current_tenant()) WITH CHECK (tenant_id IS NULL OR tenant_id::text = current_tenant())',
      t
    );
  END LOOP;
END$$;
