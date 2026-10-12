BEGIN;
SET LOCAL search_path = sonder, public;
CREATE TABLE IF NOT EXISTS announcement (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid NOT NULL REFERENCES classroom ON DELETE RESTRICT,
 author_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT, title text NOT NULL, body text NOT NULL,
 request_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(class_id,author_id,request_key)
);
CREATE TABLE IF NOT EXISTS dm_thread (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrolment_id uuid NOT NULL REFERENCES enrolment ON DELETE RESTRICT,
 teacher_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 guardian_link_id uuid REFERENCES guardian_link ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE NULLS NOT DISTINCT(enrolment_id,teacher_id,guardian_link_id)
 -- NULL guardian: teacher-student. Otherwise exactly this guardian, about this child/class.
);
CREATE TABLE IF NOT EXISTS dm_message (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL REFERENCES dm_thread ON DELETE RESTRICT,
 sender_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 body text NOT NULL CHECK(length(btrim(body))>0), sent_at timestamptz NOT NULL DEFAULT now(),
 request_key text NOT NULL, UNIQUE(thread_id,sender_id,request_key)
);
CREATE TABLE IF NOT EXISTS dm_read_cursor (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL REFERENCES dm_thread ON DELETE RESTRICT,
 reader_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 last_read_message_id uuid NOT NULL REFERENCES dm_message ON DELETE RESTRICT,
 read_at timestamptz NOT NULL DEFAULT now(), UNIQUE(thread_id,reader_id)
);
CREATE OR REPLACE FUNCTION dm_participant(t uuid,u uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT EXISTS(SELECT 1 FROM dm_thread dt JOIN enrolment e ON e.id=dt.enrolment_id
 JOIN classroom c ON c.id=e.class_id JOIN app_user au ON au.id=u
 JOIN class_teacher ct ON ct.class_id=e.class_id AND ct.teacher_id=dt.teacher_id
 LEFT JOIN guardian_link g ON g.id=dt.guardian_link_id
 WHERE dt.id=t AND au.status='active' AND c.status='active' AND e.status='active' AND ct.status='active'
 AND (u=dt.teacher_id OR (dt.guardian_link_id IS NULL AND u=e.student_id) OR (g.status='active' AND g.student_id=e.student_id AND u=g.parent_id)))
$$;
CREATE OR REPLACE FUNCTION messaging_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE e enrolment; g guardian_link;
BEGIN
 IF TG_TABLE_NAME='announcement' THEN
  IF NOT EXISTS(SELECT 1 FROM class_teacher ct JOIN classroom c ON c.id=ct.class_id JOIN app_user u ON u.id=ct.teacher_id WHERE ct.class_id=NEW.class_id AND ct.teacher_id=NEW.author_id AND ct.status='active' AND c.status='active' AND u.status='active') THEN RAISE EXCEPTION 'Announcement author outside class'; END IF;
 ELSIF TG_TABLE_NAME='dm_thread' THEN
  SELECT * INTO e FROM enrolment WHERE id=NEW.enrolment_id;
  IF e.status<>'active' OR NOT EXISTS(SELECT 1 FROM class_teacher ct JOIN classroom c ON c.id=ct.class_id WHERE ct.class_id=e.class_id AND ct.teacher_id=NEW.teacher_id AND ct.status='active' AND c.status='active') THEN RAISE EXCEPTION 'Thread outside class'; END IF;
  PERFORM require_user_role(NEW.teacher_id,'teacher');
  IF NEW.guardian_link_id IS NOT NULL THEN SELECT * INTO g FROM guardian_link WHERE id=NEW.guardian_link_id; IF g.status<>'active' OR g.student_id IS DISTINCT FROM e.student_id THEN RAISE EXCEPTION 'Guardian/child mismatch'; END IF; END IF;
 ELSIF TG_TABLE_NAME='dm_message' THEN
  IF NOT dm_participant(NEW.thread_id,NEW.sender_id) THEN RAISE EXCEPTION 'Sender outside thread'; END IF;
 ELSE
  IF NOT dm_participant(NEW.thread_id,NEW.reader_id) OR NOT EXISTS(SELECT 1 FROM dm_message WHERE id=NEW.last_read_message_id AND thread_id=NEW.thread_id) THEN RAISE EXCEPTION 'Read cursor scope'; END IF;
  IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM dm_message oldm JOIN dm_message newm ON newm.id=NEW.last_read_message_id WHERE oldm.id=OLD.last_read_message_id AND (newm.sent_at,newm.id)<(oldm.sent_at,oldm.id)) THEN RAISE EXCEPTION 'Read cursor cannot go backwards'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['announcement','dm_thread','dm_message'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_mutation()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['announcement','dm_thread','dm_message','dm_read_cursor'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER scope_check BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION messaging_guard()',t);
 END LOOP;
END $$;
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON dm_read_cursor FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','thread_id','reader_id');
CREATE INDEX IF NOT EXISTS announcement_stream_idx ON announcement(class_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS dm_inbox_idx ON dm_thread(teacher_id,created_at DESC);
CREATE INDEX IF NOT EXISTS dm_guardian_idx ON dm_thread(guardian_link_id) WHERE guardian_link_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dm_transcript_idx ON dm_message(thread_id,sent_at,id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['announcement','dm_thread','dm_message'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION record_audit()',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA sonder FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sonder FROM PUBLIC;
COMMIT;
