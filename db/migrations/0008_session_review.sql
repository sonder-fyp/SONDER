-- 0008_session_review: a teacher's review and follow-up status of a finished check (I2-A14).
--
-- Rules (docs/design/I2_TEACHER_STUDENT_REQUIREMENTS.md section 5):
--   * unreviewed = no row; states 'reviewed' and 'follow_up_required'; optional note <= 2000;
--   * append-only: every change is a new revision (1, 2, ...); rows are never updated or deleted;
--   * a write names the revision it expects; a different current revision is review_conflict;
--   * the same request key returns the revision it created (an identical retry);
--   * only a finished session, only by an active teacher of the session's class.
-- A review never touches diagnosis or escalation and is not shown to students. It is not approval
-- for release (G5).

CREATE TABLE sonder.session_review (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES sonder.diagnostic_session ON DELETE RESTRICT,
 revision integer NOT NULL CHECK (revision >= 1),
 status text NOT NULL CHECK (status IN ('reviewed', 'follow_up_required')),
 note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
 actor_id uuid NOT NULL REFERENCES sonder.app_user ON DELETE RESTRICT,
 request_key text NOT NULL CHECK (length(request_key) BETWEEN 1 AND 64),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (session_id, revision),
 UNIQUE (session_id, request_key)
);

-- Every insert, however it is made: the reviewer teaches the session's class, the session is
-- finished, and the revision is the next one.
CREATE OR REPLACE FUNCTION sonder.session_review_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE v_class uuid; v_status text;
BEGIN
 SELECT e.class_id, s.status INTO v_class, v_status
 FROM diagnostic_session s JOIN enrolment e ON e.id = s.enrolment_id WHERE s.id = NEW.session_id;
 IF v_class IS NULL OR NOT is_class_teacher(NEW.actor_id, v_class) THEN
  RAISE EXCEPTION 'A review is written by an active teacher of the session''s class';
 END IF;
 IF v_status = 'in_progress' THEN RAISE EXCEPTION 'Only a finished session can be reviewed'; END IF;
 IF NEW.revision <> coalesce((SELECT max(revision) FROM session_review WHERE session_id = NEW.session_id), 0) + 1 THEN
  RAISE EXCEPTION 'A review revision follows the latest one';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER a_scope BEFORE INSERT ON sonder.session_review
 FOR EACH ROW EXECUTE FUNCTION sonder.session_review_guard();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON sonder.session_review
 FOR EACH ROW EXECUTE FUNCTION sonder.reject_mutation();
CREATE TRIGGER audit AFTER INSERT ON sonder.session_review
 FOR EACH ROW EXECUTE FUNCTION sonder.record_audit();

-- Revisions of one session, oldest first, for an active teacher of its class (empty otherwise).
CREATE OR REPLACE FUNCTION sonder.session_reviews(p_teacher uuid, p_session uuid)
RETURNS TABLE (revision integer, status text, note text, reviewer_name text, created_at timestamptz)
LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT r.revision, r.status, r.note, u.display_name, r.created_at
 FROM session_review r
 JOIN diagnostic_session s ON s.id = r.session_id
 JOIN enrolment e ON e.id = s.enrolment_id
 JOIN app_user u ON u.id = r.actor_id
 WHERE r.session_id = p_session AND sonder.is_class_teacher(p_teacher, e.class_id)
 ORDER BY r.revision
$$;

-- Append a review revision. Returns the revision written (or, for an identical retry, the one the
-- same request key wrote before). Locks the session row so two teachers' writes are decided in turn.
CREATE OR REPLACE FUNCTION sonder.add_session_review(p_teacher uuid, p_session uuid, p_expected_revision integer,
                                                     p_status text, p_note text, p_request_key text)
RETURNS integer
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, sonder AS $$
DECLARE
 v_note text := btrim(coalesce(p_note, ''));
 v_class uuid;
 v_status text;
 v_current integer;
 v_existing session_review;
BEGIN
 SELECT e.class_id, s.status INTO v_class, v_status
 FROM diagnostic_session s JOIN enrolment e ON e.id = s.enrolment_id WHERE s.id = p_session FOR UPDATE OF s;
 IF v_class IS NULL OR NOT is_class_teacher(p_teacher, v_class) THEN PERFORM product_error('session_not_found'); END IF;
 IF p_status IS NULL OR p_status NOT IN ('reviewed', 'follow_up_required') THEN PERFORM product_error('review_status_invalid'); END IF;
 IF length(v_note) > 2000 THEN PERFORM product_error('review_note_invalid'); END IF;
 IF p_request_key IS NULL OR length(p_request_key) NOT BETWEEN 1 AND 64 THEN PERFORM product_error('invalid_request'); END IF;

 SELECT * INTO v_existing FROM session_review WHERE session_id = p_session AND request_key = p_request_key;
 IF v_existing.id IS NOT NULL THEN
  IF v_existing.status = p_status AND v_existing.note = v_note AND v_existing.actor_id = p_teacher THEN
   RETURN v_existing.revision;
  END IF;
  PERFORM product_error('review_conflict');
 END IF;
 IF v_status = 'in_progress' THEN PERFORM product_error('session_unfinished'); END IF;
 v_current := coalesce((SELECT max(revision) FROM session_review WHERE session_id = p_session), 0);
 IF p_expected_revision IS DISTINCT FROM v_current THEN PERFORM product_error('review_conflict'); END IF;

 PERFORM set_config('sonder.actor_id', p_teacher::text, true);
 PERFORM set_config('sonder.request_key', p_request_key, true);
 INSERT INTO session_review (session_id, revision, status, note, actor_id, request_key)
 VALUES (p_session, v_current + 1, p_status, v_note, p_teacher, p_request_key);
 RETURN v_current + 1;
END $$;

REVOKE ALL ON TABLE sonder.session_review FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.session_review_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.session_reviews(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sonder.add_session_review(uuid, uuid, integer, text, text, text) FROM PUBLIC;
