-- Sonder schema design, PostgreSQL 16. Apply with ON_ERROR_STOP; no content/seed rows.
-- Each tier requires all earlier tiers. Re-running identical scripts is supported;
-- IF NOT EXISTS is NOT a schema-drift migration mechanism.
BEGIN;
CREATE SCHEMA IF NOT EXISTS sonder;
REVOKE ALL ON SCHEMA sonder FROM PUBLIC;
SET LOCAL search_path = sonder, public;

CREATE TABLE IF NOT EXISTS app_user (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
 role text NOT NULL CHECK (role IN ('student','teacher','parent','admin')),
 display_name text NOT NULL, locale text NOT NULL DEFAULT 'en',
 time_zone text NOT NULL DEFAULT 'Asia/Karachi',
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deactivated','withdrawn')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS password_credential (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES app_user ON DELETE CASCADE,
 password_hash text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_session (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app_user ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 CHECK (expires_at > created_at), CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE TABLE IF NOT EXISTS auth_token (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app_user ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('reset_password','verify_email')),
 token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, consumed_at timestamptz,
 CHECK (expires_at > created_at), CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);
CREATE TABLE IF NOT EXISTS guardian_link (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parent_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 student_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
 linked_at timestamptz NOT NULL DEFAULT now(), UNIQUE(parent_id,student_id), CHECK(parent_id <> student_id)
);
CREATE TABLE IF NOT EXISTS classroom (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, note text NOT NULL DEFAULT '',
 join_code text NOT NULL UNIQUE CHECK (join_code = upper(btrim(join_code)) AND length(join_code) >= 8),
 grade_level smallint NOT NULL DEFAULT 8 CHECK (grade_level BETWEEN 1 AND 12),
 time_zone text NOT NULL DEFAULT 'Asia/Karachi',
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS class_teacher (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid NOT NULL REFERENCES classroom ON DELETE RESTRICT,
 teacher_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','departed')),
 assigned_at timestamptz NOT NULL DEFAULT now(), UNIQUE(class_id,teacher_id)
);
CREATE TABLE IF NOT EXISTS enrolment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid NOT NULL REFERENCES classroom ON DELETE RESTRICT,
 student_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','left')),
 joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE(class_id,student_id)
);
CREATE TABLE IF NOT EXISTS student_home_class (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrolment_id uuid NOT NULL UNIQUE REFERENCES enrolment ON DELETE RESTRICT
 -- One per student is checked by trigger without copying student_id here.
);
CREATE TABLE IF NOT EXISTS subject (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
 name text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS class_subject (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid NOT NULL REFERENCES classroom ON DELETE RESTRICT,
 subject_id uuid NOT NULL REFERENCES subject ON DELETE RESTRICT, UNIQUE(class_id,subject_id)
);
CREATE TABLE IF NOT EXISTS content_version (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject_id uuid NOT NULL REFERENCES subject ON DELETE RESTRICT,
 version_code text NOT NULL, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','frozen')),
 UNIQUE(subject_id,version_code)
 -- Freeze time is the content_frozen audit event, avoiding a derived status/timestamp copy.
);
CREATE TABLE IF NOT EXISTS topic (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject_id uuid NOT NULL REFERENCES subject ON DELETE RESTRICT,
 external_id text NOT NULL, UNIQUE(subject_id,external_id)
);
CREATE TABLE IF NOT EXISTS topic_revision (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), topic_id uuid NOT NULL REFERENCES topic ON DELETE RESTRICT,
 content_version_id uuid NOT NULL REFERENCES content_version ON DELETE RESTRICT,
 name text NOT NULL, blurb text NOT NULL DEFAULT '', grade8_in_scope boolean NOT NULL DEFAULT true,
 UNIQUE(content_version_id,topic_id)
);
CREATE TABLE IF NOT EXISTS misconception (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject_id uuid NOT NULL REFERENCES subject ON DELETE RESTRICT,
 code text NOT NULL, external_id text NOT NULL,
 UNIQUE(subject_id,code), UNIQUE(subject_id,external_id)
);
CREATE TABLE IF NOT EXISTS misconception_revision (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), misconception_id uuid NOT NULL REFERENCES misconception ON DELETE RESTRICT,
 content_version_id uuid NOT NULL REFERENCES content_version ON DELETE RESTRICT,
 name text NOT NULL, description text NOT NULL, cognitive_origin text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','catalogued_only','retired')),
 engine_tier smallint NOT NULL CHECK (engine_tier IN (1,2)),
 UNIQUE(content_version_id,misconception_id), CHECK (engine_tier<>1 OR status='validated')
);
CREATE TABLE IF NOT EXISTS topic_misconception (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), topic_revision_id uuid NOT NULL REFERENCES topic_revision ON DELETE RESTRICT,
 misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 target_minimum integer NOT NULL DEFAULT 3 CHECK(target_minimum>0),
 old_topic_label text, review_note text NOT NULL DEFAULT '',
 disposition text NOT NULL DEFAULT 'keep' CHECK(disposition IN ('keep','move','remove')),
 UNIQUE(topic_revision_id,misconception_revision_id)
);
CREATE TABLE IF NOT EXISTS source_reference (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), citation_key text NOT NULL UNIQUE,
 citation text NOT NULL, url text, licence text NOT NULL, scope_note text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS misconception_source (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 source_id uuid NOT NULL REFERENCES source_reference ON DELETE RESTRICT,
 locator text NOT NULL DEFAULT '', UNIQUE(misconception_revision_id,source_id,locator)
);
CREATE TABLE IF NOT EXISTS item (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), topic_revision_id uuid NOT NULL REFERENCES topic_revision ON DELETE RESTRICT,
 target_misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 external_id text NOT NULL, stem text NOT NULL, batch text,
 difficulty_est numeric CHECK(difficulty_est BETWEEN 0 AND 1),
 origin text NOT NULL CHECK(origin IN ('authored','generated')),
 review_status text NOT NULL DEFAULT 'draft' CHECK(review_status IN ('draft','in_review','approved','rejected')),
 UNIQUE(topic_revision_id,external_id)
 -- Pack-wide external-ID uniqueness is also checked under a version-row lock.
);
CREATE TABLE IF NOT EXISTS item_option (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES item ON DELETE CASCADE,
 label text NOT NULL CHECK(label IN ('A','B','C','D')), external_id text,
 option_text text NOT NULL, is_correct boolean NOT NULL,
 UNIQUE(item_id,label), UNIQUE(item_id,external_id)
);
CREATE TABLE IF NOT EXISTS option_misconception (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), option_id uuid NOT NULL REFERENCES item_option ON DELETE CASCADE,
 misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 rationale text NOT NULL, UNIQUE(option_id,misconception_revision_id)
);
CREATE TABLE IF NOT EXISTS item_numeric_parameter (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES item ON DELETE CASCADE,
 name text NOT NULL, value numeric NOT NULL, unit text, UNIQUE(item_id,name)
);
CREATE TABLE IF NOT EXISTS item_source (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES item ON DELETE CASCADE,
 source_id uuid NOT NULL REFERENCES source_reference ON DELETE RESTRICT,
 locator text NOT NULL DEFAULT '', UNIQUE(item_id,source_id,locator)
);
CREATE TABLE IF NOT EXISTS item_approval (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL UNIQUE REFERENCES item ON DELETE RESTRICT,
 reviewer_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 approved_at timestamptz NOT NULL DEFAULT now(), note text NOT NULL CHECK(length(btrim(note))>0)
);
CREATE TABLE IF NOT EXISTS hypothesis (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_version_id uuid NOT NULL REFERENCES content_version ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('misconception','none','unmodelled')),
 misconception_revision_id uuid REFERENCES misconception_revision ON DELETE RESTRICT,
 CHECK ((kind='misconception') = (misconception_revision_id IS NOT NULL)),
 UNIQUE NULLS NOT DISTINCT(content_version_id,kind,misconception_revision_id)
);
CREATE TABLE IF NOT EXISTS item_prediction (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hypothesis_id uuid NOT NULL REFERENCES hypothesis ON DELETE RESTRICT,
 option_id uuid NOT NULL REFERENCES item_option ON DELETE RESTRICT,
 rationale text NOT NULL, UNIQUE(option_id,hypothesis_id)
 -- Prediction may be correct by coincidence; this is distinct from distractor links.
);
CREATE TABLE IF NOT EXISTS engine_release (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), release_code text NOT NULL UNIQUE,
 code_hash text NOT NULL, confidence_threshold numeric NOT NULL CHECK(confidence_threshold>0 AND confidence_threshold<=1),
 minimum_answers integer NOT NULL CHECK(minimum_answers>0),
 tie_epsilon numeric NOT NULL CHECK(tie_epsilon BETWEEN 0 AND 1),
 eig_floor numeric NOT NULL CHECK(eig_floor>=0),
 unmodelled_threshold numeric NOT NULL CHECK(unmodelled_threshold BETWEEN 0 AND 1),
 selection_policy text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS response_model (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_version_id uuid NOT NULL REFERENCES content_version ON DELETE RESTRICT,
 model_code text NOT NULL, source text NOT NULL CHECK(source IN ('prior','calibrated')),
 calibration_note text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','frozen')),
 UNIQUE(content_version_id,model_code)
);
CREATE TABLE IF NOT EXISTS response_parameter (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), response_model_id uuid NOT NULL REFERENCES response_model ON DELETE RESTRICT,
 hypothesis_id uuid NOT NULL REFERENCES hypothesis ON DELETE RESTRICT,
 slip numeric NOT NULL CHECK(slip BETWEEN 0 AND 1), guess numeric NOT NULL CHECK(guess BETWEEN 0 AND 1),
 UNIQUE(response_model_id,hypothesis_id)
);
CREATE TABLE IF NOT EXISTS response_probability (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), response_model_id uuid NOT NULL REFERENCES response_model ON DELETE RESTRICT,
 hypothesis_id uuid NOT NULL REFERENCES hypothesis ON DELETE RESTRICT,
 option_id uuid NOT NULL REFERENCES item_option ON DELETE RESTRICT,
 probability numeric NOT NULL CHECK(probability BETWEEN 0 AND 1),
 UNIQUE(response_model_id,hypothesis_id,option_id)
);
CREATE TABLE IF NOT EXISTS diagnostic_session (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrolment_id uuid NOT NULL REFERENCES enrolment ON DELETE RESTRICT,
 response_model_id uuid NOT NULL REFERENCES response_model ON DELETE RESTRICT,
 engine_release_id uuid NOT NULL REFERENCES engine_release ON DELETE RESTRICT,
 topic_revision_id uuid REFERENCES topic_revision ON DELETE RESTRICT,
 question_budget integer NOT NULL CHECK(question_budget>0),
 request_key text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 status text NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','diagnosed','none_detected','escalated_no_separator','escalated_exhausted','escalated_unmodelled','abandoned')),
 UNIQUE(enrolment_id,request_key),
 CHECK((status='in_progress') = (ended_at IS NULL)), CHECK(ended_at IS NULL OR ended_at>=started_at)
);
CREATE TABLE IF NOT EXISTS session_hypothesis (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES diagnostic_session ON DELETE RESTRICT,
 hypothesis_id uuid NOT NULL REFERENCES hypothesis ON DELETE RESTRICT,
 prior_probability numeric NOT NULL CHECK(prior_probability BETWEEN 0 AND 1), UNIQUE(session_id,hypothesis_id)
);
CREATE TABLE IF NOT EXISTS session_question (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES diagnostic_session ON DELETE RESTRICT,
 step_index integer NOT NULL CHECK(step_index>=0), item_id uuid NOT NULL REFERENCES item ON DELETE RESTRICT,
 presented_at timestamptz NOT NULL DEFAULT now(), selection_reason text NOT NULL,
 entropy_before numeric NOT NULL CHECK(entropy_before>=0), expected_ig numeric NOT NULL CHECK(expected_ig>=0),
 UNIQUE(session_id,step_index), UNIQUE(session_id,item_id)
);
CREATE TABLE IF NOT EXISTS session_step (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES diagnostic_session ON DELETE RESTRICT,
 step_index integer NOT NULL CHECK(step_index>=0), session_question_id uuid NOT NULL UNIQUE REFERENCES session_question ON DELETE RESTRICT,
 answer_option_id uuid NOT NULL REFERENCES item_option ON DELETE RESTRICT,
 answered_at timestamptz NOT NULL DEFAULT now(), request_key text NOT NULL, calculation_ms numeric NOT NULL CHECK(calculation_ms>=0),
 UNIQUE(session_id,step_index), UNIQUE(session_id,request_key)
 -- session_id/step_index intentionally mirror the presentation for trace lookup.
);
CREATE TABLE IF NOT EXISTS step_posterior (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), step_id uuid NOT NULL REFERENCES session_step ON DELETE RESTRICT,
 session_hypothesis_id uuid NOT NULL REFERENCES session_hypothesis ON DELETE RESTRICT,
 probability numeric NOT NULL CHECK(probability BETWEEN 0 AND 1), UNIQUE(step_id,session_hypothesis_id)
);
CREATE TABLE IF NOT EXISTS diagnosis (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL UNIQUE REFERENCES diagnostic_session ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS diagnosis_candidate (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), diagnosis_id uuid NOT NULL REFERENCES diagnosis ON DELETE RESTRICT,
 session_hypothesis_id uuid NOT NULL REFERENCES session_hypothesis ON DELETE RESTRICT,
 rank smallint NOT NULL CHECK(rank IN (1,2)), UNIQUE(diagnosis_id,rank), UNIQUE(diagnosis_id,session_hypothesis_id)
 -- Confidence is joined from the last step's posterior, never copied.
);
CREATE TABLE IF NOT EXISTS escalation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL UNIQUE REFERENCES diagnostic_session ON DELETE RESTRICT,
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
 -- Open/resolved is derived from latest teacher_review, not another mutable status.
);
CREATE TABLE IF NOT EXISTS escalation_candidate (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), escalation_id uuid NOT NULL REFERENCES escalation ON DELETE RESTRICT,
 session_hypothesis_id uuid NOT NULL REFERENCES session_hypothesis ON DELETE RESTRICT,
 rank smallint NOT NULL CHECK(rank IN (1,2)), UNIQUE(escalation_id,rank), UNIQUE(escalation_id,session_hypothesis_id)
);
CREATE TABLE IF NOT EXISTS teacher_review (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES diagnostic_session ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0), teacher_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 decision text NOT NULL CHECK(decision IN ('approved','corrected','rejected','resolved')),
 conclusion text CHECK(conclusion IN ('misconception','none_detected')),
 misconception_revision_id uuid REFERENCES misconception_revision ON DELETE RESTRICT,
 note text NOT NULL CHECK(length(btrim(note))>0), request_key text NOT NULL,
 decided_at timestamptz NOT NULL DEFAULT now(), UNIQUE(session_id,revision), UNIQUE(session_id,request_key),
 CHECK ((decision='rejected' AND conclusion IS NULL AND misconception_revision_id IS NULL)
 OR (decision<>'rejected' AND conclusion IS NOT NULL AND ((conclusion='misconception') = (misconception_revision_id IS NOT NULL))))
);
CREATE TABLE IF NOT EXISTS audit_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES app_user ON DELETE RESTRICT,
 event_type text NOT NULL, relation_name text NOT NULL, row_id uuid NOT NULL,
 request_key text, occurred_at timestamptz NOT NULL DEFAULT now(),
 detail jsonb NOT NULL DEFAULT '{}'::jsonb
 -- Opaque audit before/after payload only; not authorization, references or workflow state.
);
CREATE TABLE IF NOT EXISTS privacy_request (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('export','withdraw_delete')),
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','processing','completed','failed')),
 requested_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, note text NOT NULL DEFAULT ''
);

CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN RAISE EXCEPTION '% is append-only/immutable', TG_TABLE_NAME; END $$;
CREATE OR REPLACE FUNCTION state_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE old_state text; new_state text;
BEGIN
 new_state := to_jsonb(NEW)->>TG_ARGV[0];
 IF TG_OP='INSERT' THEN
   IF NOT (new_state=ANY(string_to_array(TG_ARGV[1],','))) THEN RAISE EXCEPTION 'Invalid initial % state',TG_TABLE_NAME; END IF;
 ELSE
   old_state := to_jsonb(OLD)->>TG_ARGV[0];
   IF old_state<>new_state AND NOT ((old_state||'>'||new_state)=ANY(string_to_array(TG_ARGV[2],',')))
   THEN RAISE EXCEPTION 'Illegal % transition % -> %',TG_TABLE_NAME,old_state,new_state; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION fixed_keys() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE col text;
BEGIN
 FOREACH col IN ARRAY TG_ARGV LOOP
  IF (to_jsonb(OLD)->col) IS DISTINCT FROM (to_jsonb(NEW)->col) THEN RAISE EXCEPTION 'Immutable key %.%',TG_TABLE_NAME,col; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION require_user_role(uid uuid, expected text) RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM app_user WHERE id=uid AND role=expected AND status='active')
 THEN RAISE EXCEPTION 'Expected active % user',expected; END IF;
END $$;
CREATE OR REPLACE FUNCTION membership_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE student uuid;
BEGIN
 IF TG_OP='UPDATE' AND TG_TABLE_NAME<>'student_home_class' AND (to_jsonb(NEW)->>'status') IN ('revoked','departed','left') THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='guardian_link' THEN PERFORM require_user_role(NEW.parent_id,'parent'); PERFORM require_user_role(NEW.student_id,'student');
 ELSIF TG_TABLE_NAME='class_teacher' THEN PERFORM require_user_role(NEW.teacher_id,'teacher');
 ELSIF TG_TABLE_NAME='enrolment' THEN
  PERFORM require_user_role(NEW.student_id,'student');
  IF NEW.status='active' AND NOT EXISTS(SELECT 1 FROM classroom WHERE id=NEW.class_id AND status='active') THEN RAISE EXCEPTION 'Archived class'; END IF;
 ELSE
  SELECT student_id INTO student FROM enrolment WHERE id=NEW.enrolment_id AND status='active';
  IF student IS NULL THEN RAISE EXCEPTION 'Home class requires active enrolment'; END IF;
  PERFORM 1 FROM app_user WHERE id=student FOR UPDATE;
  IF EXISTS(SELECT 1 FROM student_home_class h JOIN enrolment e ON e.id=h.enrolment_id WHERE e.student_id=student AND h.id<>NEW.id)
  THEN RAISE EXCEPTION 'One home class per student'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION content_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE v uuid; row_data jsonb; item_key uuid; opt_key uuid; frozen text;
BEGIN
 row_data := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 IF TG_TABLE_NAME IN ('topic_revision','misconception_revision','hypothesis') THEN v:=(row_data->>'content_version_id')::uuid;
 ELSIF TG_TABLE_NAME IN ('topic_misconception','item') THEN SELECT content_version_id INTO v FROM topic_revision WHERE id=(row_data->>'topic_revision_id')::uuid;
 ELSIF TG_TABLE_NAME='misconception_source' THEN SELECT content_version_id INTO v FROM misconception_revision WHERE id=(row_data->>'misconception_revision_id')::uuid;
 ELSE
  IF TG_TABLE_NAME IN ('option_misconception','item_prediction') THEN
   opt_key:=(row_data->>'option_id')::uuid; SELECT item_id INTO item_key FROM item_option WHERE id=opt_key;
  ELSE item_key:=(row_data->>'item_id')::uuid; END IF;
  SELECT t.content_version_id INTO v FROM item i JOIN topic_revision t ON t.id=i.topic_revision_id WHERE i.id=item_key;
 END IF;
 SELECT status INTO frozen FROM content_version WHERE id=v FOR UPDATE;
 IF frozen='frozen' THEN RAISE EXCEPTION 'Frozen content version is immutable'; END IF;
 IF TG_TABLE_NAME='item' AND TG_OP<>'INSERT' THEN
  IF OLD.review_status='approved' THEN RAISE EXCEPTION 'Approved item is immutable; create a new revision'; END IF;
  IF EXISTS(SELECT 1 FROM item_approval WHERE item_id=OLD.id) AND NOT (TG_OP='UPDATE' AND OLD.review_status='in_review' AND NEW.review_status='approved' AND (to_jsonb(NEW)-'review_status')=(to_jsonb(OLD)-'review_status')) THEN RAISE EXCEPTION 'Approved draft content changed'; END IF;
  IF TG_OP='UPDATE' AND NEW.review_status='approved' AND NOT EXISTS(SELECT 1 FROM item_approval WHERE item_id=NEW.id) THEN RAISE EXCEPTION 'Recorded item approval required'; END IF;
 END IF;
 IF item_key IS NOT NULL AND (EXISTS(SELECT 1 FROM item WHERE id=item_key AND review_status='approved') OR EXISTS(SELECT 1 FROM item_approval WHERE item_id=item_key)) THEN RAISE EXCEPTION 'Approved item children are immutable'; END IF;
 IF item_key IS NOT NULL THEN PERFORM 1 FROM item WHERE id=item_key FOR UPDATE; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION item_approval_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
 PERFORM 1 FROM item WHERE id=NEW.item_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM app_user WHERE id=NEW.reviewer_id AND status='active' AND role IN ('teacher','admin')) OR NOT EXISTS(SELECT 1 FROM item i JOIN topic_revision t ON t.id=i.topic_revision_id JOIN content_version c ON c.id=t.content_version_id WHERE i.id=NEW.item_id AND i.review_status='in_review' AND c.status='draft') THEN RAISE EXCEPTION 'Item approval role/state'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION content_scope() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE a uuid; b uuid; c uuid; subj uuid;
BEGIN
 IF TG_TABLE_NAME='topic_revision' THEN
  SELECT subject_id INTO a FROM topic WHERE id=NEW.topic_id;
  SELECT subject_id INTO b FROM content_version WHERE id=NEW.content_version_id;
 ELSIF TG_TABLE_NAME='misconception_revision' THEN
  SELECT subject_id INTO a FROM misconception WHERE id=NEW.misconception_id;
  SELECT subject_id INTO b FROM content_version WHERE id=NEW.content_version_id;
 ELSIF TG_TABLE_NAME='topic_misconception' THEN
  SELECT content_version_id INTO a FROM topic_revision WHERE id=NEW.topic_revision_id;
  SELECT content_version_id INTO b FROM misconception_revision WHERE id=NEW.misconception_revision_id;
 ELSIF TG_TABLE_NAME='item' THEN
  SELECT content_version_id INTO a FROM topic_revision WHERE id=NEW.topic_revision_id;
  SELECT content_version_id INTO b FROM misconception_revision WHERE id=NEW.target_misconception_revision_id;
  IF EXISTS(SELECT 1 FROM item i JOIN topic_revision t ON t.id=i.topic_revision_id WHERE t.content_version_id=a AND i.external_id=NEW.external_id AND i.id<>NEW.id) THEN RAISE EXCEPTION 'Duplicate item external ID in pack'; END IF;
  IF NOT EXISTS(SELECT 1 FROM topic_misconception WHERE topic_revision_id=NEW.topic_revision_id AND misconception_revision_id=NEW.target_misconception_revision_id AND disposition='keep') THEN RAISE EXCEPTION 'Target outside topic'; END IF;
 ELSIF TG_TABLE_NAME='hypothesis' THEN
  IF NEW.misconception_revision_id IS NULL THEN RETURN NEW; END IF;
  a:=NEW.content_version_id; SELECT content_version_id INTO b FROM misconception_revision WHERE id=NEW.misconception_revision_id;
 ELSE
  IF TG_TABLE_NAME='option_misconception' THEN
   SELECT t.content_version_id INTO a FROM item_option o JOIN item i ON i.id=o.item_id JOIN topic_revision t ON t.id=i.topic_revision_id WHERE o.id=NEW.option_id;
   SELECT content_version_id INTO b FROM misconception_revision WHERE id=NEW.misconception_revision_id;
  ELSE
   SELECT t.content_version_id,o.item_id INTO a,c FROM item_option o JOIN item i ON i.id=o.item_id JOIN topic_revision t ON t.id=i.topic_revision_id WHERE o.id=NEW.option_id;
   SELECT content_version_id INTO b FROM hypothesis WHERE id=NEW.hypothesis_id;
   IF EXISTS(SELECT 1 FROM item_prediction p JOIN item_option o ON o.id=p.option_id WHERE o.item_id=c AND p.hypothesis_id=NEW.hypothesis_id AND p.id<>NEW.id) THEN RAISE EXCEPTION 'One prediction per item/hypothesis'; END IF;
  END IF;
 END IF;
 IF a IS NULL OR a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Content subject/version mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION item_integrity() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE k uuid; n integer; correct integer;
BEGIN
 IF TG_TABLE_NAME='item' THEN k:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
 ELSIF TG_TABLE_NAME='item_option' THEN k:=CASE WHEN TG_OP='DELETE' THEN OLD.item_id ELSE NEW.item_id END;
 ELSE SELECT item_id INTO k FROM item_option WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.option_id ELSE NEW.option_id END; END IF;
 IF NOT EXISTS(SELECT 1 FROM item WHERE id=k) THEN RETURN NULL; END IF;
 SELECT count(*),count(*) FILTER(WHERE is_correct) INTO n,correct FROM item_option WHERE item_id=k;
 IF n<>4 OR correct<>1 THEN RAISE EXCEPTION 'Item % needs four options and one correct option',k; END IF;
 IF EXISTS(SELECT 1 FROM item_option o JOIN option_misconception m ON m.option_id=o.id WHERE o.item_id=k GROUP BY o.id,o.is_correct HAVING count(*)>2 OR o.is_correct)
 THEN RAISE EXCEPTION 'Correct-option link or >2 misconceptions'; END IF;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION freeze_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Versions are retained'; END IF;
 IF OLD.status='frozen' THEN RAISE EXCEPTION 'Frozen version is immutable'; END IF;
 IF NEW.status='frozen' THEN
  IF NOT EXISTS(SELECT 1 FROM item i JOIN topic_revision t ON t.id=i.topic_revision_id WHERE t.content_version_id=NEW.id AND i.review_status='approved') THEN RAISE EXCEPTION 'No approved bank'; END IF;
  IF EXISTS(SELECT 1 FROM item i JOIN topic_revision t ON t.id=i.topic_revision_id WHERE t.content_version_id=NEW.id AND i.review_status NOT IN ('approved','rejected')) THEN RAISE EXCEPTION 'Unreviewed items in pack'; END IF;
  IF (SELECT count(*) FROM hypothesis WHERE content_version_id=NEW.id AND kind IN ('none','unmodelled'))<>2 THEN RAISE EXCEPTION 'Missing special hypotheses'; END IF;
  IF EXISTS(SELECT 1 FROM item i JOIN topic_revision t ON t.id=i.topic_revision_id JOIN misconception_revision m ON m.id=i.target_misconception_revision_id WHERE t.content_version_id=NEW.id AND i.review_status='approved' AND (m.status<>'validated' OR m.engine_tier<>1)) THEN RAISE EXCEPTION 'Approved target must be engine-ready'; END IF;
  IF EXISTS(SELECT 1 FROM hypothesis h JOIN misconception_revision m ON m.id=h.misconception_revision_id WHERE h.content_version_id=NEW.id AND (m.status<>'validated' OR m.engine_tier<>1)) THEN RAISE EXCEPTION 'Catalogue-only hypothesis in engine pack'; END IF;
  IF EXISTS(SELECT 1 FROM item_prediction p JOIN hypothesis h ON h.id=p.hypothesis_id JOIN item_option o ON o.id=p.option_id WHERE h.content_version_id=NEW.id AND ((h.kind='none' AND NOT o.is_correct) OR (h.kind='misconception' AND NOT o.is_correct AND NOT EXISTS(SELECT 1 FROM option_misconception om WHERE om.option_id=o.id AND om.misconception_revision_id=h.misconception_revision_id)))) THEN RAISE EXCEPTION 'Prediction contradicts correct/NONE or distractor attribution'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION response_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE v uuid; a uuid; b uuid; r uuid;
BEGIN
 IF TG_TABLE_NAME='response_model' THEN
  IF TG_OP='DELETE' OR OLD.status='frozen' THEN RAISE EXCEPTION 'Response model retained/immutable'; END IF;
  IF NEW.status='frozen' THEN
   IF NOT EXISTS(SELECT 1 FROM content_version WHERE id=NEW.content_version_id AND status='frozen') THEN RAISE EXCEPTION 'Freeze content first'; END IF;
   IF EXISTS(SELECT 1 FROM response_probability p JOIN item_option o ON o.id=p.option_id WHERE p.response_model_id=NEW.id GROUP BY o.item_id,p.hypothesis_id HAVING count(*)<>4 OR abs(sum(p.probability)-1)>0.000000001) THEN RAISE EXCEPTION 'Invalid option distribution'; END IF;
   IF EXISTS(SELECT 1 FROM item i JOIN topic_revision t ON t.id=i.topic_revision_id CROSS JOIN hypothesis h WHERE t.content_version_id=NEW.content_version_id AND h.content_version_id=NEW.content_version_id AND i.review_status='approved' AND NOT EXISTS(SELECT 1 FROM response_probability p JOIN item_option o ON o.id=p.option_id WHERE p.response_model_id=NEW.id AND o.item_id=i.id AND p.hypothesis_id=h.id)) THEN RAISE EXCEPTION 'Incomplete response model'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 r:=CASE WHEN TG_OP='DELETE' THEN OLD.response_model_id ELSE NEW.response_model_id END;
 SELECT content_version_id INTO v FROM response_model WHERE id=r AND status='draft' FOR SHARE;
 IF v IS NULL THEN RAISE EXCEPTION 'Frozen/missing response model'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 SELECT content_version_id INTO a FROM hypothesis WHERE id=NEW.hypothesis_id;
 IF a IS DISTINCT FROM v THEN RAISE EXCEPTION 'Response hypothesis scope'; END IF;
 IF TG_TABLE_NAME='response_probability' THEN
  SELECT t.content_version_id INTO a FROM item_option o JOIN item i ON i.id=o.item_id JOIN topic_revision t ON t.id=i.topic_revision_id WHERE o.id=NEW.option_id;
  IF a IS DISTINCT FROM v THEN RAISE EXCEPTION 'Response option scope'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION session_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE s diagnostic_session; q session_question; v uuid; a uuid; e enrolment; sub uuid;
BEGIN
 IF TG_TABLE_NAME='diagnostic_session' THEN
  IF TG_OP='UPDATE' AND OLD.status<>'in_progress' THEN RAISE EXCEPTION 'Terminal session immutable'; END IF;
  SELECT * INTO e FROM enrolment WHERE id=NEW.enrolment_id;
  SELECT r.content_version_id,c.subject_id INTO v,sub FROM response_model r JOIN content_version c ON c.id=r.content_version_id WHERE r.id=NEW.response_model_id AND r.status='frozen';
  IF v IS NULL THEN RAISE EXCEPTION 'Session requires frozen model'; END IF;
  IF TG_OP='INSERT' THEN
   PERFORM require_user_role(e.student_id,'student');
   IF e.status<>'active' OR NOT EXISTS(SELECT 1 FROM classroom WHERE id=e.class_id AND status='active') OR NOT EXISTS(SELECT 1 FROM class_subject WHERE class_id=e.class_id AND subject_id=sub) THEN RAISE EXCEPTION 'Invalid class session context'; END IF;
  END IF;
  IF NEW.topic_revision_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM topic_revision WHERE id=NEW.topic_revision_id AND content_version_id=v) THEN RAISE EXCEPTION 'Session topic scope'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO s FROM diagnostic_session WHERE id=NEW.session_id FOR UPDATE;
 SELECT content_version_id INTO v FROM response_model WHERE id=s.response_model_id;
 IF TG_TABLE_NAME='session_question' THEN
  IF s.status<>'in_progress' OR NEW.step_index<>(SELECT count(*) FROM session_step WHERE session_id=s.id) OR NEW.step_index>=s.question_budget THEN RAISE EXCEPTION 'Invalid next question'; END IF;
  IF EXISTS(SELECT 1 FROM session_question q0 WHERE q0.session_id=s.id AND NOT EXISTS(SELECT 1 FROM session_step t WHERE t.session_question_id=q0.id)) THEN RAISE EXCEPTION 'Already awaiting an answer'; END IF;
  IF NOT EXISTS(SELECT 1 FROM item i JOIN topic_revision t ON t.id=i.topic_revision_id WHERE i.id=NEW.item_id AND t.content_version_id=v AND i.review_status='approved' AND (s.topic_revision_id IS NULL OR i.topic_revision_id=s.topic_revision_id)) THEN RAISE EXCEPTION 'Question outside frozen session scope'; END IF;
 ELSIF TG_TABLE_NAME='session_step' THEN
  SELECT * INTO q FROM session_question WHERE id=NEW.session_question_id;
  SELECT item_id INTO a FROM item_option WHERE id=NEW.answer_option_id;
  IF s.status<>'in_progress' OR q.session_id IS DISTINCT FROM s.id OR q.step_index IS DISTINCT FROM NEW.step_index OR a IS DISTINCT FROM q.item_id OR NEW.step_index<>(SELECT count(*) FROM session_step WHERE session_id=s.id) OR NEW.answered_at<q.presented_at THEN RAISE EXCEPTION 'Invalid step/answer'; END IF;
 ELSIF TG_TABLE_NAME='session_hypothesis' THEN
  IF s.status<>'in_progress' OR EXISTS(SELECT 1 FROM session_question WHERE session_id=s.id) OR NOT EXISTS(SELECT 1 FROM hypothesis WHERE id=NEW.hypothesis_id AND content_version_id=v) THEN RAISE EXCEPTION 'Invalid session hypothesis'; END IF;
 ELSIF TG_TABLE_NAME='diagnosis' THEN
  IF s.status<>'diagnosed' THEN RAISE EXCEPTION 'Diagnosis without diagnosed outcome'; END IF;
 ELSIF TG_TABLE_NAME='escalation' THEN
  IF s.status NOT LIKE 'escalated_%' THEN RAISE EXCEPTION 'Escalation without refusal'; END IF;
 ELSIF TG_TABLE_NAME='teacher_review' THEN
  PERFORM require_user_role(NEW.teacher_id,'teacher');
  IF s.status IN ('in_progress','abandoned') THEN RAISE EXCEPTION 'Session not reviewable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM enrolment en JOIN class_teacher ct ON ct.class_id=en.class_id WHERE en.id=s.enrolment_id AND ct.teacher_id=NEW.teacher_id AND ct.status='active') THEN RAISE EXCEPTION 'Teacher outside session class'; END IF;
  IF NEW.revision<>(SELECT count(*)+1 FROM teacher_review WHERE session_id=s.id) THEN RAISE EXCEPTION 'Review revision order'; END IF;
  IF NEW.misconception_revision_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM misconception_revision WHERE id=NEW.misconception_revision_id AND content_version_id=v AND status='validated') THEN RAISE EXCEPTION 'Review conclusion outside pack'; END IF;
  IF NEW.decision='approved' AND (s.status NOT IN ('diagnosed','none_detected') OR (s.status='none_detected' AND NEW.conclusion<>'none_detected') OR (s.status='diagnosed' AND NOT EXISTS(SELECT 1 FROM diagnosis d JOIN diagnosis_candidate dc ON dc.diagnosis_id=d.id JOIN session_hypothesis sh ON sh.id=dc.session_hypothesis_id JOIN hypothesis h ON h.id=sh.hypothesis_id WHERE d.session_id=s.id AND dc.rank=1 AND h.misconception_revision_id=NEW.misconception_revision_id))) THEN RAISE EXCEPTION 'Approval must match engine conclusion'; END IF;
  IF NEW.decision='resolved' AND s.status NOT LIKE 'escalated_%' THEN RAISE EXCEPTION 'Manual resolution requires escalation'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION evidence_scope() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE a uuid; b uuid;
BEGIN
 IF TG_TABLE_NAME='step_posterior' THEN SELECT session_id INTO a FROM session_step WHERE id=NEW.step_id;
 ELSIF TG_TABLE_NAME='diagnosis_candidate' THEN SELECT session_id INTO a FROM diagnosis WHERE id=NEW.diagnosis_id;
 ELSE SELECT session_id INTO a FROM escalation WHERE id=NEW.escalation_id; END IF;
 SELECT session_id INTO b FROM session_hypothesis WHERE id=NEW.session_hypothesis_id;
 IF a IS NULL OR a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Evidence from another session'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION trace_complete() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE sid uuid; st diagnostic_session; n integer; p numeric; stepkey uuid; hcount integer;
BEGIN
 IF TG_TABLE_NAME='diagnostic_session' THEN sid:=NEW.id;
 ELSIF TG_TABLE_NAME IN ('session_question','session_step','session_hypothesis') THEN sid:=NEW.session_id;
 ELSIF TG_TABLE_NAME='step_posterior' THEN SELECT session_id INTO sid FROM session_step WHERE id=NEW.step_id;
 ELSIF TG_TABLE_NAME IN ('diagnosis','escalation') THEN sid:=NEW.session_id;
 ELSIF TG_TABLE_NAME='diagnosis_candidate' THEN SELECT d.session_id INTO sid FROM diagnosis d WHERE d.id=NEW.diagnosis_id;
 ELSE SELECT e.session_id INTO sid FROM escalation e WHERE e.id=NEW.escalation_id; END IF;
 SELECT * INTO st FROM diagnostic_session WHERE id=sid;
 IF EXISTS(SELECT 1 FROM session_question WHERE session_id=sid) THEN
  SELECT count(*),sum(prior_probability) INTO hcount,p FROM session_hypothesis WHERE session_id=sid;
  IF hcount<2 OR abs(coalesce(p,0)-1)>0.000000001 THEN RAISE EXCEPTION 'Invalid session prior'; END IF;
  IF (SELECT count(*) FROM session_hypothesis sh JOIN hypothesis h ON h.id=sh.hypothesis_id WHERE sh.session_id=sid AND h.kind IN ('none','unmodelled'))<>2 THEN RAISE EXCEPTION 'Session missing special hypotheses'; END IF;
  FOR stepkey IN SELECT id FROM session_step WHERE session_id=sid LOOP
   SELECT count(*),sum(probability) INTO n,p FROM step_posterior WHERE step_id=stepkey;
   IF n<>hcount OR abs(coalesce(p,0)-1)>0.000000001 THEN RAISE EXCEPTION 'Incomplete/non-normalized posterior'; END IF;
  END LOOP;
 END IF;
 IF st.status='diagnosed' AND (NOT EXISTS(SELECT 1 FROM diagnosis WHERE session_id=sid) OR NOT EXISTS(SELECT 1 FROM diagnosis d JOIN diagnosis_candidate c ON c.diagnosis_id=d.id JOIN session_hypothesis sh ON sh.id=c.session_hypothesis_id JOIN hypothesis h ON h.id=sh.hypothesis_id WHERE d.session_id=sid AND c.rank=1 AND h.kind='misconception')) THEN RAISE EXCEPTION 'Missing ranked diagnosis'; END IF;
 IF st.status LIKE 'escalated_%' AND NOT EXISTS(SELECT 1 FROM escalation WHERE session_id=sid) THEN RAISE EXCEPTION 'Missing escalation'; END IF;
 IF st.status NOT IN ('in_progress','abandoned') AND EXISTS(SELECT 1 FROM session_question q WHERE q.session_id=sid AND NOT EXISTS(SELECT 1 FROM session_step t WHERE t.session_question_id=q.id)) THEN RAISE EXCEPTION 'Terminal session has unanswered presentation'; END IF;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION record_audit() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE r jsonb; actor uuid;
BEGIN
 r:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 actor:=nullif(current_setting('sonder.actor_id',true),'')::uuid;
 INSERT INTO audit_event(actor_id,event_type,relation_name,row_id,request_key,detail)
 VALUES(actor,CASE WHEN TG_TABLE_NAME='content_version' AND TG_OP='UPDATE' AND r->>'status'='frozen' THEN 'content_frozen' ELSE TG_OP END,TG_TABLE_NAME,(r->>'id')::uuid,nullif(current_setting('sonder.request_key',true),''),'{}'::jsonb);
 -- Never copy passwords, tokens, names or complete transcripts into an audit payload.
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['guardian_link','class_teacher','enrolment','student_home_class'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER membership_check BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION membership_guard()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['topic_revision','misconception_revision','topic_misconception','item','item_option','option_misconception','item_numeric_parameter','item_source','misconception_source','hypothesis','item_prediction'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER a_content_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION content_guard()',t);
  EXECUTE format('CREATE OR REPLACE TRIGGER b_fixed_keys BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fixed_keys(%L,%L,%L,%L,%L,%L,%L,%L)',t,'id','content_version_id','item_id','option_id','topic_revision_id','misconception_revision_id','topic_id','misconception_id');
 END LOOP;
 FOREACH t IN ARRAY ARRAY['topic_revision','misconception_revision','topic_misconception','item','hypothesis','option_misconception','item_prediction'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER c_scope BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION content_scope()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['item','item_option','option_misconception'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=format('sonder.%I',t)::regclass AND tgname='item_cardinality') THEN
   EXECUTE format('CREATE CONSTRAINT TRIGGER item_cardinality AFTER INSERT OR UPDATE OR DELETE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION item_integrity()',t);
  END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['subject','topic','misconception','source_reference','engine_release','item_approval','session_question','session_step','session_hypothesis','step_posterior','diagnosis','diagnosis_candidate','escalation','escalation_candidate','teacher_review','audit_event'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_mutation()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['diagnostic_session','session_question','session_step','session_hypothesis','diagnosis','escalation','teacher_review'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER scope_check BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION session_guard()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['step_posterior','diagnosis_candidate','escalation_candidate'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER scope_check BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION evidence_scope()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['response_parameter','response_probability'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER response_check BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION response_guard()',t);
  EXECUTE format('CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fixed_keys(%L,%L,%L,%L,%L)',t,'id','response_model_id','item_id','hypothesis_id','option_id');
 END LOOP;
 FOREACH t IN ARRAY ARRAY['diagnostic_session','session_question','session_step','session_hypothesis','step_posterior','diagnosis','diagnosis_candidate','escalation','escalation_candidate'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=format('sonder.%I',t)::regclass AND tgname='trace_complete') THEN
   EXECUTE format('CREATE CONSTRAINT TRIGGER trace_complete AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION trace_complete()',t);
  END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['app_user','guardian_link','classroom','class_teacher','enrolment','content_version','item','item_option','option_misconception','item_approval','response_model','diagnostic_session','teacher_review','privacy_request'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION record_audit()',t);
 END LOOP;
END $$;
CREATE OR REPLACE TRIGGER frozen BEFORE UPDATE OR DELETE ON content_version FOR EACH ROW EXECUTE FUNCTION freeze_guard();
CREATE OR REPLACE TRIGGER approval_scope BEFORE INSERT ON item_approval FOR EACH ROW EXECUTE FUNCTION item_approval_guard();
CREATE OR REPLACE TRIGGER frozen BEFORE UPDATE OR DELETE ON response_model FOR EACH ROW EXECUTE FUNCTION response_guard();
CREATE OR REPLACE TRIGGER session_scope BEFORE UPDATE ON diagnostic_session FOR EACH ROW EXECUTE FUNCTION session_guard();
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON diagnostic_session FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','enrolment_id','response_model_id','engine_release_id','topic_revision_id','question_budget','request_key','started_at');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON guardian_link FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','parent_id','student_id','linked_at');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON class_teacher FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','class_id','teacher_id','assigned_at');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON enrolment FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','class_id','student_id','joined_at');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON response_model FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','content_version_id','model_code','source','calibration_note','created_at');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON content_version FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','subject_id','version_code','created_at');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON app_user FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','role');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON app_user FOR EACH ROW EXECUTE FUNCTION state_guard('status','active','active>deactivated,deactivated>active,active>withdrawn,deactivated>withdrawn');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON guardian_link FOR EACH ROW EXECUTE FUNCTION state_guard('status','active','active>revoked,revoked>active');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON classroom FOR EACH ROW EXECUTE FUNCTION state_guard('status','active','active>archived,archived>active');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON class_teacher FOR EACH ROW EXECUTE FUNCTION state_guard('status','active','active>departed,departed>active');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON enrolment FOR EACH ROW EXECUTE FUNCTION state_guard('status','active','active>left,left>active');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON content_version FOR EACH ROW EXECUTE FUNCTION state_guard('status','draft','draft>frozen');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON misconception_revision FOR EACH ROW EXECUTE FUNCTION state_guard('status','pending,catalogued_only','pending>validated,pending>catalogued_only,catalogued_only>pending,validated>retired,pending>retired,catalogued_only>retired');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON item FOR EACH ROW EXECUTE FUNCTION state_guard('review_status','draft','draft>in_review,in_review>approved,in_review>rejected,rejected>draft');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON response_model FOR EACH ROW EXECUTE FUNCTION state_guard('status','draft','draft>frozen');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON diagnostic_session FOR EACH ROW EXECUTE FUNCTION state_guard('status','in_progress','in_progress>diagnosed,in_progress>none_detected,in_progress>escalated_no_separator,in_progress>escalated_exhausted,in_progress>escalated_unmodelled,in_progress>abandoned');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON privacy_request FOR EACH ROW EXECUTE FUNCTION state_guard('status','requested','requested>processing,processing>completed,processing>failed,failed>processing');

CREATE INDEX IF NOT EXISTS auth_session_user_idx ON auth_session(user_id,expires_at);
CREATE INDEX IF NOT EXISTS auth_token_user_idx ON auth_token(user_id,expires_at);
CREATE INDEX IF NOT EXISTS guardian_student_idx ON guardian_link(student_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS teacher_classes_idx ON class_teacher(teacher_id,class_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS student_classes_idx ON enrolment(student_id,class_id);
CREATE INDEX IF NOT EXISTS misconception_catalogue_idx ON misconception_revision(content_version_id,status);
CREATE INDEX IF NOT EXISTS item_topic_idx ON item(topic_revision_id,review_status);
CREATE INDEX IF NOT EXISTS item_target_idx ON item(target_misconception_revision_id,review_status);
CREATE INDEX IF NOT EXISTS option_mapping_reverse_idx ON option_misconception(misconception_revision_id,option_id);
CREATE INDEX IF NOT EXISTS session_roster_idx ON diagnostic_session(enrolment_id,started_at DESC);
CREATE INDEX IF NOT EXISTS session_queue_idx ON diagnostic_session(status,started_at) WHERE status<>'in_progress';
CREATE INDEX IF NOT EXISTS audit_time_idx ON audit_event(occurred_at,event_type);
CREATE INDEX IF NOT EXISTS privacy_work_idx ON privacy_request(status,requested_at);
REVOKE ALL ON ALL TABLES IN SCHEMA sonder FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sonder FROM PUBLIC;
COMMIT;
