-- Non-superuser app role that is subject to RLS.
-- Superusers bypass RLS regardless of FORCE; the runtime must connect as this role.
-- Migrations and seeds should use the owner role (nutrios) which is a superuser.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nutrios_app') THEN
    CREATE ROLE nutrios_app LOGIN PASSWORD 'nutrios_app_dev' NOBYPASSRLS;
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO nutrios_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nutrios_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nutrios_app;
GRANT EXECUTE ON FUNCTION set_tenant(uuid) TO nutrios_app;
GRANT EXECUTE ON FUNCTION clear_tenant() TO nutrios_app;
GRANT EXECUTE ON FUNCTION current_tenant() TO nutrios_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nutrios_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nutrios_app;
