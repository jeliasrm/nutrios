-- Switch set_tenant/clear_tenant to transaction-local scope.
-- Safer: context auto-resets at COMMIT, so a pooled connection cannot leak tenant
-- context to the next request even if the caller forgets to clear it.
-- Usage pattern: wrap queries in prisma.$transaction(...) with set_tenant as first stmt.

CREATE OR REPLACE FUNCTION set_tenant(tid uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_tenant', tid::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION clear_tenant()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_tenant', '', true);
END;
$$;
