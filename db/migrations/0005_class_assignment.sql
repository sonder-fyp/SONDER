-- 0005_class_assignment: a teacher assigns a frozen Maths unit to a class (I2-H11).
--
-- Shape agreed with Ahmed (docs/api/SESSION_CONTRACT.md 5.5): id, class_id, unit_id (which pins
-- the content version), title, open/closed status and the repeat-attempt rule. Ahmed's follow-up
-- migration adds diagnostic_session.assignment_id and its guard; the attempt-rule check against
-- sessions comes with that link (I2-H12), not here.
--
-- attempt_rule: 'single' = one attempt per student (a started attempt is resumed, never
-- replaced); 'repeat' = a new attempt may start once the previous one is finished. It is fixed
-- once created, so the rule a student started under cannot change underneath them.
--
-- Errors for the caller use SQLSTATE SN001 (sonder.product_error).

CREATE TABLE sonder.class_assignment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 class_id uuid NOT NULL REFERENCES sonder.classroom ON DELETE RESTRICT,
 unit_id uuid NOT NULL REFERENCES sonder.diagnostic_unit ON DELETE RESTRICT,
 title text NOT NULL CHECK (title = btrim(title) AND length(title) BETWEEN 1 AND 120),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
 attempt_rule text NOT NULL DEFAULT 'single' CHECK (attempt_rule IN ('single', 'repeat')),
 created_by uuid NOT NULL REFERENCES sonder.app_user ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX class_assignment_class_idx ON sonder.class_assignment (class_id, created_at DESC);

-- Every insert, however it is made: the creator teaches the (active) class, and the unit belongs
-- to a frozen content version of a subject the class teaches.
CREATE OR REPLACE FUNCTION sonder.class_assignment_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
 IF NOT is_class_teacher(NEW.created_by, NEW.class_id) THEN
  RAISE EXCEPTION 'An assignment is created by an active teacher of its class';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM classroom WHERE id = NEW.class_id AND status = 'active') THEN
  RAISE EXCEPTION 'An archived class cannot receive assignments';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM diagnostic_unit u
  JOIN content_version cv ON cv.id = u.content_version_id AND cv.status = 'frozen'
  JOIN class_subject cs ON cs.class_id = NEW.class_id AND cs.subject_id = cv.subject_id
  WHERE u.id = NEW.unit_id)
 THEN RAISE EXCEPTION 'An assignment needs a unit of a frozen content version the class teaches'; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER a_scope BEFORE INSERT ON sonder.class_assignment
 FOR EACH ROW EXECUTE FUNCTION sonder.class_assignment_guard();
CREATE TRIGGER fixed_keys BEFORE UPDATE ON sonder.class_assignment
 FOR EACH ROW EXECUTE FUNCTION sonder.fixed_keys('id', 'class_id', 'unit_id', 'attempt_rule', 'created_by', 'created_at');
CREATE TRIGGER state BEFORE INSERT OR UPDATE ON sonder.class_assignment
 FOR EACH ROW EXECUTE FUNCTION sonder.state_guard('status', 'open', 'open>closed,closed>open');
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON sonder.class_assignment
 FOR EACH ROW EXECUTE FUNCTION sonder.record_audit();

-- Assign a unit by its code within the content version the diagnostic service is running. The
-- caller supplies that version from the service, never from the browser.
CREATE OR REPLACE FUNCTION sonder.create_assignment(p_teacher uuid, p_class uuid, p_version_code text,
                                                    p_unit_code text, p_title text, p_attempt_rule text DEFAULT 'single')
RETURNS uuid
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, sonder AS $$
DECLARE
 v_title text := btrim(coalesce(p_title, ''));
 v_unit uuid;
 v_id uuid;
BEGIN
 IF NOT is_class_teacher(p_teacher, p_class) THEN PERFORM product_error('class_not_found'); END IF;
 IF NOT EXISTS (SELECT 1 FROM classroom WHERE id = p_class AND status = 'active') THEN
  PERFORM product_error('class_archived');
 END IF;
 IF length(v_title) NOT BETWEEN 1 AND 120 THEN PERFORM product_error('assignment_title_invalid'); END IF;
 IF p_attempt_rule IS NULL OR p_attempt_rule NOT IN ('single', 'repeat') THEN
  PERFORM product_error('attempt_rule_invalid');
 END IF;
 SELECT u.id INTO v_unit
 FROM diagnostic_unit u
 JOIN content_version cv ON cv.id = u.content_version_id AND cv.status = 'frozen'
 JOIN class_subject cs ON cs.class_id = p_class AND cs.subject_id = cv.subject_id
 WHERE cv.version_code = p_version_code AND u.unit_code = p_unit_code;
 IF v_unit IS NULL THEN PERFORM product_error('unit_not_found'); END IF;

 PERFORM set_config('sonder.actor_id', p_teacher::text, true);
 INSERT INTO class_assignment (class_id, unit_id, title, attempt_rule, created_by)
 VALUES (p_class, v_unit, v_title, p_attempt_rule, p_teacher) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

-- Close an assignment (students no longer see it or start it) or reopen it.
CREATE OR REPLACE FUNCTION sonder.set_assignment_status(p_teacher uuid, p_assignment uuid, p_status text) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, sonder AS $$
DECLARE v_class uuid;
BEGIN
 IF p_status IS NULL OR p_status NOT IN ('open', 'closed') THEN PERFORM product_error('assignment_status_invalid'); END IF;
 SELECT class_id INTO v_class FROM class_assignment WHERE id = p_assignment;
 IF v_class IS NULL OR NOT is_class_teacher(p_teacher, v_class) THEN PERFORM product_error('assignment_not_found'); END IF;
 PERFORM set_config('sonder.actor_id', p_teacher::text, true);
 UPDATE class_assignment SET status = p_status WHERE id = p_assignment AND status <> p_status;
END $$;

-- Every assignment of a class, for its teacher only (empty otherwise).
CREATE OR REPLACE FUNCTION sonder.class_assignments(p_teacher uuid, p_class uuid)
RETURNS TABLE (assignment_id uuid, class_id uuid, title text, unit_code text, unit_name text, version_code text,
               status text, attempt_rule text, created_at timestamptz)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT a.id, a.class_id, a.title, u.unit_code, u.name, cv.version_code, a.status, a.attempt_rule, a.created_at
 FROM class_assignment a
 JOIN diagnostic_unit u ON u.id = a.unit_id
 JOIN content_version cv ON cv.id = u.content_version_id
 WHERE a.class_id = p_class AND sonder.is_class_teacher(p_teacher, p_class)
$$;

-- The open assignments of a student's active classes. Only what a student may see: no item,
-- option, answer or result data.
CREATE OR REPLACE FUNCTION sonder.student_assignments(p_student uuid)
RETURNS TABLE (assignment_id uuid, class_id uuid, class_name text, title text, unit_code text, unit_name text,
               attempt_rule text, created_at timestamptz)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT a.id, c.id, c.name, a.title, u.unit_code, u.name, a.attempt_rule, a.created_at
 FROM enrolment e
 JOIN app_user s ON s.id = e.student_id AND s.role = 'student' AND s.status = 'active'
 JOIN classroom c ON c.id = e.class_id AND c.status = 'active'
 JOIN class_assignment a ON a.class_id = c.id AND a.status = 'open'
 JOIN diagnostic_unit u ON u.id = a.unit_id
 WHERE e.student_id = p_student AND e.status = 'active'
$$;

REVOKE ALL ON TABLE sonder.class_assignment FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.class_assignment_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.create_assignment(uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.set_assignment_status(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.class_assignments(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.student_assignments(uuid) FROM PUBLIC;
