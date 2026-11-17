-- 0003_classes: teacher class creation and the teacher's own class list (I2-H09).
--
-- Uses the Iteration 1 tables classroom, class_teacher and class_subject unchanged. The rules
-- live here as functions so they are tested against PostgreSQL itself
-- (tests/test_product_classes.py) and the Next.js routes stay thin.
--
-- Errors meant for the caller use SQLSTATE SN001 with a stable machine code as the message
-- (for example 'class_name_invalid'); the UI maps those codes to HTTP responses. Any other
-- error is unexpected and is reported as a service failure.
--
-- Runs inside the migration runner's transaction (no BEGIN/COMMIT here).

CREATE OR REPLACE FUNCTION sonder.product_error(code text) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
 RAISE EXCEPTION USING ERRCODE = 'SN001', MESSAGE = code;
END $$;

-- Ten characters from an alphabet without 0/O and 1/I, so a code read aloud or copied from a
-- board is not mistyped. Bytes 0-5 and 10-13 of a version 4 UUID are fully random
-- (gen_random_uuid uses the server's strong random source); 256 is a multiple of 32, so
-- "byte % 32" is unbiased. 32^10 (about 1.1e15) codes make guessing impractical.
CREATE OR REPLACE FUNCTION sonder.new_join_code() RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, sonder AS $$
DECLARE
 alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 b bytea := uuid_send(gen_random_uuid());
 code text := '';
 i integer;
BEGIN
 FOREACH i IN ARRAY ARRAY[0, 1, 2, 3, 4, 5, 10, 11, 12, 13] LOOP
  code := code || substr(alphabet, get_byte(b, i) % 32 + 1, 1);
 END LOOP;
 RETURN code;
END $$;

-- Create a Maths class owned by an active teacher. In one transaction: the classroom, the
-- teacher's active class_teacher row and the class_subject row for MATH (a student can only
-- start a diagnostic in a class that teaches the release's subject; PERSISTENCE_AND_ACCESS D9).
-- The audit triggers record the teacher as the actor.
CREATE OR REPLACE FUNCTION sonder.create_class(p_teacher uuid, p_name text, p_note text DEFAULT '')
RETURNS TABLE (class_id uuid, join_code text)
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, sonder AS $$
#variable_conflict use_column
DECLARE
 v_name text := btrim(coalesce(p_name, ''));
 v_note text := btrim(coalesce(p_note, ''));
 v_subject uuid;
 v_class uuid;
 v_code text;
 attempt integer := 0;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM app_user WHERE id = p_teacher AND role = 'teacher' AND status = 'active') THEN
  PERFORM product_error('teacher_required');
 END IF;
 IF length(v_name) NOT BETWEEN 1 AND 80 THEN PERFORM product_error('class_name_invalid'); END IF;
 IF length(v_note) > 500 THEN PERFORM product_error('class_note_invalid'); END IF;
 SELECT id INTO v_subject FROM subject WHERE code = 'MATH';
 IF v_subject IS NULL THEN PERFORM product_error('subject_missing'); END IF;

 PERFORM set_config('sonder.actor_id', p_teacher::text, true);
 LOOP
  attempt := attempt + 1;
  v_code := new_join_code();
  BEGIN
   INSERT INTO classroom (name, note, join_code) VALUES (v_name, v_note, v_code) RETURNING id INTO v_class;
   EXIT;
  EXCEPTION WHEN unique_violation THEN
   IF attempt >= 5 THEN PERFORM product_error('join_code_unavailable'); END IF;
  END;
 END LOOP;
 INSERT INTO class_teacher (class_id, teacher_id) VALUES (v_class, p_teacher);
 INSERT INTO class_subject (class_id, subject_id) VALUES (v_class, v_subject);
 RETURN QUERY SELECT v_class, v_code;
END $$;

-- The classes a teacher actively teaches, archived ones included (the UI labels them). Only
-- active enrolments are counted. Callers order the result; a class the teacher does not teach
-- is simply absent, which the API reports as not found.
CREATE OR REPLACE FUNCTION sonder.teacher_classes(p_teacher uuid)
RETURNS TABLE (class_id uuid, name text, note text, join_code text, grade_level smallint,
               status text, student_count integer, created_at timestamptz)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT c.id, c.name, c.note, c.join_code, c.grade_level, c.status,
        (SELECT count(*)::integer FROM enrolment e WHERE e.class_id = c.id AND e.status = 'active'),
        c.created_at
 FROM class_teacher ct
 JOIN classroom c ON c.id = ct.class_id
 WHERE ct.teacher_id = p_teacher AND ct.status = 'active'
$$;

REVOKE ALL ON FUNCTION sonder.product_error(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.new_join_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.create_class(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.teacher_classes(uuid) FROM PUBLIC;
