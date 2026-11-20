-- 0004_class_membership: join by code, roster, removing a student, new codes and archiving (I2-H10).
--
-- Builds on 0003_classes and the Iteration 1 enrolment table, whose triggers already require an
-- active student, refuse joining an archived class, allow active <-> left and audit every write.
-- Errors for the caller use SQLSTATE SN001 (sonder.product_error).
--
-- Code policy (minimum): a code is shared by the class teacher. An unknown code and the code of
-- an archived class give the same join_code_invalid, so a student cannot tell them apart. A new
-- code replaces the old one at once. Joining is idempotent; a student who left or was removed can
-- rejoin with the current code.

-- Codes are entered by people: ignore case, spaces and hyphens.
CREATE OR REPLACE FUNCTION sonder.normalise_join_code(p_code text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, sonder AS $$
 SELECT upper(regexp_replace(coalesce(p_code, ''), '[[:space:]-]', '', 'g'))
$$;

CREATE OR REPLACE FUNCTION sonder.is_class_teacher(p_teacher uuid, p_class uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT EXISTS (
  SELECT 1 FROM class_teacher ct JOIN app_user u ON u.id = ct.teacher_id
  WHERE ct.teacher_id = p_teacher AND ct.class_id = p_class AND ct.status = 'active'
    AND u.role = 'teacher' AND u.status = 'active')
$$;

-- Join (or rejoin) the active class with this code. Returns joined = false when the student was
-- already an active member, so a repeated submit changes nothing.
CREATE OR REPLACE FUNCTION sonder.join_class(p_student uuid, p_code text)
RETURNS TABLE (class_id uuid, enrolment_id uuid, joined boolean)
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, sonder AS $$
#variable_conflict use_column
DECLARE
 v_class uuid;
 v_enrolment enrolment;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM app_user WHERE id = p_student AND role = 'student' AND status = 'active') THEN
  PERFORM product_error('student_required');
 END IF;
 SELECT c.id INTO v_class FROM classroom c
 WHERE c.join_code = normalise_join_code(p_code) AND c.status = 'active';
 IF v_class IS NULL THEN PERFORM product_error('join_code_invalid'); END IF;

 PERFORM set_config('sonder.actor_id', p_student::text, true);
 SELECT * INTO v_enrolment FROM enrolment e WHERE e.class_id = v_class AND e.student_id = p_student FOR UPDATE;
 IF v_enrolment.id IS NULL THEN
  BEGIN
   INSERT INTO enrolment (class_id, student_id) VALUES (v_class, p_student) RETURNING * INTO v_enrolment;
   RETURN QUERY SELECT v_class, v_enrolment.id, true;
   RETURN;
  EXCEPTION WHEN unique_violation THEN
   -- A simultaneous join by the same student won; fall through to its row.
   SELECT * INTO v_enrolment FROM enrolment e WHERE e.class_id = v_class AND e.student_id = p_student FOR UPDATE;
  END;
 END IF;
 IF v_enrolment.status = 'left' THEN
  UPDATE enrolment SET status = 'active' WHERE id = v_enrolment.id;
  RETURN QUERY SELECT v_class, v_enrolment.id, true;
  RETURN;
 END IF;
 RETURN QUERY SELECT v_class, v_enrolment.id, false;
END $$;

-- The active classes a student belongs to, with the names of their active teachers.
-- Join codes are not included: a student does not manage the class.
CREATE OR REPLACE FUNCTION sonder.student_classes(p_student uuid)
RETURNS TABLE (class_id uuid, name text, grade_level smallint, teacher_names text, joined_at timestamptz)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT c.id, c.name, c.grade_level,
        coalesce((SELECT string_agg(u.display_name, ', ' ORDER BY u.display_name)
                  FROM class_teacher ct JOIN app_user u ON u.id = ct.teacher_id
                  WHERE ct.class_id = c.id AND ct.status = 'active' AND u.status = 'active'), ''),
        e.joined_at
 FROM enrolment e JOIN classroom c ON c.id = e.class_id
 WHERE e.student_id = p_student AND e.status = 'active' AND c.status = 'active'
$$;

-- Active students of a class, for its teacher only (empty otherwise). Display names only: the
-- roster does not expose email addresses.
CREATE OR REPLACE FUNCTION sonder.class_roster(p_teacher uuid, p_class uuid)
RETURNS TABLE (student_id uuid, display_name text, joined_at timestamptz)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT u.id, u.display_name, e.joined_at
 FROM enrolment e JOIN app_user u ON u.id = e.student_id
 WHERE e.class_id = p_class AND e.status = 'active' AND sonder.is_class_teacher(p_teacher, p_class)
$$;

-- The class teacher removes a student (enrolment becomes 'left'; the row and its history stay).
CREATE OR REPLACE FUNCTION sonder.remove_student(p_teacher uuid, p_class uuid, p_student uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, sonder AS $$
BEGIN
 IF NOT is_class_teacher(p_teacher, p_class) THEN PERFORM product_error('class_not_found'); END IF;
 PERFORM set_config('sonder.actor_id', p_teacher::text, true);
 UPDATE enrolment SET status = 'left' WHERE class_id = p_class AND student_id = p_student AND status = 'active';
 IF NOT FOUND THEN PERFORM product_error('student_not_found'); END IF;
END $$;

-- Replace the join code at once; the old code stops working.
CREATE OR REPLACE FUNCTION sonder.regenerate_join_code(p_teacher uuid, p_class uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, sonder AS $$
DECLARE
 v_code text;
 attempt integer := 0;
BEGIN
 IF NOT is_class_teacher(p_teacher, p_class) THEN PERFORM product_error('class_not_found'); END IF;
 PERFORM set_config('sonder.actor_id', p_teacher::text, true);
 LOOP
  attempt := attempt + 1;
  v_code := new_join_code();
  BEGIN
   UPDATE classroom SET join_code = v_code WHERE id = p_class;
   RETURN v_code;
  EXCEPTION WHEN unique_violation THEN
   IF attempt >= 5 THEN PERFORM product_error('join_code_unavailable'); END IF;
  END;
 END LOOP;
END $$;

-- Archive a class (no one can join; Ahmed's start already refuses archived classes, D9) or make
-- it active again. Enrolments are kept either way.
CREATE OR REPLACE FUNCTION sonder.set_class_status(p_teacher uuid, p_class uuid, p_status text) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, sonder AS $$
BEGIN
 IF p_status IS NULL OR p_status NOT IN ('active', 'archived') THEN PERFORM product_error('class_status_invalid'); END IF;
 IF NOT is_class_teacher(p_teacher, p_class) THEN PERFORM product_error('class_not_found'); END IF;
 PERFORM set_config('sonder.actor_id', p_teacher::text, true);
 UPDATE classroom SET status = p_status WHERE id = p_class AND status <> p_status;
END $$;

REVOKE ALL ON FUNCTION sonder.normalise_join_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.is_class_teacher(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.join_class(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.student_classes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.class_roster(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.remove_student(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.regenerate_join_code(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.set_class_status(uuid, uuid, text) FROM PUBLIC;
