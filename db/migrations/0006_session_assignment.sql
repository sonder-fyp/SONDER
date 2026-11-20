-- 0006_session_assignment: tie a diagnostic session to the class assignment it was started from (I2-H12).
--
-- This is the link described in docs/api/SESSION_CONTRACT.md 5.5 ("PR 10"), written by Ashher with
-- Ahmed's agreement. The column is nullable: sessions started without an assignment (all sessions
-- before this migration, and starts that omit assignment_id) keep NULL.
--
-- The trigger here guards only structure, for every insert however it is made: the assignment's
-- class is the enrolment's class and its unit is the session's unit. Whether a student may start an
-- assignment now (open, attempt rule, release) is decided by sonder.check_assignment_start in 0007.

ALTER TABLE sonder.diagnostic_session
 ADD COLUMN assignment_id uuid REFERENCES sonder.class_assignment ON DELETE RESTRICT;

CREATE INDEX diagnostic_session_assignment_idx ON sonder.diagnostic_session (assignment_id, enrolment_id)
 WHERE assignment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION sonder.session_assignment_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
 IF NEW.assignment_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM class_assignment a JOIN enrolment e ON e.id = NEW.enrolment_id
  WHERE a.id = NEW.assignment_id AND a.class_id = e.class_id AND a.unit_id = NEW.unit_id)
 THEN RAISE EXCEPTION 'A session''s assignment must be for its enrolment''s class and its unit'; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER assignment_scope BEFORE INSERT ON sonder.diagnostic_session
 FOR EACH ROW EXECUTE FUNCTION sonder.session_assignment_guard();
-- The Iteration 1 fixed_keys trigger names its columns explicitly, so the new one is fixed here.
CREATE TRIGGER fixed_assignment BEFORE UPDATE ON sonder.diagnostic_session
 FOR EACH ROW EXECUTE FUNCTION sonder.fixed_keys('assignment_id');

REVOKE ALL ON FUNCTION sonder.session_assignment_guard() FROM PUBLIC;
