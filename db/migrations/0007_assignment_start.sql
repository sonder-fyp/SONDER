-- 0007_assignment_start: may this student start this assignment now? (I2-H12)
--
-- Called by the persistent start (sonder_api/pgstore.py) inside its transaction, in two steps so an
-- identical start retry still returns its original reply:
--   1. sonder.assignment_enrolment  - which enrolment the start belongs to (membership only);
--   2. the service looks up a retry of the same request key and returns it if found;
--   3. sonder.check_assignment_start - open, same release, attempt rule.
-- Errors use SQLSTATE SN001 (sonder.product_error) with the codes the service returns.

-- The student's active enrolment in the active class of this assignment, and the assignment's unit
-- code. Anything else (unknown id, another class, left the class, archived class, not an active
-- student) is assignment_not_found, so assignment ids cannot be probed.
CREATE OR REPLACE FUNCTION sonder.assignment_enrolment(p_student uuid, p_assignment uuid)
RETURNS TABLE (enrolment_id uuid, unit_code text)
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, sonder AS $$
#variable_conflict use_column
DECLARE
 v_enrolment uuid;
 v_unit text;
BEGIN
 SELECT e.id, u.unit_code INTO v_enrolment, v_unit
 FROM class_assignment a
 JOIN classroom c ON c.id = a.class_id AND c.status = 'active'
 JOIN enrolment e ON e.class_id = a.class_id AND e.student_id = p_student AND e.status = 'active'
 JOIN app_user s ON s.id = e.student_id AND s.role = 'student' AND s.status = 'active'
 JOIN diagnostic_unit u ON u.id = a.unit_id
 WHERE a.id = p_assignment;
 IF v_enrolment IS NULL THEN PERFORM product_error('assignment_not_found'); END IF;
 RETURN QUERY SELECT v_enrolment, v_unit;
END $$;

-- Refuse a new attempt that the assignment does not allow. Locks the enrolment row until the
-- caller's transaction ends, so two simultaneous starts by one student are decided one after the
-- other and cannot both create an attempt.
--   assignment_closed      the teacher closed it
--   assignment_unavailable its unit is not in the content version the service runs
--   attempt_in_progress    an attempt is unfinished: resume it instead
--   attempt_limit_reached  'single' and the student already finished their attempt
-- A finished attempt is any status other than in_progress (an abandoned one counts as used).
-- A session that already has this start's request key is this start itself (an identical retry
-- that waited on the lock): no error, so the service answers it with the original reply.
CREATE OR REPLACE FUNCTION sonder.check_assignment_start(p_enrolment uuid, p_assignment uuid, p_content_version uuid,
                                                         p_request_key text)
RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, sonder AS $$
DECLARE
 v_status text;
 v_rule text;
 v_version uuid;
BEGIN
 PERFORM 1 FROM enrolment WHERE id = p_enrolment FOR UPDATE;
 IF EXISTS (SELECT 1 FROM diagnostic_session WHERE enrolment_id = p_enrolment AND request_key = p_request_key) THEN
  RETURN;
 END IF;
 SELECT a.status, a.attempt_rule, u.content_version_id INTO v_status, v_rule, v_version
 FROM class_assignment a JOIN diagnostic_unit u ON u.id = a.unit_id
 WHERE a.id = p_assignment;
 IF v_status IS NULL THEN PERFORM product_error('assignment_not_found'); END IF;
 IF v_status <> 'open' THEN PERFORM product_error('assignment_closed'); END IF;
 IF v_version IS DISTINCT FROM p_content_version THEN PERFORM product_error('assignment_unavailable'); END IF;
 IF EXISTS (SELECT 1 FROM diagnostic_session
            WHERE enrolment_id = p_enrolment AND assignment_id = p_assignment AND status = 'in_progress') THEN
  PERFORM product_error('attempt_in_progress');
 END IF;
 IF v_rule = 'single' AND EXISTS (SELECT 1 FROM diagnostic_session
                                  WHERE enrolment_id = p_enrolment AND assignment_id = p_assignment) THEN
  PERFORM product_error('attempt_limit_reached');
 END IF;
END $$;

REVOKE ALL ON FUNCTION sonder.assignment_enrolment(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.check_assignment_start(uuid, uuid, uuid, text) FROM PUBLIC;
