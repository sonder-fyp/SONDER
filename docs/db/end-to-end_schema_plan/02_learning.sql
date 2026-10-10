BEGIN;
SET LOCAL search_path = sonder, public;
CREATE TABLE IF NOT EXISTS study_note (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0), what_was_going_on text NOT NULL, how_to_think text NOT NULL,
 example_prompt text NOT NULL, wrong_move text NOT NULL, right_move text NOT NULL, example_answer text NOT NULL,
 origin text NOT NULL CHECK(origin IN ('authored','generated')), UNIQUE(misconception_revision_id,revision)
);
CREATE TABLE IF NOT EXISTS study_note_approval (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), study_note_id uuid NOT NULL UNIQUE REFERENCES study_note ON DELETE RESTRICT,
 teacher_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT, approved_at timestamptz NOT NULL DEFAULT now(), note text NOT NULL
);
CREATE TABLE IF NOT EXISTS intervention (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0), script text NOT NULL, worked_example text NOT NULL,
 UNIQUE(misconception_revision_id,revision)
);
CREATE TABLE IF NOT EXISTS intervention_approval (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), intervention_id uuid NOT NULL UNIQUE REFERENCES intervention ON DELETE RESTRICT,
 teacher_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT, approved_at timestamptz NOT NULL DEFAULT now(), note text NOT NULL
);
CREATE TABLE IF NOT EXISTS resource (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), url text NOT NULL UNIQUE CHECK(url ~ '^https?://'),
 title text NOT NULL, kind text NOT NULL CHECK(kind IN ('video','article','interactive')), source text NOT NULL
);
CREATE TABLE IF NOT EXISTS resource_recommendation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resource_id uuid NOT NULL REFERENCES resource ON DELETE RESTRICT,
 misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0), rationale text NOT NULL, relevance numeric NOT NULL CHECK(relevance BETWEEN 0 AND 1),
 origin text NOT NULL CHECK(origin IN ('curated','found')), UNIQUE(resource_id,misconception_revision_id,revision)
);
CREATE TABLE IF NOT EXISTS resource_approval (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recommendation_id uuid NOT NULL UNIQUE REFERENCES resource_recommendation ON DELETE RESTRICT,
 teacher_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT, approved_at timestamptz NOT NULL DEFAULT now(), note text NOT NULL
);
CREATE TABLE IF NOT EXISTS concept_doc (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), topic_revision_id uuid NOT NULL REFERENCES topic_revision ON DELETE RESTRICT,
 document_key text NOT NULL, revision integer NOT NULL CHECK(revision>0), title text NOT NULL, body text NOT NULL,
 doc_type text NOT NULL CHECK(doc_type IN ('explanation','worked_example','analogy','common_error')),
 UNIQUE(topic_revision_id,document_key,revision)
);
CREATE TABLE IF NOT EXISTS concept_doc_misconception (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), concept_doc_id uuid NOT NULL REFERENCES concept_doc ON DELETE RESTRICT,
 misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 UNIQUE(concept_doc_id,misconception_revision_id)
);
CREATE TABLE IF NOT EXISTS concept_doc_chunk (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), concept_doc_id uuid NOT NULL REFERENCES concept_doc ON DELETE RESTRICT,
 chunk_index integer NOT NULL CHECK(chunk_index>=0), chunk_text text NOT NULL,
 UNIQUE(concept_doc_id,chunk_index)
);
CREATE TABLE IF NOT EXISTS concept_doc_approval (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), concept_doc_id uuid NOT NULL UNIQUE REFERENCES concept_doc ON DELETE RESTRICT,
 teacher_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT, approved_at timestamptz NOT NULL DEFAULT now(), note text NOT NULL
);
CREATE TABLE IF NOT EXISTS remediation_delivery (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid NOT NULL UNIQUE REFERENCES teacher_review ON DELETE RESTRICT,
 intervention_id uuid NOT NULL REFERENCES intervention ON DELETE RESTRICT,
 study_note_id uuid REFERENCES study_note ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'delivered' CHECK(status IN ('delivered','read','completed','superseded')),
 delivered_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz, completed_at timestamptz,
 CHECK(read_at IS NULL OR read_at>=delivered_at), CHECK(completed_at IS NULL OR (read_at IS NOT NULL AND completed_at>=read_at)),
 CHECK(status NOT IN ('read','completed') OR read_at IS NOT NULL), CHECK(status<>'completed' OR completed_at IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS remediation_resource (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), delivery_id uuid NOT NULL REFERENCES remediation_delivery ON DELETE RESTRICT,
 recommendation_id uuid NOT NULL REFERENCES resource_recommendation ON DELETE RESTRICT, UNIQUE(delivery_id,recommendation_id)
);
CREATE TABLE IF NOT EXISTS verification_check (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), delivery_id uuid NOT NULL REFERENCES remediation_delivery ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('immediate','delayed')), scheduled_for timestamptz NOT NULL,
 UNIQUE(delivery_id,kind)
);
CREATE TABLE IF NOT EXISTS verification_presentation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), check_id uuid NOT NULL UNIQUE REFERENCES verification_check ON DELETE RESTRICT,
 item_id uuid NOT NULL REFERENCES item ON DELETE RESTRICT, presented_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS verification_result (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), presentation_id uuid NOT NULL UNIQUE REFERENCES verification_presentation ON DELETE RESTRICT,
 answer_option_id uuid NOT NULL REFERENCES item_option ON DELETE RESTRICT, taken_at timestamptz NOT NULL DEFAULT now(),
 result text NOT NULL CHECK(result IN ('resolved','persistent','uncertain'))
);
CREATE TABLE IF NOT EXISTS verification_cancellation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), check_id uuid NOT NULL UNIQUE REFERENCES verification_check ON DELETE RESTRICT,
 cancelled_at timestamptz NOT NULL DEFAULT now(), reason text NOT NULL
);
CREATE TABLE IF NOT EXISTS parent_summary (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid NOT NULL REFERENCES teacher_review ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0), what_we_found text NOT NULL,
 what_to_work_on text NOT NULL, hows_it_going text NOT NULL,
 origin text NOT NULL CHECK(origin IN ('structured','generated')),
 similarity_score numeric CHECK(similarity_score BETWEEN -1 AND 1), similarity_floor numeric CHECK(similarity_floor BETWEEN -1 AND 1),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(review_id,revision),
 CHECK(origin<>'generated' OR (similarity_score IS NOT NULL AND similarity_floor IS NOT NULL AND similarity_score>=similarity_floor))
);
CREATE TABLE IF NOT EXISTS parent_summary_approval (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), summary_id uuid NOT NULL UNIQUE REFERENCES parent_summary ON DELETE RESTRICT,
 teacher_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT, approved_at timestamptz NOT NULL DEFAULT now(), note text NOT NULL
);

CREATE OR REPLACE FUNCTION latest_review(r uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, sonder AS $$
 SELECT NOT EXISTS(SELECT 1 FROM teacher_review newer JOIN teacher_review current ON current.session_id=newer.session_id WHERE current.id=r AND newer.revision>current.revision)
$$;
CREATE OR REPLACE FUNCTION learning_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE r teacher_review; d remediation_delivery; s diagnostic_session; m uuid; other uuid; pack uuid; child uuid; checkkey uuid; itemkey uuid; presentedtime timestamptz; appointment verification_check;
BEGIN
 IF TG_TABLE_NAME='concept_doc_approval' OR TG_TABLE_NAME IN ('concept_doc_chunk','concept_doc_misconception') THEN PERFORM 1 FROM concept_doc WHERE id=NEW.concept_doc_id FOR UPDATE; END IF;
 IF TG_TABLE_NAME LIKE '%_approval' THEN
  PERFORM require_user_role(NEW.teacher_id,'teacher');
  IF TG_TABLE_NAME='parent_summary_approval' THEN
   SELECT tr.* INTO r FROM parent_summary ps JOIN teacher_review tr ON tr.id=ps.review_id WHERE ps.id=NEW.summary_id;
   SELECT ds.* INTO s FROM diagnostic_session ds WHERE ds.id=r.session_id;
   IF r.decision='rejected' OR NOT latest_review(r.id) OR NOT EXISTS(SELECT 1 FROM enrolment e JOIN class_teacher ct ON ct.class_id=e.class_id WHERE e.id=s.enrolment_id AND ct.teacher_id=NEW.teacher_id AND ct.status='active') THEN RAISE EXCEPTION 'Summary approval outside active review/class'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='concept_doc_misconception' THEN
  IF EXISTS(SELECT 1 FROM concept_doc_approval WHERE concept_doc_id=NEW.concept_doc_id) THEN RAISE EXCEPTION 'Approved document scope immutable'; END IF;
  SELECT t.content_version_id INTO pack FROM concept_doc c JOIN topic_revision t ON t.id=c.topic_revision_id WHERE c.id=NEW.concept_doc_id;
  IF NOT EXISTS(SELECT 1 FROM misconception_revision WHERE id=NEW.misconception_revision_id AND content_version_id=pack) THEN RAISE EXCEPTION 'Doc scope mismatch'; END IF;
  RETURN NEW;
 ELSIF TG_TABLE_NAME='concept_doc_chunk' THEN
  IF EXISTS(SELECT 1 FROM concept_doc_approval WHERE concept_doc_id=NEW.concept_doc_id) THEN RAISE EXCEPTION 'Approved chunks immutable'; END IF;
  RETURN NEW;
 ELSIF TG_TABLE_NAME='parent_summary' THEN
  SELECT * INTO r FROM teacher_review WHERE id=NEW.review_id;
  IF r.decision='rejected' OR NOT latest_review(r.id) THEN RAISE EXCEPTION 'Summary needs current accepted review'; END IF;
  RETURN NEW;
 ELSIF TG_TABLE_NAME='remediation_resource' THEN
  SELECT tr.* INTO r FROM remediation_delivery rd JOIN teacher_review tr ON tr.id=rd.review_id WHERE rd.id=NEW.delivery_id;
  IF NOT latest_review(r.id) OR NOT EXISTS(SELECT 1 FROM resource_recommendation rr JOIN resource_approval ra ON ra.recommendation_id=rr.id WHERE rr.id=NEW.recommendation_id AND rr.misconception_revision_id=r.misconception_revision_id) THEN RAISE EXCEPTION 'Unapproved/mismatched resource'; END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='remediation_delivery' THEN
  SELECT * INTO r FROM teacher_review WHERE id=NEW.review_id;
  IF NEW.status<>'superseded' AND (NOT latest_review(r.id) OR r.conclusion IS DISTINCT FROM 'misconception' OR r.decision='rejected') THEN RAISE EXCEPTION 'Delivery needs current approved diagnosis'; END IF;
  SELECT misconception_revision_id INTO m FROM intervention WHERE id=NEW.intervention_id;
  IF m IS DISTINCT FROM r.misconception_revision_id OR NOT EXISTS(SELECT 1 FROM intervention_approval WHERE intervention_id=NEW.intervention_id) THEN RAISE EXCEPTION 'Intervention unapproved/mismatched'; END IF;
  IF NEW.study_note_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM study_note n JOIN study_note_approval a ON a.study_note_id=n.id WHERE n.id=NEW.study_note_id AND n.misconception_revision_id=m) THEN RAISE EXCEPTION 'Note unapproved/mismatched'; END IF;
  IF TG_OP='UPDATE' THEN
   IF OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at THEN RAISE EXCEPTION 'Read timestamp immutable'; END IF;
   IF OLD.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN RAISE EXCEPTION 'Completion timestamp immutable'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='verification_check' THEN
  SELECT * INTO d FROM remediation_delivery WHERE id=NEW.delivery_id FOR UPDATE;
 ELSE
  IF TG_TABLE_NAME='verification_result' THEN
   SELECT vp.check_id,vp.item_id,vp.presented_at INTO checkkey,itemkey,presentedtime FROM verification_presentation vp WHERE vp.id=NEW.presentation_id;
  ELSE checkkey:=NEW.check_id; END IF;
  SELECT * INTO appointment FROM verification_check WHERE id=checkkey FOR UPDATE;
  SELECT * INTO d FROM remediation_delivery WHERE id=appointment.delivery_id FOR UPDATE;
 END IF;
 SELECT * INTO r FROM teacher_review WHERE id=d.review_id;
 SELECT * INTO s FROM diagnostic_session WHERE id=r.session_id;
 IF TG_TABLE_NAME='verification_cancellation' THEN
  IF EXISTS(SELECT 1 FROM verification_presentation vp JOIN verification_result vr ON vr.presentation_id=vp.id WHERE vp.check_id=checkkey) THEN RAISE EXCEPTION 'Cannot cancel completed check'; END IF;
  RETURN NEW;
 END IF;
 IF d.status<>'completed' OR NOT latest_review(r.id) THEN RAISE EXCEPTION 'Complete current remediation first'; END IF;
 IF TG_TABLE_NAME='verification_check' THEN
  IF NEW.kind='delayed' AND (NEW.scheduled_for<d.completed_at+interval '336 hours' OR NEW.scheduled_for>d.completed_at+interval '504 hours') THEN RAISE EXCEPTION 'Delayed check must be 14-21 elapsed days after completion'; END IF;
  IF NEW.kind='immediate' AND NEW.scheduled_for<d.completed_at THEN RAISE EXCEPTION 'Immediate check before completion'; END IF;
  RETURN NEW;
 END IF;
 IF EXISTS(SELECT 1 FROM verification_cancellation WHERE check_id=checkkey) THEN RAISE EXCEPTION 'Check cancelled'; END IF;
 IF TG_TABLE_NAME='verification_result' THEN
  IF NEW.taken_at<presentedtime OR NOT EXISTS(SELECT 1 FROM item_option WHERE id=NEW.answer_option_id AND item_id=itemkey) THEN RAISE EXCEPTION 'Invalid verification answer/time'; END IF;
  RETURN NEW;
 END IF;
 SELECT rm.content_version_id INTO pack FROM response_model rm WHERE rm.id=s.response_model_id;
 IF NEW.presented_at<appointment.scheduled_for THEN RAISE EXCEPTION 'Check not due'; END IF;
 IF NOT EXISTS(SELECT 1 FROM item i JOIN topic_revision t ON t.id=i.topic_revision_id WHERE i.id=NEW.item_id AND t.content_version_id=pack AND i.review_status='approved' AND i.target_misconception_revision_id=r.misconception_revision_id) THEN RAISE EXCEPTION 'Verification item scope'; END IF;
 IF EXISTS(SELECT 1 FROM session_question q JOIN item original ON original.id=q.item_id JOIN item fresh ON fresh.id=NEW.item_id WHERE q.session_id=s.id AND original.external_id=fresh.external_id)
 OR EXISTS(SELECT 1 FROM verification_presentation vp JOIN verification_check vc ON vc.id=vp.check_id WHERE vc.delivery_id=d.id AND vp.item_id=NEW.item_id)
 THEN RAISE EXCEPTION 'Verification reuses previously presented item'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION schedule_verification() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
 IF NEW.status='completed' AND OLD.status<>'completed' THEN
  INSERT INTO verification_check(delivery_id,kind,scheduled_for)
  VALUES(NEW.id,'immediate',NEW.completed_at),(NEW.id,'delayed',NEW.completed_at+interval '432 hours');
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['study_note','study_note_approval','intervention','intervention_approval','resource','resource_recommendation','resource_approval','concept_doc','concept_doc_misconception','concept_doc_chunk','concept_doc_approval','remediation_resource','parent_summary','parent_summary_approval','verification_check','verification_presentation','verification_result','verification_cancellation'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_mutation()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['study_note_approval','intervention_approval','resource_approval','concept_doc_approval','parent_summary_approval','parent_summary','concept_doc_misconception','concept_doc_chunk','remediation_resource','remediation_delivery','verification_check','verification_presentation','verification_result','verification_cancellation'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER scope_check BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION learning_guard()',t);
 END LOOP;
END $$;
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON remediation_delivery FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','review_id','intervention_id','study_note_id','delivered_at');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON remediation_delivery FOR EACH ROW EXECUTE FUNCTION state_guard('status','delivered','delivered>read,read>completed,delivered>superseded,read>superseded,completed>superseded');
CREATE OR REPLACE TRIGGER schedule_checks AFTER UPDATE ON remediation_delivery FOR EACH ROW EXECUTE FUNCTION schedule_verification();
CREATE OR REPLACE VIEW approved_parent_summary AS
 SELECT ps.*,tr.session_id,e.student_id,a.teacher_id AS approved_by,a.approved_at
 FROM parent_summary ps JOIN parent_summary_approval a ON a.summary_id=ps.id
 JOIN teacher_review tr ON tr.id=ps.review_id JOIN diagnostic_session ds ON ds.id=tr.session_id
 JOIN enrolment e ON e.id=ds.enrolment_id
 WHERE tr.decision IN ('approved','corrected','resolved') AND latest_review(tr.id)
 AND NOT EXISTS(SELECT 1 FROM parent_summary newer JOIN parent_summary_approval na ON na.summary_id=newer.id WHERE newer.review_id=ps.review_id AND newer.revision>ps.revision);
-- This view enforces approval, NOT guardian authorization. Server must join active guardian_link.
CREATE INDEX IF NOT EXISTS resources_concept_idx ON resource_recommendation(misconception_revision_id,relevance DESC);
CREATE INDEX IF NOT EXISTS docs_concept_idx ON concept_doc_misconception(misconception_revision_id,concept_doc_id);
CREATE INDEX IF NOT EXISTS verification_due_idx ON verification_check(scheduled_for);
CREATE INDEX IF NOT EXISTS delivery_history_idx ON remediation_delivery(delivered_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['remediation_delivery','verification_check','verification_presentation','verification_result','verification_cancellation','study_note_approval','intervention_approval','resource_approval','concept_doc_approval','parent_summary_approval'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION record_audit()',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA sonder FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sonder FROM PUBLIC;
COMMIT;
