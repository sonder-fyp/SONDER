BEGIN;
SET LOCAL search_path = sonder, public;
CREATE TABLE IF NOT EXISTS ai_model (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, revision text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('generation','scorer','embedding','reranker')),
 runtime text NOT NULL, UNIQUE(name,revision,kind)
);
CREATE TABLE IF NOT EXISTS llm_call_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), model_id uuid NOT NULL REFERENCES ai_model ON DELETE RESTRICT,
 feature text NOT NULL CHECK(feature IN ('parent_rewrite','tutor','consultant','drafter','distractor','mapping','judge','study_note','resource_rationale')),
 user_id uuid REFERENCES app_user ON DELETE RESTRICT, session_id uuid REFERENCES diagnostic_session ON DELETE RESTRICT,
 prompt_hash text NOT NULL, prompt_template_revision text NOT NULL,
 prompt_tokens integer NOT NULL CHECK(prompt_tokens>=0), completion_tokens integer NOT NULL CHECK(completion_tokens>=0),
 latency_ms numeric NOT NULL CHECK(latency_ms>=0),
 outcome text NOT NULL CHECK(outcome IN ('ok','fallback','blocked')),
 request_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb
 -- Opaque, redacted rendered request/response transcript; never a workflow or grounding FK container.
);
CREATE TABLE IF NOT EXISTS cohort_observation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid NOT NULL REFERENCES classroom ON DELETE RESTRICT,
 subject_id uuid NOT NULL REFERENCES subject ON DELETE RESTRICT,
 definition text NOT NULL, window_start timestamptz NOT NULL, window_end timestamptz NOT NULL,
 sample_size integer NOT NULL CHECK(sample_size>0), value numeric NOT NULL, unit text NOT NULL,
 query_revision text NOT NULL, observed_at timestamptz NOT NULL DEFAULT now(), CHECK(window_end>window_start)
 -- Reproducible historical aggregate, not a current class-median cache.
);
CREATE TABLE IF NOT EXISTS evidence_reference (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 step_id uuid REFERENCES session_step ON DELETE RESTRICT,
 verification_id uuid REFERENCES verification_result ON DELETE RESTRICT,
 review_id uuid REFERENCES teacher_review ON DELETE RESTRICT,
 cohort_observation_id uuid REFERENCES cohort_observation ON DELETE RESTRICT,
 item_id uuid REFERENCES item ON DELETE RESTRICT,
 chunk_id uuid REFERENCES concept_doc_chunk ON DELETE RESTRICT,
 source_id uuid REFERENCES source_reference ON DELETE RESTRICT,
 external_url text CHECK(external_url ~ '^https?://'),
 CHECK(num_nonnulls(step_id,verification_id,review_id,cohort_observation_id,item_id,chunk_id,source_id,external_url)=1),
 UNIQUE NULLS NOT DISTINCT(step_id,verification_id,review_id,cohort_observation_id,item_id,chunk_id,source_id,external_url)
);
CREATE TABLE IF NOT EXISTS llm_grounding (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), call_id uuid NOT NULL REFERENCES llm_call_log ON DELETE RESTRICT,
 evidence_id uuid NOT NULL REFERENCES evidence_reference ON DELETE RESTRICT, position integer NOT NULL CHECK(position>0),
 UNIQUE(call_id,evidence_id), UNIQUE(call_id,position)
);
CREATE TABLE IF NOT EXISTS assistant_thread (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('tutor','consultant')),
 misconception_revision_id uuid REFERENCES misconception_revision ON DELETE RESTRICT,
 enrolment_id uuid REFERENCES enrolment ON DELETE RESTRICT,
 class_id uuid REFERENCES classroom ON DELETE RESTRICT,
 escalation_id uuid REFERENCES escalation ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='tutor' AND misconception_revision_id IS NOT NULL AND num_nonnulls(enrolment_id,class_id,escalation_id)=0)
 OR (kind='consultant' AND misconception_revision_id IS NULL AND num_nonnulls(enrolment_id,class_id,escalation_id)=1))
);
CREATE TABLE IF NOT EXISTS assistant_message (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL REFERENCES assistant_thread ON DELETE RESTRICT,
 sequence integer NOT NULL CHECK(sequence>=0), speaker text NOT NULL CHECK(speaker IN ('user','assistant')),
 body text NOT NULL, preset_key text, call_id uuid UNIQUE REFERENCES llm_call_log ON DELETE RESTRICT,
 outcome text NOT NULL CHECK(outcome IN ('user_input','answered','abstained','fallback')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(thread_id,sequence),
 CHECK((speaker='user' AND outcome='user_input' AND call_id IS NULL) OR (speaker='assistant' AND outcome<>'user_input'))
);
CREATE TABLE IF NOT EXISTS assistant_message_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL REFERENCES assistant_message ON DELETE RESTRICT,
 evidence_id uuid NOT NULL REFERENCES evidence_reference ON DELETE RESTRICT,
 position integer NOT NULL CHECK(position>0), display_text text NOT NULL,
 UNIQUE(message_id,position), UNIQUE(message_id,evidence_id)
);
CREATE TABLE IF NOT EXISTS consultant_suggestion (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), call_id uuid NOT NULL REFERENCES llm_call_log ON DELETE RESTRICT,
 enrolment_id uuid REFERENCES enrolment ON DELETE RESTRICT, escalation_id uuid REFERENCES escalation ON DELETE RESTRICT,
 message_id uuid UNIQUE REFERENCES assistant_message ON DELETE RESTRICT,
 claim text NOT NULL, confidence numeric CHECK(confidence BETWEEN 0 AND 1),
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(num_nonnulls(enrolment_id,escalation_id)=1)
);
CREATE TABLE IF NOT EXISTS suggestion_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), suggestion_id uuid NOT NULL REFERENCES consultant_suggestion ON DELETE RESTRICT,
 evidence_id uuid NOT NULL REFERENCES evidence_reference ON DELETE RESTRICT,
 position integer NOT NULL CHECK(position>0), display_text text NOT NULL,
 UNIQUE(suggestion_id,position), UNIQUE(suggestion_id,evidence_id)
);
CREATE TABLE IF NOT EXISTS suggestion_review (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), suggestion_id uuid NOT NULL REFERENCES consultant_suggestion ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0), teacher_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 verdict text NOT NULL CHECK(verdict IN ('approved','rejected')),
 note text NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT now(), UNIQUE(suggestion_id,revision)
);
CREATE TABLE IF NOT EXISTS coverage_gap (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), topic_revision_id uuid NOT NULL REFERENCES topic_revision ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('separator','thin_coverage')),
 target_minimum integer NOT NULL CHECK(target_minimum>0), note text NOT NULL,
 detected_from_session_id uuid REFERENCES diagnostic_session ON DELETE RESTRICT,
 detected_at timestamptz NOT NULL DEFAULT now(), bank_count_at_detection integer NOT NULL CHECK(bank_count_at_detection>=0),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','generating','in_review','closed')),
 scan_key text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS gap_misconception (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gap_id uuid NOT NULL REFERENCES coverage_gap ON DELETE RESTRICT,
 misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 UNIQUE(gap_id,misconception_revision_id)
);
CREATE TABLE IF NOT EXISTS generation_run (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gap_id uuid NOT NULL REFERENCES coverage_gap ON DELETE RESTRICT,
 drafter_model_id uuid NOT NULL REFERENCES ai_model ON DELETE RESTRICT,
 scorer_model_id uuid NOT NULL REFERENCES ai_model ON DELETE RESTRICT,
 pass_mark numeric NOT NULL CHECK(pass_mark BETWEEN 0 AND 1), target_min integer NOT NULL CHECK(target_min>0),
 target_max integer NOT NULL, max_rounds integer NOT NULL CHECK(max_rounds>0),
 request_key text NOT NULL UNIQUE, started_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','paused','ready','exhausted','failed','published')),
 CHECK(target_max>=target_min)
);
CREATE TABLE IF NOT EXISTS generation_round (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES generation_run ON DELETE RESTRICT,
 round_index integer NOT NULL CHECK(round_index>0), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(run_id,round_index)
);
CREATE TABLE IF NOT EXISTS generated_item (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), round_id uuid NOT NULL REFERENCES generation_round ON DELETE RESTRICT,
 candidate_index integer NOT NULL CHECK(candidate_index>0), item_id uuid NOT NULL UNIQUE REFERENCES item ON DELETE RESTRICT,
 drafter_call_id uuid NOT NULL REFERENCES llm_call_log ON DELETE RESTRICT,
 distractor_source text NOT NULL CHECK(distractor_source IN ('computed','ai')),
 mapping_source text NOT NULL DEFAULT 'ai' CHECK(mapping_source IN ('ai','engine_verified')),
 status text NOT NULL DEFAULT 'drafted' CHECK(status IN ('drafted','kept','rejected','approved','published')),
 rejection_reason text, published_item_id uuid UNIQUE REFERENCES item ON DELETE RESTRICT,
 UNIQUE(round_id,candidate_index), CHECK(status<>'rejected' OR rejection_reason IS NOT NULL),
 CHECK((status='published') = (published_item_id IS NOT NULL))
 -- Structured candidates reuse item/options/mappings in a DRAFT pack. Raw malformed drafts stay in call payloads.
);
CREATE TABLE IF NOT EXISTS quality_rubric (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rubric_code text NOT NULL UNIQUE, definition text NOT NULL
);
CREATE TABLE IF NOT EXISTS rubric_dimension (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rubric_id uuid NOT NULL REFERENCES quality_rubric ON DELETE RESTRICT,
 code text NOT NULL, definition text NOT NULL, UNIQUE(rubric_id,code)
);
CREATE TABLE IF NOT EXISTS quality_assessment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), generated_item_id uuid NOT NULL REFERENCES generated_item ON DELETE RESTRICT,
 rubric_id uuid NOT NULL REFERENCES quality_rubric ON DELETE RESTRICT,
 scorer_model_id uuid NOT NULL REFERENCES ai_model ON DELETE RESTRICT,
 judge_call_id uuid UNIQUE REFERENCES llm_call_log ON DELETE RESTRICT,
 overall numeric NOT NULL CHECK(overall BETWEEN 0 AND 1), reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(generated_item_id,rubric_id,scorer_model_id)
);
CREATE TABLE IF NOT EXISTS quality_dimension_score (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assessment_id uuid NOT NULL REFERENCES quality_assessment ON DELETE RESTRICT,
 dimension_id uuid NOT NULL REFERENCES rubric_dimension ON DELETE RESTRICT,
 score numeric NOT NULL CHECK(score BETWEEN 0 AND 1), UNIQUE(assessment_id,dimension_id)
);
CREATE TABLE IF NOT EXISTS content_review_assignment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), generated_item_id uuid NOT NULL REFERENCES generated_item ON DELETE RESTRICT,
 reviewer_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 assigned_at timestamptz NOT NULL DEFAULT now(), UNIQUE(generated_item_id,reviewer_id)
);
CREATE TABLE IF NOT EXISTS generation_review (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id uuid NOT NULL UNIQUE REFERENCES content_review_assignment ON DELETE RESTRICT,
 verdict text NOT NULL CHECK(verdict IN ('approve','approve_with_edit','reject')),
 note text NOT NULL, decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS review_dispute (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), generated_item_id uuid NOT NULL REFERENCES generated_item ON DELETE RESTRICT,
 option_id uuid REFERENCES item_option ON DELETE RESTRICT,
 issue_key text NOT NULL, issue text NOT NULL, UNIQUE(generated_item_id,issue_key)
);
CREATE TABLE IF NOT EXISTS reviewer_mapping_proposal (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid NOT NULL REFERENCES generation_review ON DELETE RESTRICT,
 option_id uuid NOT NULL REFERENCES item_option ON DELETE RESTRICT,
 misconception_revision_id uuid REFERENCES misconception_revision ON DELETE RESTRICT,
 rationale text NOT NULL,
 UNIQUE NULLS NOT DISTINCT(review_id,option_id,misconception_revision_id)
 -- NULL misconception explicitly proposes unmapped; adjudication records the accepted edit.
);
CREATE TABLE IF NOT EXISTS review_adjudication (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dispute_id uuid NOT NULL UNIQUE REFERENCES review_dispute ON DELETE RESTRICT,
 adjudicator_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 resolution text NOT NULL, decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS provenance_entry (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 item_id uuid UNIQUE REFERENCES item ON DELETE RESTRICT,
 distractor_item_id uuid UNIQUE REFERENCES item ON DELETE RESTRICT,
 note_id uuid UNIQUE REFERENCES study_note ON DELETE RESTRICT,
 recommendation_id uuid UNIQUE REFERENCES resource_recommendation ON DELETE RESTRICT,
 suggestion_id uuid UNIQUE REFERENCES consultant_suggestion ON DELETE RESTRICT,
 run_id uuid UNIQUE REFERENCES generation_run ON DELETE RESTRICT,
 summary_id uuid UNIQUE REFERENCES parent_summary ON DELETE RESTRICT,
 doc_id uuid UNIQUE REFERENCES concept_doc ON DELETE RESTRICT,
 message_id uuid UNIQUE REFERENCES assistant_message ON DELETE RESTRICT,
 purpose text NOT NULL, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(item_id,distractor_item_id,note_id,recommendation_id,suggestion_id,run_id,summary_id,doc_id,message_id)=1)
 -- Typed FKs replace unconstrained (artefact_type, artefact_id).
);
CREATE TABLE IF NOT EXISTS provenance_call (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provenance_id uuid NOT NULL REFERENCES provenance_entry ON DELETE RESTRICT,
 call_id uuid NOT NULL REFERENCES llm_call_log ON DELETE RESTRICT, UNIQUE(provenance_id,call_id)
);
CREATE TABLE IF NOT EXISTS provenance_grounding (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provenance_id uuid NOT NULL REFERENCES provenance_entry ON DELETE RESTRICT,
 evidence_id uuid NOT NULL REFERENCES evidence_reference ON DELETE RESTRICT, UNIQUE(provenance_id,evidence_id)
);
CREATE TABLE IF NOT EXISTS provenance_validation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provenance_id uuid NOT NULL REFERENCES provenance_entry ON DELETE RESTRICT,
 validator_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 decision text NOT NULL CHECK(decision IN ('approved','rejected','surfaced')),
 note text NOT NULL, validated_at timestamptz NOT NULL DEFAULT now()
 -- Each row is a distinct provenance validation event, not a copied generation_review vote.
);
CREATE TABLE IF NOT EXISTS evaluation_study (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), study_code text NOT NULL UNIQUE,
 definition text NOT NULL, dataset_reference text NOT NULL, dataset_hash text NOT NULL,
 window_start timestamptz NOT NULL, window_end timestamptz NOT NULL, caveat text NOT NULL,
 engine_release_id uuid REFERENCES engine_release ON DELETE RESTRICT,
 content_version_id uuid REFERENCES content_version ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(window_end>window_start)
);
CREATE TABLE IF NOT EXISTS evaluation_arm (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), study_id uuid NOT NULL REFERENCES evaluation_study ON DELETE RESTRICT,
 code text NOT NULL, definition text NOT NULL, UNIQUE(study_id,code)
);
CREATE TABLE IF NOT EXISTS metric_definition (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL, revision integer NOT NULL CHECK(revision>0),
 label text NOT NULL, definition text NOT NULL, denominator_definition text NOT NULL,
 unit text NOT NULL, good_when text NOT NULL CHECK(good_when IN ('up','down','neutral')),
 UNIQUE(code,revision)
);
CREATE TABLE IF NOT EXISTS evaluation_result (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), arm_id uuid NOT NULL REFERENCES evaluation_arm ON DELETE RESTRICT,
 metric_id uuid NOT NULL REFERENCES metric_definition ON DELETE RESTRICT,
 subject_id uuid REFERENCES subject ON DELETE RESTRICT, stratum text NOT NULL DEFAULT 'all',
 value numeric NOT NULL, sample_size integer NOT NULL CHECK(sample_size>0),
 numerator numeric, denominator numeric CHECK(denominator>0),
 lower_bound numeric, upper_bound numeric, caveat text NOT NULL,
 UNIQUE NULLS NOT DISTINCT(arm_id,metric_id,subject_id,stratum),
 CHECK(lower_bound IS NULL OR upper_bound IS NULL OR lower_bound<=upper_bound)
);
CREATE TABLE IF NOT EXISTS evaluation_comparison (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), result_id uuid NOT NULL REFERENCES evaluation_result ON DELETE RESTRICT,
 baseline_result_id uuid NOT NULL REFERENCES evaluation_result ON DELETE RESTRICT,
 comparison_note text NOT NULL, UNIQUE(result_id,baseline_result_id), CHECK(result_id<>baseline_result_id)
 -- Baseline value, delta and direction are joined/computed, never copied.
);
CREATE TABLE IF NOT EXISTS job_run (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('calibration','gap_scan','generation','evaluation','indexing')),
 request_key text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
 started_at timestamptz, ended_at timestamptz, heartbeat_at timestamptz, error_text text,
 CHECK(ended_at IS NULL OR (started_at IS NOT NULL AND ended_at>=started_at))
);

CREATE OR REPLACE FUNCTION ai_scope_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE a uuid; b uuid; owner_role text; t assistant_thread; ref evidence_reference; e enrolment;
BEGIN
 IF TG_TABLE_NAME='gap_misconception' THEN
  PERFORM 1 FROM coverage_gap WHERE id=NEW.gap_id FOR UPDATE;
  SELECT tr.content_version_id INTO a FROM coverage_gap g JOIN topic_revision tr ON tr.id=g.topic_revision_id WHERE g.id=NEW.gap_id;
  SELECT content_version_id INTO b FROM misconception_revision WHERE id=NEW.misconception_revision_id;
  IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Gap misconception scope'; END IF;
 ELSIF TG_TABLE_NAME='quality_dimension_score' THEN
  SELECT rubric_id INTO a FROM quality_assessment WHERE id=NEW.assessment_id;
  SELECT rubric_id INTO b FROM rubric_dimension WHERE id=NEW.dimension_id;
  IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Rubric dimension mismatch'; END IF;
 ELSIF TG_TABLE_NAME='content_review_assignment' THEN
  SELECT role INTO owner_role FROM app_user WHERE id=NEW.reviewer_id AND status='active';
  IF owner_role IS NULL OR owner_role NOT IN ('teacher','admin') THEN RAISE EXCEPTION 'Reviewer must be active teacher/admin'; END IF;
 ELSIF TG_TABLE_NAME='review_dispute' THEN
  IF NEW.option_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM generated_item gi JOIN item_option o ON o.item_id=gi.item_id WHERE gi.id=NEW.generated_item_id AND o.id=NEW.option_id) THEN RAISE EXCEPTION 'Disputed option outside candidate'; END IF;
 ELSIF TG_TABLE_NAME='reviewer_mapping_proposal' THEN
  IF NOT EXISTS(SELECT 1 FROM generation_review gr JOIN content_review_assignment ra ON ra.id=gr.assignment_id JOIN generated_item gi ON gi.id=ra.generated_item_id JOIN item_option o ON o.item_id=gi.item_id WHERE gr.id=NEW.review_id AND o.id=NEW.option_id) THEN RAISE EXCEPTION 'Reviewer option outside candidate'; END IF;
 ELSIF TG_TABLE_NAME IN ('review_adjudication','provenance_validation') THEN
  SELECT role INTO owner_role FROM app_user WHERE id=CASE WHEN TG_TABLE_NAME='review_adjudication' THEN (to_jsonb(NEW)->>'adjudicator_id')::uuid ELSE (to_jsonb(NEW)->>'validator_id')::uuid END AND status='active';
  IF owner_role IS NULL OR owner_role NOT IN ('teacher','admin') THEN RAISE EXCEPTION 'Invalid validator'; END IF;
 ELSIF TG_TABLE_NAME='evaluation_comparison' THEN
  IF NOT EXISTS(SELECT 1 FROM evaluation_result x JOIN evaluation_arm xa ON xa.id=x.arm_id JOIN evaluation_result y ON y.id=NEW.baseline_result_id JOIN evaluation_arm ya ON ya.id=y.arm_id WHERE x.id=NEW.result_id AND xa.study_id=ya.study_id AND x.metric_id=y.metric_id AND x.subject_id IS NOT DISTINCT FROM y.subject_id AND x.stratum=y.stratum AND x.sample_size=y.sample_size) THEN RAISE EXCEPTION 'Incomparable baseline'; END IF;
 ELSIF TG_TABLE_NAME='assistant_thread' THEN
  SELECT role INTO owner_role FROM app_user WHERE id=NEW.owner_id AND status='active';
  IF owner_role IS NULL OR owner_role NOT IN ('student','teacher') THEN RAISE EXCEPTION 'Assistant owner role'; END IF;
  IF NEW.kind='consultant' THEN
   IF NEW.enrolment_id IS NOT NULL THEN SELECT * INTO e FROM enrolment WHERE id=NEW.enrolment_id;
   ELSIF NEW.escalation_id IS NOT NULL THEN SELECT en.* INTO e FROM escalation es JOIN diagnostic_session ds ON ds.id=es.session_id JOIN enrolment en ON en.id=ds.enrolment_id WHERE es.id=NEW.escalation_id;
   ELSE e.class_id:=NEW.class_id; END IF;
   IF (owner_role='student' AND (NEW.enrolment_id IS NULL OR e.student_id IS DISTINCT FROM NEW.owner_id)) OR (owner_role='teacher' AND NOT EXISTS(SELECT 1 FROM class_teacher WHERE class_id=e.class_id AND teacher_id=NEW.owner_id AND status='active')) THEN RAISE EXCEPTION 'Assistant history scope'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='assistant_message_evidence' THEN
  SELECT th.* INTO t FROM assistant_thread th JOIN assistant_message m ON m.thread_id=th.id WHERE m.id=NEW.message_id;
  SELECT * INTO ref FROM evidence_reference WHERE id=NEW.evidence_id;
  IF t.kind='tutor' AND (ref.chunk_id IS NULL OR NOT EXISTS(SELECT 1 FROM concept_doc_chunk c JOIN concept_doc_misconception cm ON cm.concept_doc_id=c.concept_doc_id JOIN concept_doc_approval ca ON ca.concept_doc_id=c.concept_doc_id WHERE c.id=ref.chunk_id AND cm.misconception_revision_id=t.misconception_revision_id)) THEN RAISE EXCEPTION 'Tutor evidence outside approved concept corpus'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION gap_cardinality() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE g uuid; k text; n integer;
BEGIN
 IF TG_TABLE_NAME='coverage_gap' THEN g:=NEW.id; ELSE g:=NEW.gap_id; END IF;
 SELECT kind INTO k FROM coverage_gap WHERE id=g;
 SELECT count(*) INTO n FROM gap_misconception WHERE gap_id=g;
 IF n<>(CASE WHEN k='separator' THEN 2 ELSE 1 END) THEN RAISE EXCEPTION 'Gap needs exactly one/two misconceptions'; END IF;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION generation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE run generation_run; votes integer; bad integer; k uuid;
BEGIN
 IF TG_TABLE_NAME='generation_round' THEN
  SELECT * INTO run FROM generation_run WHERE id=NEW.run_id FOR UPDATE;
  IF run.status<>'running' OR NEW.round_index>run.max_rounds OR NEW.round_index<>(SELECT count(*)+1 FROM generation_round WHERE run_id=run.id) THEN RAISE EXCEPTION 'Invalid generation round'; END IF;
 ELSIF TG_TABLE_NAME='generation_review' THEN
  SELECT ra.generated_item_id INTO k FROM content_review_assignment ra WHERE ra.id=NEW.assignment_id;
  PERFORM 1 FROM generated_item WHERE id=k FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM generated_item WHERE id=k AND status='kept') THEN RAISE EXCEPTION 'Review requires kept candidate'; END IF;
 ELSE
  SELECT r.* INTO run FROM generation_round rd JOIN generation_run r ON r.id=rd.run_id WHERE rd.id=NEW.round_id;
  IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM item i JOIN topic_revision it ON it.id=i.topic_revision_id JOIN content_version cv ON cv.id=it.content_version_id JOIN coverage_gap g ON g.id=run.gap_id JOIN topic_revision gt ON gt.id=g.topic_revision_id WHERE i.id=NEW.item_id AND cv.status='draft' AND i.origin='generated' AND it.topic_id=gt.topic_id) THEN RAISE EXCEPTION 'Candidate must use draft subject/topic pack'; END IF;
  IF NEW.status='kept' AND (NEW.mapping_source<>'engine_verified' OR NOT EXISTS(SELECT 1 FROM quality_assessment WHERE generated_item_id=NEW.id AND scorer_model_id=run.scorer_model_id AND overall>=run.pass_mark)) THEN RAISE EXCEPTION 'Candidate did not pass mapping/scorer'; END IF;
  IF NEW.status IN ('approved','published') THEN
   SELECT count(*),count(*) FILTER(WHERE gr.verdict='reject') INTO votes,bad FROM generation_review gr JOIN content_review_assignment ra ON ra.id=gr.assignment_id WHERE ra.generated_item_id=NEW.id;
   IF votes<2 OR bad>0 OR EXISTS(SELECT 1 FROM review_dispute d WHERE d.generated_item_id=NEW.id AND NOT EXISTS(SELECT 1 FROM review_adjudication WHERE dispute_id=d.id)) OR (EXISTS(SELECT 1 FROM generation_review gr JOIN content_review_assignment ra ON ra.id=gr.assignment_id WHERE ra.generated_item_id=NEW.id AND gr.verdict='approve_with_edit') AND NOT EXISTS(SELECT 1 FROM review_dispute d JOIN review_adjudication a ON a.dispute_id=d.id WHERE d.generated_item_id=NEW.id)) THEN RAISE EXCEPTION 'Two approvals and adjudication required'; END IF;
  END IF;
  IF NEW.status='published' AND NOT EXISTS(SELECT 1 FROM item i JOIN topic_revision t ON t.id=i.topic_revision_id JOIN content_version c ON c.id=t.content_version_id WHERE i.id=NEW.published_item_id AND i.review_status='approved' AND c.status='frozen' AND i.id<>NEW.item_id) THEN RAISE EXCEPTION 'Publication needs new approved frozen item'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION reviewed_candidate_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE k uuid; row_data jsonb;
BEGIN
 row_data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 IF TG_TABLE_NAME='item' THEN k:=(row_data->>'id')::uuid;
 ELSIF row_data ? 'item_id' THEN k:=(row_data->>'item_id')::uuid;
 ELSE SELECT item_id INTO k FROM item_option WHERE id=(row_data->>'option_id')::uuid; END IF;
 IF EXISTS(SELECT 1 FROM generated_item gi JOIN content_review_assignment ra ON ra.generated_item_id=gi.id JOIN generation_review gr ON gr.assignment_id=ra.id WHERE gi.item_id=k) THEN RAISE EXCEPTION 'Reviewed draft is immutable; apply adjudicated edit to new publication copy'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION ai_complete() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE row_data jsonb; k uuid; parentkey uuid; hits integer;
BEGIN
 row_data:=to_jsonb(NEW); k:=NEW.id;
 IF TG_TABLE_NAME='consultant_suggestion' THEN
  IF NOT EXISTS(SELECT 1 FROM suggestion_evidence WHERE suggestion_id=k) THEN RAISE EXCEPTION 'Suggestion without evidence'; END IF;
 ELSIF TG_TABLE_NAME='assistant_message' THEN
  IF row_data->>'speaker'='assistant' AND NEW.outcome='answered' THEN
   IF NEW.call_id IS NULL THEN RAISE EXCEPTION 'Unlogged AI answer'; END IF;
   IF EXISTS(SELECT 1 FROM assistant_thread WHERE id=NEW.thread_id AND kind='tutor') AND NOT EXISTS(SELECT 1 FROM assistant_message_evidence WHERE message_id=k) THEN RAISE EXCEPTION 'Ungrounded tutor answer'; END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME='item' AND row_data->>'origin'='generated' THEN
  SELECT count(*) INTO hits FROM provenance_entry WHERE item_id=k;
 ELSIF TG_TABLE_NAME='study_note' AND row_data->>'origin'='generated' THEN
  SELECT count(*) INTO hits FROM provenance_entry WHERE note_id=k;
 ELSIF TG_TABLE_NAME='resource_recommendation' AND row_data->>'origin'='found' THEN
  SELECT count(*) INTO hits FROM provenance_entry WHERE recommendation_id=k;
 ELSIF TG_TABLE_NAME='parent_summary' AND row_data->>'origin'='generated' THEN
  SELECT count(*) INTO hits FROM provenance_entry WHERE summary_id=k;
 ELSIF TG_TABLE_NAME='consultant_suggestion' THEN
  SELECT count(*) INTO hits FROM provenance_entry WHERE suggestion_id=k;
 ELSIF TG_TABLE_NAME='generation_run' THEN
  SELECT count(*) INTO hits FROM provenance_entry WHERE run_id=k;
 ELSIF TG_TABLE_NAME='assistant_message' AND row_data->>'speaker'='assistant' AND row_data->>'call_id' IS NOT NULL THEN
  SELECT count(*) INTO hits FROM provenance_entry WHERE message_id=k;
 ELSE RETURN NULL; END IF;
 IF hits<>1 THEN RAISE EXCEPTION 'AI artifact missing its unique provenance'; END IF;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION suggestion_review_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE en uuid;
BEGIN
 PERFORM require_user_role(NEW.teacher_id,'teacher');
 PERFORM 1 FROM consultant_suggestion WHERE id=NEW.suggestion_id FOR UPDATE;
 SELECT coalesce(cs.enrolment_id,ds.enrolment_id) INTO en FROM consultant_suggestion cs LEFT JOIN escalation es ON es.id=cs.escalation_id LEFT JOIN diagnostic_session ds ON ds.id=es.session_id WHERE cs.id=NEW.suggestion_id;
 IF NOT EXISTS(SELECT 1 FROM enrolment e JOIN class_teacher ct ON ct.class_id=e.class_id WHERE e.id=en AND ct.teacher_id=NEW.teacher_id AND ct.status='active') OR NEW.revision<>(SELECT count(*)+1 FROM suggestion_review WHERE suggestion_id=NEW.suggestion_id) THEN RAISE EXCEPTION 'Suggestion review scope/order'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION generation_run_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE kept integer;
BEGIN
 IF NEW.status='ready' THEN
  SELECT count(*) INTO kept FROM generated_item gi JOIN generation_round rd ON rd.id=gi.round_id WHERE rd.run_id=NEW.id AND gi.status='kept';
  IF kept NOT BETWEEN NEW.target_min AND NEW.target_max THEN RAISE EXCEPTION 'Ready batch outside requested size'; END IF;
 END IF;
 IF NEW.status='published' AND EXISTS(SELECT 1 FROM generated_item gi JOIN generation_round rd ON rd.id=gi.round_id WHERE rd.run_id=NEW.id AND gi.status IN ('kept','approved')) THEN RAISE EXCEPTION 'Batch contains unpublished accepted candidates'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['ai_model','llm_call_log','cohort_observation','evidence_reference','llm_grounding','assistant_thread','assistant_message','assistant_message_evidence','consultant_suggestion','suggestion_evidence','suggestion_review','gap_misconception','generation_round','quality_rubric','rubric_dimension','quality_assessment','quality_dimension_score','content_review_assignment','generation_review','review_dispute','reviewer_mapping_proposal','review_adjudication','provenance_entry','provenance_call','provenance_grounding','provenance_validation','evaluation_study','evaluation_arm','metric_definition','evaluation_result','evaluation_comparison'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_mutation()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['gap_misconception','quality_dimension_score','content_review_assignment','review_dispute','reviewer_mapping_proposal','review_adjudication','provenance_validation','evaluation_comparison','assistant_thread','assistant_message_evidence'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER scope_check BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION ai_scope_guard()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['coverage_gap','gap_misconception'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=format('sonder.%I',t)::regclass AND tgname='gap_cardinality') THEN
   EXECUTE format('CREATE CONSTRAINT TRIGGER gap_cardinality AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION gap_cardinality()',t);
  END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['generation_round','generation_review','generated_item'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER generation_check BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION generation_guard()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['item','item_option','option_misconception','item_numeric_parameter','item_source','item_prediction'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER reviewed_candidate BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reviewed_candidate_guard()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['item','study_note','resource_recommendation','parent_summary','consultant_suggestion','generation_run','assistant_message'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=format('sonder.%I',t)::regclass AND tgname='ai_complete') THEN
   EXECUTE format('CREATE CONSTRAINT TRIGGER ai_complete AFTER INSERT ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ai_complete()',t);
  END IF;
 END LOOP;
END $$;
CREATE OR REPLACE TRIGGER scope_check BEFORE INSERT ON suggestion_review FOR EACH ROW EXECUTE FUNCTION suggestion_review_guard();
CREATE OR REPLACE TRIGGER run_check BEFORE UPDATE ON generation_run FOR EACH ROW EXECUTE FUNCTION generation_run_guard();
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON coverage_gap FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','topic_revision_id','kind','target_minimum','note','detected_from_session_id','detected_at','bank_count_at_detection','scan_key');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON generation_run FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','gap_id','drafter_model_id','scorer_model_id','pass_mark','target_min','target_max','max_rounds','request_key','started_at');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON generated_item FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','round_id','candidate_index','item_id','drafter_call_id','distractor_source');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON coverage_gap FOR EACH ROW EXECUTE FUNCTION state_guard('status','open','open>generating,generating>in_review,generating>open,in_review>closed,in_review>open');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON generation_run FOR EACH ROW EXECUTE FUNCTION state_guard('status','queued','queued>running,queued>failed,running>paused,paused>running,running>ready,running>exhausted,running>failed,paused>failed,ready>published');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON generated_item FOR EACH ROW EXECUTE FUNCTION state_guard('status','drafted','drafted>kept,drafted>rejected,kept>rejected,kept>approved,approved>published');
CREATE OR REPLACE TRIGGER mapping_state BEFORE INSERT OR UPDATE ON generated_item FOR EACH ROW EXECUTE FUNCTION state_guard('mapping_source','ai,engine_verified','ai>engine_verified');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON job_run FOR EACH ROW EXECUTE FUNCTION state_guard('status','queued','queued>running,queued>cancelled,running>succeeded,running>failed,running>cancelled');
CREATE INDEX IF NOT EXISTS call_feature_time_idx ON llm_call_log(feature,created_at DESC);
CREATE INDEX IF NOT EXISTS assistant_owner_idx ON assistant_thread(owner_id,created_at DESC);
CREATE INDEX IF NOT EXISTS suggestion_escalation_idx ON consultant_suggestion(escalation_id,created_at DESC);
CREATE INDEX IF NOT EXISTS suggestion_pace_idx ON consultant_suggestion(enrolment_id,created_at DESC);
CREATE INDEX IF NOT EXISTS gap_queue_idx ON coverage_gap(status,detected_at);
CREATE INDEX IF NOT EXISTS generation_gap_idx ON generation_run(gap_id,started_at DESC);
CREATE INDEX IF NOT EXISTS candidate_queue_idx ON generated_item(status,round_id);
CREATE INDEX IF NOT EXISTS reviewer_queue_idx ON content_review_assignment(reviewer_id,assigned_at);
CREATE INDEX IF NOT EXISTS provenance_time_idx ON provenance_entry(created_at DESC);
CREATE INDEX IF NOT EXISTS evaluation_recent_idx ON evaluation_study(created_at DESC);
CREATE INDEX IF NOT EXISTS job_health_idx ON job_run(status,heartbeat_at);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['coverage_gap','generation_run','generated_item','generation_review','review_adjudication','suggestion_review','provenance_validation','job_run'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION record_audit()',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA sonder FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sonder FROM PUBLIC;
COMMIT;
