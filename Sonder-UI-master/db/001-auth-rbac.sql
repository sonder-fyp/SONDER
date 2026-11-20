BEGIN;
SET LOCAL search_path = sonder, public;

DO $$
BEGIN
  IF to_regclass('sonder.app_user') IS NULL THEN
    RAISE EXCEPTION 'Authentication setup requires the Sonder application schema';
  END IF;
END $$;

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS auth_user_id text,
  ADD COLUMN IF NOT EXISTS auth_onboarding_complete boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'sonder.app_user'::regclass
      AND conname = 'app_user_auth_user_id_key'
  ) THEN
    ALTER TABLE app_user
      ADD CONSTRAINT app_user_auth_user_id_key UNIQUE (auth_user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS auth_role_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  requested_role text NOT NULL CHECK (requested_role IN ('teacher', 'parent')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'withdrawn')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES app_user(id) ON DELETE RESTRICT,
  CHECK (
    (status IN ('approved', 'denied') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
    OR (status IN ('pending', 'withdrawn') AND reviewed_at IS NULL AND reviewed_by IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_role_request_one_pending_per_user
  ON auth_role_request (app_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS auth_role_request_pending_order
  ON auth_role_request (requested_at, id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS auth_role_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  app_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES app_user(id) ON DELETE RESTRICT,
  previous_role text NOT NULL CHECK (previous_role IN ('student', 'teacher', 'parent', 'admin')),
  new_role text NOT NULL CHECK (new_role IN ('student', 'teacher', 'parent', 'admin')),
  change_source text NOT NULL CHECK (change_source IN ('admin_approval', 'operator_provisioning')),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_role_audit_user_time
  ON auth_role_audit (app_user_id, changed_at DESC);

COMMIT;
