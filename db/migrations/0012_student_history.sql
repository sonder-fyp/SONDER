-- 0012_student_history: a student's own past and current checks (I2-A18).
--
-- Every diagnostic session of the student, newest first, with what a student may see
-- (docs/design/I2_TEACHER_STUDENT_REQUIREMENTS.md sections 2 and 7): unit, class, assignment (if it
-- was started from one), dates, answers given of the budget, in progress or submitted, and the attempt
-- number within its assignment. No outcome, diagnosis, probability or review. Sessions of left or
-- archived classes stay in the student's history.

CREATE OR REPLACE FUNCTION sonder.student_history(p_student uuid)
RETURNS TABLE (session_id uuid, unit_code text, unit_name text, class_name text, assignment_id uuid, assignment_title text,
               attempt_number integer, started_at timestamptz, ended_at timestamptz, state text, answered integer,
               question_budget integer)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT s.id, du.unit_code, du.name, c.name, a.id, a.title,
        CASE WHEN a.id IS NULL THEN NULL
             ELSE (row_number() OVER (PARTITION BY s.enrolment_id, s.assignment_id ORDER BY s.started_at, s.id))::integer END,
        s.started_at, s.ended_at,
        CASE WHEN s.status = 'in_progress' THEN 'in_progress' ELSE 'submitted' END,
        (SELECT count(*)::integer FROM session_step st WHERE st.session_id = s.id),
        s.question_budget
 FROM diagnostic_session s
 JOIN enrolment e ON e.id = s.enrolment_id
 JOIN classroom c ON c.id = e.class_id
 JOIN diagnostic_unit du ON du.id = s.unit_id
 LEFT JOIN class_assignment a ON a.id = s.assignment_id
 WHERE e.student_id = p_student
$$;

REVOKE ALL ON FUNCTION sonder.student_history(uuid) FROM PUBLIC;
