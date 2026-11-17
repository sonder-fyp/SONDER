-- Allow app_user.role to change, but only together with an audit row.
--
-- The Iteration 1 schema froze app_user.role with fixed_keys('id','role','created_at'),
-- which made the admin approval route and scripts/provision-role.mjs fail with
-- 'Immutable key app_user.role'. Roles must be changeable (student -> teacher), so the
-- column leaves the frozen list. To keep the guarantee that a role never changes silently,
-- a deferred constraint trigger requires an auth_role_audit row, written in the same
-- transaction, for every role change.
BEGIN;
SET LOCAL search_path = sonder, public;

CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION fixed_keys('id', 'created_at');

CREATE OR REPLACE FUNCTION app_user_role_audit_check() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth_role_audit
    WHERE app_user_id = NEW.id
      AND previous_role = OLD.role
      AND new_role = NEW.role
      AND changed_at = transaction_timestamp()
  ) THEN
    RAISE EXCEPTION 'app_user.role may only change together with an auth_role_audit row';
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER role_audit_required AFTER UPDATE OF role ON app_user
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION app_user_role_audit_check();

COMMIT;
