-- 0011_student_dashboard: a student's open assignments with their own latest attempt (I2-A16, I2-A17).
--
-- One row per open assignment of the student's active classes (as sonder.student_assignments) plus,
-- for the student's own attempts at it: the latest attempt (started_at, then id), whether it is in
-- progress or submitted, answers given, its budget, and how many attempts there are. The UI derives
-- Start / Resume / Done from these fields (docs/design/I2_TEACHER_STUDENT_REQUIREMENTS.md section 6).
-- Only student-safe fields: no outcome, diagnosis, probability or review.

CREATE OR REPLACE FUNCTION sonder.student_dashboard(p_student uuid)
RETURNS TABLE (assignment_id uuid, class_id uuid, class_name text, title text, unit_code text, unit_name text,
               attempt_rule text, created_at timestamptz, latest_session_id uuid, latest_state text,
               answered integer, question_budget integer, attempts integer)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT a.id, c.id, c.name, a.title, du.unit_code, du.name, a.attempt_rule, a.created_at,
        latest.id,
        CASE WHEN latest.id IS NULL THEN NULL WHEN latest.status = 'in_progress' THEN 'in_progress' ELSE 'submitted' END,
        COALESCE((SELECT count(*)::integer FROM session_step st WHERE st.session_id = latest.id), 0),
        latest.question_budget,
        (SELECT count(*)::integer FROM diagnostic_session x WHERE x.enrolment_id = e.id AND x.assignment_id = a.id)
 FROM enrolment e
 JOIN app_user s ON s.id = e.student_id AND s.role = 'student' AND s.status = 'active'
 JOIN classroom c ON c.id = e.class_id AND c.status = 'active'
 JOIN class_assignment a ON a.class_id = c.id AND a.status = 'open'
 JOIN diagnostic_unit du ON du.id = a.unit_id
 LEFT JOIN LATERAL (
   SELECT x.id, x.status, x.question_budget FROM diagnostic_session x
   WHERE x.enrolment_id = e.id AND x.assignment_id = a.id
   ORDER BY x.started_at DESC, x.id DESC LIMIT 1
 ) latest ON true
 WHERE e.student_id = p_student AND e.status = 'active'
$$;

REVOKE ALL ON FUNCTION sonder.student_dashboard(uuid) FROM PUBLIC;
