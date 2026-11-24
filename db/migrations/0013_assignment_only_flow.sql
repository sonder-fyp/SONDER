-- 0013_assignment_only_flow: every check belongs to an assignment (product decision, 18 Nov 2026).
--
-- 1. sonder.student_dashboard also lists a CLOSED assignment while the student's latest attempt at it is
--    still in progress (answering stays possible after closing; only starting is refused), and says
--    whether each assignment is open or closed (new column assignment_status).
-- 2. sonder.teacher_queue: finished checks waiting for the teacher, across all of the teacher's active
--    classes: the latest attempt of each (student, assignment) for open AND closed assignments, plus
--    checks started without an assignment, whose latest review is missing or 'follow_up_required'.
-- 3. sonder.class_other_checks: a class's sessions started without an assignment (the retired
--    self-start path), so none of them is invisible to the class teacher.
-- 4. sonder.session_attempts: every attempt of the same student at the same assignment as one session,
--    numbered, so a teacher can open earlier attempts of a repeat assignment.
-- Student-safe rule unchanged: student_dashboard returns no outcome, diagnosis, probability or review.

-- The return type changes, so the function is dropped and created again.
DROP FUNCTION sonder.student_dashboard(uuid);

CREATE FUNCTION sonder.student_dashboard(p_student uuid)
RETURNS TABLE (assignment_id uuid, class_id uuid, class_name text, title text, unit_code text, unit_name text,
               attempt_rule text, created_at timestamptz, latest_session_id uuid, latest_state text,
               answered integer, question_budget integer, attempts integer, assignment_status text)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT a.id, c.id, c.name, a.title, du.unit_code, du.name, a.attempt_rule, a.created_at,
        latest.id,
        CASE WHEN latest.id IS NULL THEN NULL WHEN latest.status = 'in_progress' THEN 'in_progress' ELSE 'submitted' END,
        COALESCE((SELECT count(*)::integer FROM session_step st WHERE st.session_id = latest.id), 0),
        latest.question_budget,
        (SELECT count(*)::integer FROM diagnostic_session x WHERE x.enrolment_id = e.id AND x.assignment_id = a.id),
        a.status
 FROM enrolment e
 JOIN app_user s ON s.id = e.student_id AND s.role = 'student' AND s.status = 'active'
 JOIN classroom c ON c.id = e.class_id AND c.status = 'active'
 JOIN class_assignment a ON a.class_id = c.id
 JOIN diagnostic_unit du ON du.id = a.unit_id
 LEFT JOIN LATERAL (
   SELECT x.id, x.status, x.question_budget FROM diagnostic_session x
   WHERE x.enrolment_id = e.id AND x.assignment_id = a.id
   ORDER BY x.started_at DESC, x.id DESC LIMIT 1
 ) latest ON true
 WHERE e.student_id = p_student AND e.status = 'active'
   AND (a.status = 'open' OR latest.status = 'in_progress')
$$;

CREATE FUNCTION sonder.teacher_queue(p_teacher uuid)
RETURNS TABLE (session_id uuid, class_id uuid, class_name text, student_name text, assignment_id uuid,
               assignment_title text, unit_code text, ended_at timestamptz, review_status text)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 WITH mine AS (
   SELECT c.id, c.name FROM classroom c
   WHERE c.status = 'active' AND sonder.is_class_teacher(p_teacher, c.id)
 ), enrolled AS (
   SELECT e.id, e.class_id, e.student_id FROM enrolment e JOIN mine ON mine.id = e.class_id
   WHERE e.status = 'active'
 ), latest AS (
   SELECT DISTINCT ON (s.enrolment_id, s.assignment_id) s.id, s.enrolment_id, s.assignment_id, s.unit_id, s.status, s.ended_at
   FROM diagnostic_session s JOIN enrolled ON enrolled.id = s.enrolment_id
   WHERE s.assignment_id IS NOT NULL
   ORDER BY s.enrolment_id, s.assignment_id, s.started_at DESC, s.id DESC
 ), candidates AS (
   SELECT id, enrolment_id, assignment_id, unit_id, status, ended_at FROM latest
   UNION ALL
   SELECT s.id, s.enrolment_id, s.assignment_id, s.unit_id, s.status, s.ended_at
   FROM diagnostic_session s JOIN enrolled ON enrolled.id = s.enrolment_id
   WHERE s.assignment_id IS NULL
 )
 SELECT k.id, mine.id, mine.name, u.display_name, a.id, a.title, du.unit_code, k.ended_at, r.status
 FROM candidates k
 JOIN enrolled e ON e.id = k.enrolment_id
 JOIN mine ON mine.id = e.class_id
 JOIN app_user u ON u.id = e.student_id
 JOIN diagnostic_unit du ON du.id = k.unit_id
 LEFT JOIN class_assignment a ON a.id = k.assignment_id
 LEFT JOIN LATERAL (
   SELECT rv.status FROM session_review rv WHERE rv.session_id = k.id ORDER BY rv.revision DESC LIMIT 1
 ) r ON true
 WHERE k.status <> 'in_progress' AND (r.status IS NULL OR r.status = 'follow_up_required')
$$;

CREATE FUNCTION sonder.class_other_checks(p_teacher uuid, p_class uuid)
RETURNS TABLE (session_id uuid, student_name text, unit_code text, unit_name text, state text, answered integer,
               question_budget integer, started_at timestamptz, ended_at timestamptz, review_status text)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT s.id, u.display_name, du.unit_code, du.name,
        CASE WHEN s.status = 'in_progress' THEN 'in_progress' ELSE 'completed' END,
        (SELECT count(*)::integer FROM session_step st WHERE st.session_id = s.id),
        s.question_budget, s.started_at, s.ended_at,
        (SELECT rv.status FROM session_review rv WHERE rv.session_id = s.id ORDER BY rv.revision DESC LIMIT 1)
 FROM diagnostic_session s
 JOIN enrolment e ON e.id = s.enrolment_id
 JOIN app_user u ON u.id = e.student_id
 JOIN diagnostic_unit du ON du.id = s.unit_id
 WHERE e.class_id = p_class AND s.assignment_id IS NULL AND sonder.is_class_teacher(p_teacher, p_class)
$$;

CREATE FUNCTION sonder.session_attempts(p_teacher uuid, p_session uuid)
RETURNS TABLE (session_id uuid, attempt_number integer, state text, answered integer, question_budget integer,
               started_at timestamptz, ended_at timestamptz, review_status text)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT s.id,
        (row_number() OVER (ORDER BY s.started_at, s.id))::integer,
        CASE WHEN s.status = 'in_progress' THEN 'in_progress' ELSE 'completed' END,
        (SELECT count(*)::integer FROM session_step st WHERE st.session_id = s.id),
        s.question_budget, s.started_at, s.ended_at,
        (SELECT rv.status FROM session_review rv WHERE rv.session_id = s.id ORDER BY rv.revision DESC LIMIT 1)
 FROM diagnostic_session me
 JOIN enrolment e ON e.id = me.enrolment_id
 JOIN diagnostic_session s ON s.enrolment_id = me.enrolment_id AND s.assignment_id = me.assignment_id
 WHERE me.id = p_session AND me.assignment_id IS NOT NULL AND sonder.is_class_teacher(p_teacher, e.class_id)
$$;

REVOKE ALL ON FUNCTION sonder.student_dashboard(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.teacher_queue(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.class_other_checks(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.session_attempts(uuid, uuid) FROM PUBLIC;
