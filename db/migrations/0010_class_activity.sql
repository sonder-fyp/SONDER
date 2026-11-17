-- 0010_class_activity: one row per (student, assignment) for the teacher dashboard (I2-A11).
--
-- Definitions (docs/design/I2_TEACHER_STUDENT_REQUIREMENTS.md section 3). The dashboard's counts are
-- computed from exactly these rows, so counts and the table can never disagree.
--   * students: active enrolments of the class;
--   * assignments: the open ones, or the one asked for (open or closed);
--   * latest attempt: the latest session linked to that assignment for that student
--     (started_at, then id); state not_started / in_progress / completed (any finished status);
--   * review: the latest revision of the latest attempt's review, if any.
-- Sessions started without an assignment are not part of these rows.

CREATE OR REPLACE FUNCTION sonder.class_activity(p_teacher uuid, p_class uuid, p_assignment uuid DEFAULT NULL)
RETURNS TABLE (student_id uuid, student_name text, assignment_id uuid, assignment_title text, unit_code text,
               attempt_rule text, state text, session_id uuid, answered integer, question_budget integer,
               attempts integer, last_activity timestamptz, review_status text)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT e.student_id, u.display_name, a.id, a.title, du.unit_code, a.attempt_rule,
        CASE WHEN latest.id IS NULL THEN 'not_started'
             WHEN latest.status = 'in_progress' THEN 'in_progress' ELSE 'completed' END,
        latest.id,
        COALESCE((SELECT count(*)::integer FROM session_step st WHERE st.session_id = latest.id), 0),
        latest.question_budget,
        (SELECT count(*)::integer FROM diagnostic_session x WHERE x.enrolment_id = e.id AND x.assignment_id = a.id),
        CASE WHEN latest.id IS NULL THEN NULL
             ELSE COALESCE(latest.ended_at,
                           (SELECT max(st.answered_at) FROM session_step st WHERE st.session_id = latest.id),
                           latest.started_at) END,
        (SELECT r.status FROM session_review r WHERE r.session_id = latest.id ORDER BY r.revision DESC LIMIT 1)
 FROM enrolment e
 JOIN app_user u ON u.id = e.student_id
 JOIN class_assignment a ON a.class_id = e.class_id
 JOIN diagnostic_unit du ON du.id = a.unit_id
 LEFT JOIN LATERAL (
   SELECT s.id, s.status, s.question_budget, s.started_at, s.ended_at
   FROM diagnostic_session s
   WHERE s.enrolment_id = e.id AND s.assignment_id = a.id
   ORDER BY s.started_at DESC, s.id DESC LIMIT 1
 ) latest ON true
 WHERE e.class_id = p_class AND e.status = 'active'
   AND (CASE WHEN p_assignment IS NULL THEN a.status = 'open' ELSE a.id = p_assignment END)
   AND sonder.is_class_teacher(p_teacher, p_class)
$$;

REVOKE ALL ON FUNCTION sonder.class_activity(uuid, uuid, uuid) FROM PUBLIC;
