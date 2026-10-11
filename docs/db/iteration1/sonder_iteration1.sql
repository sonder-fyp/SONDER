-- =====================================================================================
-- Sonder - Iteration 1 (Mid-1) database schema, revision 3. ONE self-contained script.
-- Target: PostgreSQL 16+ (Neon). Plain SQL only: no psql meta-commands, no extensions.
--
-- HOW TO RUN (Neon):
--   * Neon Console > SQL Editor: select the WORKING branch (never main during rehearsal)
--     and the target database, paste this whole file, run it.
--   * or: psql "<working-branch connection string>" -X -v ON_ERROR_STOP=1 -f sonder_iteration1.sql
-- Everything runs in ONE transaction and finishes with a self-verification block.
-- If any statement or check fails, the whole script rolls back and nothing is created.
-- Re-running the identical script is safe (IF NOT EXISTS / OR REPLACE / catalogue guards);
-- it is NOT a migration tool and does not repair a drifted schema.
-- No seed or content rows: the reviewed Math pack is imported separately (task T05.07).
--
-- Scope (see DB_SCHEMA_PLAN_ITERATION_1.md): users + login sessions, classes + enrolment,
-- the versioned Math content pack (topics, misconceptions, items, options, Q-matrix,
-- sources, review records), the engine's frozen response model, diagnostic runs
-- (questions, answers, priors, posteriors, diagnosis or refusal) and an audit trail.
-- Revision 2 (see plan section 12): cross-topic topic membership, option link cap 3, V11 (a
-- misconception on at most 2 options of one item), refusal tie sets with a leader, hypothesis
-- slots, EIG candidate ranking, answer notes, a derived support view, engine_params, twin groups.
-- Revision 3 (plan section 12, aligned with docs/ENGINE_SPEC_DRAFT.md spec v2): diagnostic units
-- replace topics as the session scope; V11 relaxed to the spec's limit (the P1 guess check at
-- response-model freeze carries the real constraint); link grades; k_max and link weights in
-- engine_params; twin_group (renamed from stem_family).
-- Deferred to later iterations: teacher review, remediation/verification, parents,
-- announcements/messaging, AI pipeline/provenance/evaluation and pgvector tables.
-- =====================================================================================
BEGIN;
DO $$ BEGIN
 IF current_setting('server_version_num')::integer < 160000 THEN
  RAISE EXCEPTION 'Sonder needs PostgreSQL 16 or newer (this server is %)', current_setting('server_version');
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS sonder;
REVOKE ALL ON SCHEMA sonder FROM PUBLIC;
SET LOCAL search_path = sonder, public;

-- ------------------------------------------------------------------ users and access
CREATE TABLE IF NOT EXISTS app_user (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
 role text NOT NULL CHECK (role IN ('student','teacher','parent','admin')),
 display_name text NOT NULL CHECK (length(btrim(display_name)) > 0), locale text NOT NULL DEFAULT 'en',
 time_zone text NOT NULL DEFAULT 'Asia/Karachi',
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deactivated')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS password_credential (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES app_user ON DELETE CASCADE,
 password_hash text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_session (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES app_user ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 CHECK (expires_at > created_at), CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

-- ------------------------------------------------------------------ classes
CREATE TABLE IF NOT EXISTS classroom (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) > 0), note text NOT NULL DEFAULT '',
 join_code text NOT NULL UNIQUE CHECK (join_code = upper(btrim(join_code)) AND length(join_code) >= 8),
 grade_level smallint NOT NULL DEFAULT 8 CHECK (grade_level BETWEEN 1 AND 12),
 time_zone text NOT NULL DEFAULT 'Asia/Karachi',
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS class_teacher (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 class_id uuid NOT NULL REFERENCES classroom ON DELETE RESTRICT,
 teacher_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','departed')),
 assigned_at timestamptz NOT NULL DEFAULT now(), UNIQUE (class_id, teacher_id)
);
CREATE TABLE IF NOT EXISTS enrolment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 class_id uuid NOT NULL REFERENCES classroom ON DELETE RESTRICT,
 student_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','left')),
 joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE (class_id, student_id)
);
CREATE TABLE IF NOT EXISTS subject (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE CHECK (code = upper(btrim(code)) AND length(code) > 0),
 name text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS class_subject (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 class_id uuid NOT NULL REFERENCES classroom ON DELETE RESTRICT,
 subject_id uuid NOT NULL REFERENCES subject ON DELETE RESTRICT, UNIQUE (class_id, subject_id)
);

-- ------------------------------------------------------------------ versioned content pack
CREATE TABLE IF NOT EXISTS content_version (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 subject_id uuid NOT NULL REFERENCES subject ON DELETE RESTRICT,
 version_code text NOT NULL CHECK (length(btrim(version_code)) > 0),
 note text NOT NULL DEFAULT '',
 pack_sha256 text CHECK (pack_sha256 ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','frozen')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (subject_id, version_code),
 CHECK (status <> 'frozen' OR pack_sha256 IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS topic (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 subject_id uuid NOT NULL REFERENCES subject ON DELETE RESTRICT,
 external_id text NOT NULL, UNIQUE (subject_id, external_id)
);
CREATE TABLE IF NOT EXISTS topic_revision (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 topic_id uuid NOT NULL REFERENCES topic ON DELETE RESTRICT,
 content_version_id uuid NOT NULL REFERENCES content_version ON DELETE RESTRICT,
 name text NOT NULL, blurb text NOT NULL DEFAULT '', grade8_in_scope boolean NOT NULL DEFAULT true,
 UNIQUE (content_version_id, topic_id)
);
CREATE TABLE IF NOT EXISTS misconception (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 subject_id uuid NOT NULL REFERENCES subject ON DELETE RESTRICT,
 code text NOT NULL, external_id text NOT NULL,
 UNIQUE (subject_id, code), UNIQUE (subject_id, external_id)
);
CREATE TABLE IF NOT EXISTS misconception_revision (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 misconception_id uuid NOT NULL REFERENCES misconception ON DELETE RESTRICT,
 content_version_id uuid NOT NULL REFERENCES content_version ON DELETE RESTRICT,
 name text NOT NULL, description text NOT NULL, cognitive_origin text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','catalogued_only','retired')),
 engine_tier smallint NOT NULL CHECK (engine_tier IN (1,2)),
 UNIQUE (content_version_id, misconception_id), CHECK (engine_tier <> 1 OR status = 'validated')
);
CREATE TABLE IF NOT EXISTS topic_misconception (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 topic_revision_id uuid NOT NULL REFERENCES topic_revision ON DELETE RESTRICT,
 misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 membership text NOT NULL DEFAULT 'home' CHECK (membership IN ('home','cross_topic')),
 target_minimum integer DEFAULT 3 CHECK (target_minimum > 0),
 old_topic_label text, review_note text NOT NULL DEFAULT '',
 disposition text NOT NULL DEFAULT 'keep' CHECK (disposition IN ('keep','move','remove')),
 UNIQUE (topic_revision_id, misconception_revision_id),
 -- A coverage target belongs to the misconception's home topic only.
 CHECK ((membership = 'home') = (target_minimum IS NOT NULL)),
 -- A cross-topic membership must say why it exists.
 CHECK (membership = 'home' OR length(btrim(review_note)) > 0)
);
CREATE TABLE IF NOT EXISTS source_reference (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 citation_key text NOT NULL UNIQUE, citation text NOT NULL, url text,
 licence text NOT NULL, scope_note text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS misconception_source (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 source_id uuid NOT NULL REFERENCES source_reference ON DELETE RESTRICT,
 locator text NOT NULL DEFAULT '', UNIQUE (misconception_revision_id, source_id, locator)
);
CREATE TABLE IF NOT EXISTS item (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 topic_revision_id uuid NOT NULL REFERENCES topic_revision ON DELETE RESTRICT,
 target_misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 external_id text NOT NULL, stem text NOT NULL CHECK (length(btrim(stem)) > 0), batch text,
 difficulty_est numeric CHECK (difficulty_est BETWEEN 0 AND 1),
 origin text NOT NULL CHECK (origin IN ('authored','curated')),
 author_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 llm_assisted boolean NOT NULL DEFAULT false,
 assistance_note text NOT NULL DEFAULT '',
 review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft','in_review','approved','rejected')),
 -- Items sharing a twin group (A/B twins) are never both shown in one run.
 twin_group text CHECK (twin_group IS NULL OR length(btrim(twin_group)) > 0),
 UNIQUE (topic_revision_id, external_id),
 CHECK (NOT llm_assisted OR length(btrim(assistance_note)) > 0)
);
CREATE TABLE IF NOT EXISTS item_option (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 item_id uuid NOT NULL REFERENCES item ON DELETE CASCADE,
 label text NOT NULL CHECK (label IN ('A','B','C','D')), external_id text,
 option_text text NOT NULL, is_correct boolean NOT NULL,
 UNIQUE (item_id, label), UNIQUE (item_id, external_id)
);
CREATE TABLE IF NOT EXISTS option_misconception (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 option_id uuid NOT NULL REFERENCES item_option ON DELETE CASCADE,
 misconception_revision_id uuid NOT NULL REFERENCES misconception_revision ON DELETE RESTRICT,
 rationale text NOT NULL,
 -- Spec v2 3.3: S = sound, T = stretch. The engine weights a stretch link by engine_params.w_stretch.
 link_grade text NOT NULL DEFAULT 'S' CHECK (link_grade IN ('S','T')),
 UNIQUE (option_id, misconception_revision_id)
);
CREATE TABLE IF NOT EXISTS item_source (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 item_id uuid NOT NULL REFERENCES item ON DELETE CASCADE,
 source_id uuid NOT NULL REFERENCES source_reference ON DELETE RESTRICT,
 locator text NOT NULL DEFAULT '', UNIQUE (item_id, source_id, locator)
);
CREATE TABLE IF NOT EXISTS item_review (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 item_id uuid NOT NULL REFERENCES item ON DELETE RESTRICT,
 review_round integer NOT NULL CHECK (review_round > 0),
 reviewer_id uuid NOT NULL REFERENCES app_user ON DELETE RESTRICT,
 decision text NOT NULL CHECK (decision IN ('approved','rejected')),
 note text NOT NULL CHECK (length(btrim(note)) > 0),
 decided_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (item_id, review_round)
);

-- ------------------------------------------------------------------ engine model (frozen inputs)
CREATE TABLE IF NOT EXISTS hypothesis (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 content_version_id uuid NOT NULL REFERENCES content_version ON DELETE RESTRICT,
 kind text NOT NULL CHECK (kind IN ('misconception','none','unmodelled')),
 misconception_revision_id uuid REFERENCES misconception_revision ON DELETE RESTRICT,
 CHECK ((kind = 'misconception') = (misconception_revision_id IS NOT NULL)),
 UNIQUE NULLS NOT DISTINCT (content_version_id, kind, misconception_revision_id)
);

-- ------------------------------------------------------------------ diagnostic units (spec v2 2.1)
-- A unit is the session scope: an ordered list of misconception hypotheses (NONE and UNMODELLED
-- are implicit, after them) and the items that belong to it. An item may belong to several units.
-- Units are part of the pack: they are frozen with it.
CREATE TABLE IF NOT EXISTS diagnostic_unit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 content_version_id uuid NOT NULL REFERENCES content_version ON DELETE RESTRICT,
 unit_code text NOT NULL CHECK (length(btrim(unit_code)) > 0),
 name text NOT NULL CHECK (length(btrim(name)) > 0),
 UNIQUE (content_version_id, unit_code)
);
CREATE TABLE IF NOT EXISTS unit_hypothesis (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 unit_id uuid NOT NULL REFERENCES diagnostic_unit ON DELETE RESTRICT,
 hypothesis_id uuid NOT NULL REFERENCES hypothesis ON DELETE RESTRICT,
 slot smallint NOT NULL CHECK (slot >= 0),
 UNIQUE (unit_id, hypothesis_id), UNIQUE (unit_id, slot)
 -- Misconception hypotheses only, slots 0..k-1. A run uses exactly this list, in this order.
);
CREATE TABLE IF NOT EXISTS unit_item (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 unit_id uuid NOT NULL REFERENCES diagnostic_unit ON DELETE RESTRICT,
 item_id uuid NOT NULL REFERENCES item ON DELETE RESTRICT,
 position integer NOT NULL CHECK (position >= 0),
 UNIQUE (unit_id, item_id), UNIQUE (unit_id, position)
 -- Pack order inside the unit (0..n-1). The engine passes eligible items in this order and breaks
 -- exact EIG ties in favour of the lower position (selection.py), so replay needs it.
);
-- The engine code build. Numeric parameters live in engine_params, not here.
CREATE TABLE IF NOT EXISTS engine_release (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 release_code text NOT NULL UNIQUE, code_hash text NOT NULL,
 selection_policy text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
-- One versioned engine parameter file (spec section 5.5), frozen by its SHA-256. Every value is
-- ASSUMED, not calibrated. Parameter checks P1-P6 from the spec are CHECK constraints here.
CREATE TABLE IF NOT EXISTS engine_params (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 params_version text NOT NULL UNIQUE CHECK (length(btrim(params_version)) > 0),
 params_sha256 text NOT NULL UNIQUE CHECK (params_sha256 ~ '^[0-9a-f]{64}$'),
 slip numeric NOT NULL CHECK (slip > 0 AND slip < 0.5),
 guess numeric NOT NULL CHECK (guess > 0 AND guess < 0.5),
 prior_none numeric NOT NULL CHECK (prior_none > 0),
 prior_unmodelled numeric NOT NULL CHECK (prior_unmodelled > 0),
 theta numeric NOT NULL CHECK (theta > 0.5 AND theta < 1),
 theta_unmodelled numeric NOT NULL CHECK (theta_unmodelled > 0 AND theta_unmodelled < 1),
 min_support integer NOT NULL CHECK (min_support >= 1),
 min_support_none integer NOT NULL,
 delta_sep numeric NOT NULL CHECK (delta_sep >= 0 AND delta_sep < 0.5),
 eig_floor numeric NOT NULL CHECK (eig_floor >= 0),
 default_budget integer NOT NULL CHECK (default_budget >= 1),
 k_max integer NOT NULL CHECK (k_max >= 1),
 w_sound numeric NOT NULL CHECK (w_sound > 0 AND w_sound <= 1),
 w_stretch numeric NOT NULL CHECK (w_stretch >= 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (w_stretch <= w_sound),
 CHECK (prior_none + prior_unmodelled < 1),
 CHECK (theta + theta_unmodelled > 1),
 CHECK (min_support_none >= min_support)
);
CREATE TABLE IF NOT EXISTS response_model (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 content_version_id uuid NOT NULL REFERENCES content_version ON DELETE RESTRICT,
 engine_params_id uuid NOT NULL REFERENCES engine_params ON DELETE RESTRICT,
 model_code text NOT NULL, source text NOT NULL CHECK (source IN ('prior','calibrated')),
 calibration_note text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','frozen')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (content_version_id, model_code)
);
CREATE TABLE IF NOT EXISTS response_parameter (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 response_model_id uuid NOT NULL REFERENCES response_model ON DELETE RESTRICT,
 hypothesis_id uuid NOT NULL REFERENCES hypothesis ON DELETE RESTRICT,
 slip numeric NOT NULL CHECK (slip BETWEEN 0 AND 1), guess numeric NOT NULL CHECK (guess BETWEEN 0 AND 1),
 UNIQUE (response_model_id, hypothesis_id)
);
CREATE TABLE IF NOT EXISTS response_probability (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 response_model_id uuid NOT NULL REFERENCES response_model ON DELETE RESTRICT,
 hypothesis_id uuid NOT NULL REFERENCES hypothesis ON DELETE RESTRICT,
 option_id uuid NOT NULL REFERENCES item_option ON DELETE RESTRICT,
 probability numeric NOT NULL CHECK (probability BETWEEN 0 AND 1),
 UNIQUE (response_model_id, hypothesis_id, option_id)
);

-- ------------------------------------------------------------------ diagnostic runs
CREATE TABLE IF NOT EXISTS diagnostic_session (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 enrolment_id uuid NOT NULL REFERENCES enrolment ON DELETE RESTRICT,
 response_model_id uuid NOT NULL REFERENCES response_model ON DELETE RESTRICT,
 engine_release_id uuid NOT NULL REFERENCES engine_release ON DELETE RESTRICT,
 unit_id uuid NOT NULL REFERENCES diagnostic_unit ON DELETE RESTRICT,
 question_budget integer NOT NULL CHECK (question_budget > 0),
 request_key text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','diagnosed','none_detected',
   'escalated_no_separator','escalated_exhausted','escalated_unmodelled','abandoned')),
 UNIQUE (enrolment_id, request_key),
 CHECK ((status = 'in_progress') = (ended_at IS NULL)), CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE TABLE IF NOT EXISTS session_hypothesis (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES diagnostic_session ON DELETE RESTRICT,
 hypothesis_id uuid NOT NULL REFERENCES hypothesis ON DELETE RESTRICT,
 slot smallint NOT NULL CHECK (slot >= 0),
 prior_probability numeric NOT NULL CHECK (prior_probability BETWEEN 0 AND 1),
 UNIQUE (session_id, hypothesis_id), UNIQUE (session_id, slot)
 -- Slots order the hypotheses: misconceptions 0..k-1, NONE = k, UNMODELLED = k+1 (spec 5.0).
);
CREATE TABLE IF NOT EXISTS session_question (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES diagnostic_session ON DELETE RESTRICT,
 step_index integer NOT NULL CHECK (step_index >= 0),
 item_id uuid NOT NULL REFERENCES item ON DELETE RESTRICT,
 presented_at timestamptz NOT NULL DEFAULT now(), selection_reason text NOT NULL,
 entropy_before numeric NOT NULL CHECK (entropy_before >= 0),
 expected_ig numeric NOT NULL CHECK (expected_ig >= 0),
 UNIQUE (session_id, step_index), UNIQUE (session_id, item_id)
);
-- The EIG ranking behind a presentation: every candidate item considered, best first.
-- Rank 1 is the presented item, and its EIG equals session_question.expected_ig.
CREATE TABLE IF NOT EXISTS question_candidate (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_question_id uuid NOT NULL REFERENCES session_question ON DELETE RESTRICT,
 item_id uuid NOT NULL REFERENCES item ON DELETE RESTRICT,
 rank integer NOT NULL CHECK (rank >= 1),
 eig numeric NOT NULL CHECK (eig >= 0),
 UNIQUE (session_question_id, rank), UNIQUE (session_question_id, item_id)
);
CREATE TABLE IF NOT EXISTS session_step (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES diagnostic_session ON DELETE RESTRICT,
 step_index integer NOT NULL CHECK (step_index >= 0),
 session_question_id uuid NOT NULL UNIQUE REFERENCES session_question ON DELETE RESTRICT,
 answer_option_id uuid NOT NULL REFERENCES item_option ON DELETE RESTRICT,
 answered_at timestamptz NOT NULL DEFAULT now(), request_key text NOT NULL,
 calculation_ms numeric NOT NULL CHECK (calculation_ms >= 0),
 answer_note text NOT NULL CHECK (length(btrim(answer_note)) > 0),
 UNIQUE (session_id, step_index), UNIQUE (session_id, request_key)
 -- session_id/step_index deliberately mirror session_question for trace lookup (see plan section 5).
);
CREATE TABLE IF NOT EXISTS step_posterior (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 step_id uuid NOT NULL REFERENCES session_step ON DELETE RESTRICT,
 session_hypothesis_id uuid NOT NULL REFERENCES session_hypothesis ON DELETE RESTRICT,
 probability numeric NOT NULL CHECK (probability BETWEEN 0 AND 1),
 UNIQUE (step_id, session_hypothesis_id)
);
CREATE TABLE IF NOT EXISTS diagnosis (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL UNIQUE REFERENCES diagnostic_session ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS diagnosis_candidate (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 diagnosis_id uuid NOT NULL REFERENCES diagnosis ON DELETE RESTRICT,
 session_hypothesis_id uuid NOT NULL REFERENCES session_hypothesis ON DELETE RESTRICT,
 rank smallint NOT NULL CHECK (rank IN (1,2)),
 UNIQUE (diagnosis_id, rank), UNIQUE (diagnosis_id, session_hypothesis_id)
 -- Confidence is read from the last step's posterior, never copied here.
);
CREATE TABLE IF NOT EXISTS escalation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL UNIQUE REFERENCES diagnostic_session ON DELETE RESTRICT,
 reason text NOT NULL CHECK (length(btrim(reason)) > 0),
 leader_session_hypothesis_id uuid NOT NULL REFERENCES session_hypothesis ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
 -- The ceiling p(leader)/p(tied set) is derived from the last posterior, never stored.
);
CREATE TABLE IF NOT EXISTS escalation_candidate (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 escalation_id uuid NOT NULL REFERENCES escalation ON DELETE RESTRICT,
 session_hypothesis_id uuid NOT NULL REFERENCES session_hypothesis ON DELETE RESTRICT,
 rank smallint NOT NULL CHECK (rank >= 1),
 UNIQUE (escalation_id, rank), UNIQUE (escalation_id, session_hypothesis_id)
);
CREATE TABLE IF NOT EXISTS audit_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid REFERENCES app_user ON DELETE RESTRICT,
 event_type text NOT NULL, relation_name text NOT NULL, row_id uuid NOT NULL,
 request_key text, occurred_at timestamptz NOT NULL DEFAULT now(),
 detail jsonb NOT NULL DEFAULT '{}'::jsonb
 -- Opaque, redacted explanation only; never used for joins, access or workflow.
);

-- ------------------------------------------------------------------ guard functions
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN RAISE EXCEPTION '% is append-only/immutable', TG_TABLE_NAME; END $$;

CREATE OR REPLACE FUNCTION state_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE old_state text; new_state text;
BEGIN
 new_state := to_jsonb(NEW)->>TG_ARGV[0];
 IF TG_OP = 'INSERT' THEN
   IF NOT (new_state = ANY(string_to_array(TG_ARGV[1], ','))) THEN RAISE EXCEPTION 'Invalid initial % state %', TG_TABLE_NAME, new_state; END IF;
 ELSE
   old_state := to_jsonb(OLD)->>TG_ARGV[0];
   IF old_state <> new_state AND NOT ((old_state || '>' || new_state) = ANY(string_to_array(TG_ARGV[2], ',')))
   THEN RAISE EXCEPTION 'Illegal % transition % -> %', TG_TABLE_NAME, old_state, new_state; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION fixed_keys() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE col text;
BEGIN
 FOREACH col IN ARRAY TG_ARGV LOOP
  IF (to_jsonb(OLD)->col) IS DISTINCT FROM (to_jsonb(NEW)->col) THEN RAISE EXCEPTION 'Immutable key %.%', TG_TABLE_NAME, col; END IF;
 END LOOP;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION require_user_role(uid uuid, expected text[]) RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM app_user WHERE id = uid AND role = ANY(expected) AND status = 'active')
 THEN RAISE EXCEPTION 'Expected an active user with role %', expected; END IF;
END $$;

-- class_teacher must be a teacher; enrolment must be a student in an active class.
CREATE OR REPLACE FUNCTION membership_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.status IN ('departed','left') THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME = 'class_teacher' THEN PERFORM require_user_role(NEW.teacher_id, ARRAY['teacher']);
 ELSE
  PERFORM require_user_role(NEW.student_id, ARRAY['student']);
  IF NEW.status = 'active' AND NOT EXISTS (SELECT 1 FROM classroom WHERE id = NEW.class_id AND status = 'active')
  THEN RAISE EXCEPTION 'Cannot join an archived class'; END IF;
 END IF;
 RETURN NEW;
END $$;

-- Content rows change only while their pack is a draft, and item content (plus its
-- options, mappings and sources) only while the item itself is a draft.
CREATE OR REPLACE FUNCTION content_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE v uuid; row_data jsonb; item_key uuid; frozen text; item_state text; applying text;
BEGIN
 row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 IF TG_TABLE_NAME IN ('topic_revision','misconception_revision','hypothesis','diagnostic_unit') THEN v := (row_data->>'content_version_id')::uuid;
 ELSIF TG_TABLE_NAME IN ('unit_hypothesis','unit_item') THEN SELECT content_version_id INTO v FROM diagnostic_unit WHERE id = (row_data->>'unit_id')::uuid;
 ELSIF TG_TABLE_NAME IN ('topic_misconception','item') THEN SELECT content_version_id INTO v FROM topic_revision WHERE id = (row_data->>'topic_revision_id')::uuid;
 ELSIF TG_TABLE_NAME = 'misconception_source' THEN SELECT content_version_id INTO v FROM misconception_revision WHERE id = (row_data->>'misconception_revision_id')::uuid;
 ELSE
  IF TG_TABLE_NAME = 'option_misconception' THEN SELECT item_id INTO item_key FROM item_option WHERE id = (row_data->>'option_id')::uuid;
  ELSE item_key := (row_data->>'item_id')::uuid; END IF;
  SELECT t.content_version_id INTO v FROM item i JOIN topic_revision t ON t.id = i.topic_revision_id WHERE i.id = item_key;
 END IF;
 SELECT status INTO frozen FROM content_version WHERE id = v FOR UPDATE;
 IF frozen = 'frozen' THEN RAISE EXCEPTION 'Frozen content version is immutable'; END IF;
 IF TG_TABLE_NAME = 'item' AND TG_OP <> 'INSERT' THEN
  IF TG_OP = 'DELETE' AND OLD.review_status <> 'draft' THEN RAISE EXCEPTION 'Only draft items can be deleted'; END IF;
  IF TG_OP = 'UPDATE' THEN
   IF OLD.review_status IN ('in_review','approved') AND (to_jsonb(NEW) - 'review_status') <> (to_jsonb(OLD) - 'review_status')
   THEN RAISE EXCEPTION 'Item content is locked while in review or approved'; END IF;
   IF NEW.review_status <> OLD.review_status AND NEW.review_status IN ('approved','rejected') THEN
    applying := current_setting('sonder.applying_review', true);
    IF applying IS NULL OR applying = '' OR NOT EXISTS (SELECT 1 FROM item_review WHERE id = applying::uuid AND item_id = NEW.id AND decision = NEW.review_status)
    THEN RAISE EXCEPTION 'Approve or reject an item by inserting an item_review row'; END IF;
   END IF;
  END IF;
 END IF;
 IF item_key IS NOT NULL THEN
  SELECT review_status INTO item_state FROM item WHERE id = item_key FOR UPDATE;
  IF item_state IS DISTINCT FROM 'draft' AND NOT (TG_OP = 'DELETE' AND item_state IS NULL) THEN RAISE EXCEPTION 'Only a draft item''s options, mappings and sources can change'; END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

-- Every content association must stay inside one subject and one pack version.
CREATE OR REPLACE FUNCTION content_scope() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE a uuid; b uuid;
BEGIN
 IF TG_TABLE_NAME = 'topic_revision' THEN
  SELECT subject_id INTO a FROM topic WHERE id = NEW.topic_id;
  SELECT subject_id INTO b FROM content_version WHERE id = NEW.content_version_id;
 ELSIF TG_TABLE_NAME = 'misconception_revision' THEN
  SELECT subject_id INTO a FROM misconception WHERE id = NEW.misconception_id;
  SELECT subject_id INTO b FROM content_version WHERE id = NEW.content_version_id;
 ELSIF TG_TABLE_NAME = 'topic_misconception' THEN
  SELECT content_version_id INTO a FROM topic_revision WHERE id = NEW.topic_revision_id;
  SELECT content_version_id INTO b FROM misconception_revision WHERE id = NEW.misconception_revision_id;
 ELSIF TG_TABLE_NAME = 'item' THEN
  IF TG_OP = 'INSERT' THEN PERFORM require_user_role(NEW.author_id, ARRAY['admin','teacher']); END IF;
  SELECT content_version_id INTO a FROM topic_revision WHERE id = NEW.topic_revision_id;
  SELECT content_version_id INTO b FROM misconception_revision WHERE id = NEW.target_misconception_revision_id;
  IF EXISTS (SELECT 1 FROM item i JOIN topic_revision t ON t.id = i.topic_revision_id WHERE t.content_version_id = a AND i.external_id = NEW.external_id AND i.id <> NEW.id)
  THEN RAISE EXCEPTION 'Duplicate item external ID % in pack', NEW.external_id; END IF;
  IF NOT EXISTS (SELECT 1 FROM topic_misconception WHERE topic_revision_id = NEW.topic_revision_id AND misconception_revision_id = NEW.target_misconception_revision_id AND disposition = 'keep')
  THEN RAISE EXCEPTION 'Item target misconception is not kept in this topic'; END IF;
 ELSIF TG_TABLE_NAME = 'hypothesis' THEN
  IF NEW.misconception_revision_id IS NULL THEN RETURN NEW; END IF;
  a := NEW.content_version_id;
  SELECT content_version_id INTO b FROM misconception_revision WHERE id = NEW.misconception_revision_id;
 ELSIF TG_TABLE_NAME = 'unit_hypothesis' THEN
  IF NOT EXISTS (SELECT 1 FROM hypothesis WHERE id = NEW.hypothesis_id AND kind = 'misconception')
  THEN RAISE EXCEPTION 'A unit lists misconception hypotheses only (NONE and UNMODELLED are implicit)'; END IF;
  SELECT content_version_id INTO a FROM diagnostic_unit WHERE id = NEW.unit_id;
  SELECT content_version_id INTO b FROM hypothesis WHERE id = NEW.hypothesis_id AND kind = 'misconception';
 ELSIF TG_TABLE_NAME = 'unit_item' THEN
  SELECT content_version_id INTO a FROM diagnostic_unit WHERE id = NEW.unit_id;
  SELECT t.content_version_id INTO b FROM item i JOIN topic_revision t ON t.id = i.topic_revision_id WHERE i.id = NEW.item_id;
 ELSE -- option_misconception
  SELECT t.content_version_id INTO a FROM item_option o JOIN item i ON i.id = o.item_id JOIN topic_revision t ON t.id = i.topic_revision_id WHERE o.id = NEW.option_id;
  SELECT content_version_id INTO b FROM misconception_revision WHERE id = NEW.misconception_revision_id;
 END IF;
 IF a IS NULL OR a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Content subject/version mismatch on %', TG_TABLE_NAME; END IF;
 RETURN NEW;
END $$;

-- Deferred: at commit every item has exactly four options, exactly one correct, no link on
-- the correct option, and at most three misconceptions per wrong option. Spec v2 rule V11 (a
-- misconception on at most 3 options of an item) always holds here: only three options can carry
-- links. The real limit is P1, checked when a response model is frozen (response_guard).
CREATE OR REPLACE FUNCTION item_integrity() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE k uuid; n integer; correct integer;
BEGIN
 IF TG_TABLE_NAME = 'item' THEN k := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
 ELSIF TG_TABLE_NAME = 'item_option' THEN k := CASE WHEN TG_OP = 'DELETE' THEN OLD.item_id ELSE NEW.item_id END;
 ELSE SELECT item_id INTO k FROM item_option WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.option_id ELSE NEW.option_id END; END IF;
 IF k IS NULL OR NOT EXISTS (SELECT 1 FROM item WHERE id = k) THEN RETURN NULL; END IF;
 SELECT count(*), count(*) FILTER (WHERE is_correct) INTO n, correct FROM item_option WHERE item_id = k;
 IF n <> 4 OR correct <> 1 THEN RAISE EXCEPTION 'Item % needs exactly four options and one correct option', k; END IF;
 IF EXISTS (SELECT 1 FROM item_option o JOIN option_misconception m ON m.option_id = o.id WHERE o.item_id = k GROUP BY o.id, o.is_correct HAVING count(*) > 3 OR o.is_correct)
 THEN RAISE EXCEPTION 'Item %: correct option has a misconception link, or a wrong option has more than three', k; END IF;
 RETURN NULL;
END $$;

-- A review is a recorded event: active teacher/admin, never the item's author, next round,
-- item currently in review. Inserting it moves the item to approved/rejected.
CREATE OR REPLACE FUNCTION item_review_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE it item; pack_state text;
BEGIN
 SELECT * INTO it FROM item WHERE id = NEW.item_id FOR UPDATE;
 SELECT c.status INTO pack_state FROM topic_revision t JOIN content_version c ON c.id = t.content_version_id WHERE t.id = it.topic_revision_id;
 PERFORM require_user_role(NEW.reviewer_id, ARRAY['admin','teacher']);
 IF it.review_status <> 'in_review' OR pack_state <> 'draft' THEN RAISE EXCEPTION 'Only an in-review item in a draft pack can be reviewed'; END IF;
 IF NEW.reviewer_id = it.author_id THEN RAISE EXCEPTION 'An item cannot be reviewed by its author'; END IF;
 IF NEW.review_round <> (SELECT count(*) + 1 FROM item_review WHERE item_id = NEW.item_id) THEN RAISE EXCEPTION 'review_round must be the next round number'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION item_review_apply() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
 PERFORM set_config('sonder.applying_review', NEW.id::text, true);
 UPDATE item SET review_status = NEW.decision WHERE id = NEW.item_id;
 PERFORM set_config('sonder.applying_review', '', true);
 RETURN NULL;
END $$;

-- Freezing a pack is the gate between authoring and live use.
CREATE OR REPLACE FUNCTION freeze_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Content versions are retained'; END IF;
 IF OLD.status = 'frozen' THEN RAISE EXCEPTION 'Frozen version is immutable'; END IF;
 IF NEW.status = 'frozen' THEN
  IF NOT EXISTS (SELECT 1 FROM item i JOIN topic_revision t ON t.id = i.topic_revision_id WHERE t.content_version_id = NEW.id AND i.review_status = 'approved')
  THEN RAISE EXCEPTION 'Cannot freeze a pack with no approved items'; END IF;
  IF EXISTS (SELECT 1 FROM item i JOIN topic_revision t ON t.id = i.topic_revision_id WHERE t.content_version_id = NEW.id AND i.review_status NOT IN ('approved','rejected'))
  THEN RAISE EXCEPTION 'Cannot freeze: items still draft or in review'; END IF;
  IF EXISTS (SELECT 1 FROM item i JOIN topic_revision t ON t.id = i.topic_revision_id WHERE t.content_version_id = NEW.id AND i.review_status = 'approved' AND i.origin = 'curated' AND NOT EXISTS (SELECT 1 FROM item_source s WHERE s.item_id = i.id))
  THEN RAISE EXCEPTION 'Cannot freeze: a curated approved item has no source'; END IF;
  IF (SELECT count(*) FROM hypothesis WHERE content_version_id = NEW.id AND kind IN ('none','unmodelled')) <> 2
  THEN RAISE EXCEPTION 'Cannot freeze: pack needs the NONE and UNMODELLED hypotheses'; END IF;
  IF EXISTS (SELECT 1 FROM item i JOIN topic_revision t ON t.id = i.topic_revision_id JOIN misconception_revision m ON m.id = i.target_misconception_revision_id WHERE t.content_version_id = NEW.id AND i.review_status = 'approved' AND (m.status <> 'validated' OR m.engine_tier <> 1))
  THEN RAISE EXCEPTION 'Cannot freeze: an approved item targets a misconception that is not engine-ready'; END IF;
  IF EXISTS (SELECT 1 FROM hypothesis h JOIN misconception_revision m ON m.id = h.misconception_revision_id WHERE h.content_version_id = NEW.id AND (m.status <> 'validated' OR m.engine_tier <> 1))
  THEN RAISE EXCEPTION 'Cannot freeze: a hypothesis uses a misconception that is not engine-ready'; END IF;
  IF EXISTS (SELECT 1 FROM topic_misconception x JOIN topic_revision t ON t.id = x.topic_revision_id WHERE t.content_version_id = NEW.id AND x.membership = 'cross_topic'
             AND NOT EXISTS (SELECT 1 FROM topic_misconception h WHERE h.misconception_revision_id = x.misconception_revision_id AND h.membership = 'home'))
  THEN RAISE EXCEPTION 'Cannot freeze: a cross-topic misconception has no home topic in the pack'; END IF;
  IF NOT EXISTS (SELECT 1 FROM diagnostic_unit WHERE content_version_id = NEW.id)
  THEN RAISE EXCEPTION 'Cannot freeze: the pack declares no diagnostic unit'; END IF;
  IF EXISTS (SELECT 1 FROM diagnostic_unit u WHERE u.content_version_id = NEW.id AND (
       NOT EXISTS (SELECT 1 FROM unit_hypothesis WHERE unit_id = u.id)
       OR (SELECT min(slot) <> 0 OR max(slot) <> count(*) - 1 FROM unit_hypothesis WHERE unit_id = u.id)
       OR NOT EXISTS (SELECT 1 FROM unit_item WHERE unit_id = u.id)
       OR (SELECT min(position) <> 0 OR max(position) <> count(*) - 1 FROM unit_item WHERE unit_id = u.id)))
  THEN RAISE EXCEPTION 'Cannot freeze: every unit needs hypotheses in slots 0..k-1 and items in positions 0..n-1'; END IF;
  IF EXISTS (SELECT 1 FROM unit_item ui JOIN diagnostic_unit u ON u.id = ui.unit_id JOIN item i ON i.id = ui.item_id
             WHERE u.content_version_id = NEW.id AND i.review_status <> 'approved')
  THEN RAISE EXCEPTION 'Cannot freeze: a unit contains an item that is not approved'; END IF;
  -- V5': every misconception linked on a unit's item is one of that unit's hypotheses.
  IF EXISTS (SELECT 1 FROM unit_item ui JOIN diagnostic_unit u ON u.id = ui.unit_id
             JOIN item_option o ON o.item_id = ui.item_id JOIN option_misconception om ON om.option_id = o.id
             WHERE u.content_version_id = NEW.id
               AND NOT EXISTS (SELECT 1 FROM unit_hypothesis uh JOIN hypothesis h ON h.id = uh.hypothesis_id
                               WHERE uh.unit_id = u.id AND h.misconception_revision_id = om.misconception_revision_id))
  THEN RAISE EXCEPTION 'Cannot freeze: a unit item links a misconception outside the unit (rule V5'')'; END IF;
 END IF;
 RETURN NEW;
END $$;

-- Response model: edited only while draft; frozen only when complete and normalised.
CREATE OR REPLACE FUNCTION response_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE v uuid; a uuid; r uuid; prm engine_params; maxk integer; maxs integer;
BEGIN
 IF TG_TABLE_NAME = 'response_model' THEN
  IF TG_OP = 'DELETE' OR OLD.status = 'frozen' THEN RAISE EXCEPTION 'Response model is retained/immutable once frozen'; END IF;
  IF NEW.status = 'frozen' THEN
   IF NOT EXISTS (SELECT 1 FROM content_version WHERE id = NEW.content_version_id AND status = 'frozen') THEN RAISE EXCEPTION 'Freeze the content version first'; END IF;
   IF EXISTS (SELECT 1 FROM response_probability p JOIN item_option o ON o.id = p.option_id WHERE p.response_model_id = NEW.id GROUP BY o.item_id, p.hypothesis_id HAVING count(*) <> 4 OR abs(sum(p.probability) - 1) > 0.000000001)
   THEN RAISE EXCEPTION 'Each item/hypothesis needs four option probabilities summing to 1'; END IF;
   IF EXISTS (SELECT 1 FROM item i JOIN topic_revision t ON t.id = i.topic_revision_id CROSS JOIN hypothesis h WHERE t.content_version_id = NEW.content_version_id AND h.content_version_id = NEW.content_version_id AND i.review_status = 'approved'
              AND NOT EXISTS (SELECT 1 FROM response_probability p JOIN item_option o ON o.id = p.option_id WHERE p.response_model_id = NEW.id AND o.item_id = i.id AND p.hypothesis_id = h.id))
   THEN RAISE EXCEPTION 'Response model does not cover every approved item and hypothesis'; END IF;
   SELECT * INTO prm FROM engine_params WHERE id = NEW.engine_params_id;
   SELECT max(k) INTO maxk FROM (SELECT count(*) AS k FROM unit_hypothesis uh JOIN diagnostic_unit u ON u.id = uh.unit_id
                                 WHERE u.content_version_id = NEW.content_version_id GROUP BY uh.unit_id) x;
   IF maxk > prm.k_max THEN RAISE EXCEPTION 'A unit has % hypotheses; engine_params.k_max is %', maxk, prm.k_max; END IF;
   -- P1 (spec v2 3.6): for every predicted-set size s used by a unit item, guess < (4 - s) / 4.
   SELECT max(n) INTO maxs FROM (SELECT count(*) AS n FROM unit_item ui JOIN diagnostic_unit u ON u.id = ui.unit_id
                                 JOIN item_option o ON o.item_id = ui.item_id JOIN option_misconception om ON om.option_id = o.id
                                 WHERE u.content_version_id = NEW.content_version_id GROUP BY ui.unit_id, ui.item_id, om.misconception_revision_id) y;
   IF maxs IS NOT NULL AND prm.guess >= (4 - maxs) / 4.0
   THEN RAISE EXCEPTION 'P1 fails: a unit item links one misconception to % options, which needs guess < %, but guess is %', maxs, (4 - maxs) / 4.0, prm.guess; END IF;
  END IF;
  RETURN NEW;
 END IF;
 r := CASE WHEN TG_OP = 'DELETE' THEN OLD.response_model_id ELSE NEW.response_model_id END;
 SELECT content_version_id INTO v FROM response_model WHERE id = r AND status = 'draft' FOR SHARE;
 IF v IS NULL THEN RAISE EXCEPTION 'Response model is frozen or missing'; END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 SELECT content_version_id INTO a FROM hypothesis WHERE id = NEW.hypothesis_id;
 IF a IS DISTINCT FROM v THEN RAISE EXCEPTION 'Hypothesis belongs to another pack'; END IF;
 IF TG_TABLE_NAME = 'response_probability' THEN
  SELECT t.content_version_id INTO a FROM item_option o JOIN item i ON i.id = o.item_id JOIN topic_revision t ON t.id = i.topic_revision_id WHERE o.id = NEW.option_id;
  IF a IS DISTINCT FROM v THEN RAISE EXCEPTION 'Option belongs to another pack'; END IF;
 END IF;
 RETURN NEW;
END $$;

-- Session writes: valid class context, frozen model, ordered append-only steps.
CREATE OR REPLACE FUNCTION session_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE s diagnostic_session; q session_question; v uuid; a uuid; e enrolment; sub uuid;
BEGIN
 IF TG_TABLE_NAME = 'diagnostic_session' THEN
  IF TG_OP = 'UPDATE' AND OLD.status <> 'in_progress' THEN RAISE EXCEPTION 'A finished session is immutable'; END IF;
  SELECT * INTO e FROM enrolment WHERE id = NEW.enrolment_id;
  SELECT r.content_version_id, c.subject_id INTO v, sub FROM response_model r JOIN content_version c ON c.id = r.content_version_id WHERE r.id = NEW.response_model_id AND r.status = 'frozen';
  IF v IS NULL THEN RAISE EXCEPTION 'A session requires a frozen response model'; END IF;
  IF TG_OP = 'INSERT' THEN
   PERFORM require_user_role(e.student_id, ARRAY['student']);
   IF e.status <> 'active' OR NOT EXISTS (SELECT 1 FROM classroom WHERE id = e.class_id AND status = 'active')
      OR NOT EXISTS (SELECT 1 FROM class_subject WHERE class_id = e.class_id AND subject_id = sub)
   THEN RAISE EXCEPTION 'Session needs an active enrolment in an active class that teaches this subject'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM diagnostic_unit WHERE id = NEW.unit_id AND content_version_id = v)
  THEN RAISE EXCEPTION 'Session unit is outside the session pack'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO s FROM diagnostic_session WHERE id = NEW.session_id FOR UPDATE;
 SELECT content_version_id INTO v FROM response_model WHERE id = s.response_model_id;
 IF TG_TABLE_NAME = 'session_question' THEN
  IF s.status <> 'in_progress' OR NEW.step_index <> (SELECT count(*) FROM session_step WHERE session_id = s.id) OR NEW.step_index >= s.question_budget
  THEN RAISE EXCEPTION 'Invalid next question index or budget exhausted'; END IF;
  IF EXISTS (SELECT 1 FROM session_question q0 WHERE q0.session_id = s.id AND NOT EXISTS (SELECT 1 FROM session_step t WHERE t.session_question_id = q0.id))
  THEN RAISE EXCEPTION 'The previous question is still awaiting an answer'; END IF;
  IF NOT EXISTS (SELECT 1 FROM item i JOIN unit_item ui ON ui.item_id = i.id WHERE i.id = NEW.item_id AND ui.unit_id = s.unit_id AND i.review_status = 'approved')
  THEN RAISE EXCEPTION 'Question is not an approved item of this session''s unit'; END IF;
  IF EXISTS (SELECT 1 FROM session_question q0 JOIN item i0 ON i0.id = q0.item_id JOIN item i1 ON i1.id = NEW.item_id
             WHERE q0.session_id = s.id AND i1.twin_group IS NOT NULL AND i0.twin_group = i1.twin_group)
  THEN RAISE EXCEPTION 'A twin of this item (same twin group) was already shown in this session'; END IF;
 ELSIF TG_TABLE_NAME = 'session_step' THEN
  SELECT * INTO q FROM session_question WHERE id = NEW.session_question_id;
  SELECT item_id INTO a FROM item_option WHERE id = NEW.answer_option_id;
  IF s.status <> 'in_progress' OR q.session_id IS DISTINCT FROM s.id OR q.step_index IS DISTINCT FROM NEW.step_index OR a IS DISTINCT FROM q.item_id
     OR NEW.step_index <> (SELECT count(*) FROM session_step WHERE session_id = s.id) OR NEW.answered_at < q.presented_at
  THEN RAISE EXCEPTION 'Invalid step or answer'; END IF;
 ELSIF TG_TABLE_NAME = 'session_hypothesis' THEN
  IF s.status <> 'in_progress' OR EXISTS (SELECT 1 FROM session_question WHERE session_id = s.id)
     OR NOT EXISTS (SELECT 1 FROM hypothesis h WHERE h.id = NEW.hypothesis_id AND h.content_version_id = v
                    AND (h.kind <> 'misconception' OR EXISTS (SELECT 1 FROM unit_hypothesis uh WHERE uh.unit_id = s.unit_id AND uh.hypothesis_id = h.id)))
  THEN RAISE EXCEPTION 'Priors must be set from the session unit''s hypotheses before the first question'; END IF;
 ELSIF TG_TABLE_NAME = 'diagnosis' THEN
  IF s.status <> 'diagnosed' THEN RAISE EXCEPTION 'A diagnosis needs a diagnosed session'; END IF;
 ELSIF TG_TABLE_NAME = 'escalation' THEN
  IF s.status NOT LIKE 'escalated_%' THEN RAISE EXCEPTION 'An escalation needs a refused (escalated_*) session'; END IF;
  IF NOT EXISTS (SELECT 1 FROM session_hypothesis WHERE id = NEW.leader_session_hypothesis_id AND session_id = s.id)
  THEN RAISE EXCEPTION 'The escalation leader must be one of this session''s hypotheses'; END IF;
 END IF;
 RETURN NEW;
END $$;

-- A ranked candidate is an approved item of the session's pack/topic, written while its
-- question is still pending, never an item (or a twin of an item) shown at an earlier step.
CREATE OR REPLACE FUNCTION candidate_scope() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE q session_question; s diagnostic_session; v uuid;
BEGIN
 SELECT * INTO q FROM session_question WHERE id = NEW.session_question_id;
 SELECT * INTO s FROM diagnostic_session WHERE id = q.session_id FOR UPDATE;
 SELECT content_version_id INTO v FROM response_model WHERE id = s.response_model_id;
 IF s.status <> 'in_progress' OR EXISTS (SELECT 1 FROM session_step WHERE session_question_id = q.id)
 THEN RAISE EXCEPTION 'Candidates are recorded only for the pending question of a running session'; END IF;
 IF NOT EXISTS (SELECT 1 FROM item i JOIN unit_item ui ON ui.item_id = i.id WHERE i.id = NEW.item_id AND ui.unit_id = s.unit_id AND i.review_status = 'approved')
 THEN RAISE EXCEPTION 'Candidate is not an approved item of this session''s unit'; END IF;
 IF EXISTS (SELECT 1 FROM session_question q0 JOIN item i0 ON i0.id = q0.item_id JOIN item i1 ON i1.id = NEW.item_id
            WHERE q0.session_id = s.id AND q0.step_index < q.step_index AND (q0.item_id = NEW.item_id OR (i1.twin_group IS NOT NULL AND i0.twin_group = i1.twin_group)))
 THEN RAISE EXCEPTION 'Candidate (or its twin) was already shown earlier in this session'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION evidence_scope() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE a uuid; b uuid;
BEGIN
 IF TG_TABLE_NAME = 'step_posterior' THEN SELECT session_id INTO a FROM session_step WHERE id = NEW.step_id;
 ELSIF TG_TABLE_NAME = 'diagnosis_candidate' THEN SELECT session_id INTO a FROM diagnosis WHERE id = NEW.diagnosis_id;
 ELSE SELECT session_id INTO a FROM escalation WHERE id = NEW.escalation_id; END IF;
 SELECT session_id INTO b FROM session_hypothesis WHERE id = NEW.session_hypothesis_id;
 IF a IS NULL OR a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Evidence row refers to another session''s hypothesis'; END IF;
 RETURN NEW;
END $$;

-- Deferred: at commit the stored trace of a session is complete and normalised.
CREATE OR REPLACE FUNCTION trace_complete() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE sid uuid; st diagnostic_session; n integer; p numeric; stepkey uuid; hcount integer; prm engine_params; qk session_question; esc escalation;
BEGIN
 IF TG_TABLE_NAME = 'diagnostic_session' THEN sid := NEW.id;
 ELSIF TG_TABLE_NAME = 'question_candidate' THEN SELECT session_id INTO sid FROM session_question WHERE id = NEW.session_question_id;
 ELSIF TG_TABLE_NAME IN ('session_question','session_step','session_hypothesis','diagnosis','escalation') THEN sid := NEW.session_id;
 ELSIF TG_TABLE_NAME = 'step_posterior' THEN SELECT session_id INTO sid FROM session_step WHERE id = NEW.step_id;
 ELSIF TG_TABLE_NAME = 'diagnosis_candidate' THEN SELECT d.session_id INTO sid FROM diagnosis d WHERE d.id = NEW.diagnosis_id;
 ELSE SELECT e.session_id INTO sid FROM escalation e WHERE e.id = NEW.escalation_id; END IF;
 SELECT * INTO st FROM diagnostic_session WHERE id = sid;
 IF EXISTS (SELECT 1 FROM session_question WHERE session_id = sid) THEN
  SELECT count(*), sum(prior_probability) INTO hcount, p FROM session_hypothesis WHERE session_id = sid;
  IF hcount < 2 OR abs(coalesce(p, 0) - 1) > 0.000000001 THEN RAISE EXCEPTION 'Session prior is missing or does not sum to 1'; END IF;
  IF (SELECT count(*) FROM session_hypothesis sh JOIN hypothesis h ON h.id = sh.hypothesis_id WHERE sh.session_id = sid AND h.kind IN ('none','unmodelled')) <> 2
  THEN RAISE EXCEPTION 'Session prior lacks the NONE and UNMODELLED hypotheses'; END IF;
  -- Slots: misconceptions 0..k-1, NONE = k, UNMODELLED = k+1 (spec 5.0 hypothesis order).
  IF (SELECT min(slot) <> 0 OR max(slot) <> hcount - 1 FROM session_hypothesis WHERE session_id = sid)
     OR NOT EXISTS (SELECT 1 FROM session_hypothesis sh JOIN hypothesis h ON h.id = sh.hypothesis_id WHERE sh.session_id = sid AND h.kind = 'none' AND sh.slot = hcount - 2)
     OR NOT EXISTS (SELECT 1 FROM session_hypothesis sh JOIN hypothesis h ON h.id = sh.hypothesis_id WHERE sh.session_id = sid AND h.kind = 'unmodelled' AND sh.slot = hcount - 1)
  THEN RAISE EXCEPTION 'Hypothesis slots must be 0..k-1 for misconceptions, then NONE, then UNMODELLED'; END IF;
  IF hcount <> (SELECT count(*) FROM unit_hypothesis WHERE unit_id = st.unit_id) + 2
     OR EXISTS (SELECT 1 FROM session_hypothesis sh JOIN hypothesis h ON h.id = sh.hypothesis_id WHERE sh.session_id = sid AND h.kind = 'misconception'
                AND NOT EXISTS (SELECT 1 FROM unit_hypothesis uh WHERE uh.unit_id = st.unit_id AND uh.hypothesis_id = sh.hypothesis_id AND uh.slot = sh.slot))
  THEN RAISE EXCEPTION 'Run hypotheses must be exactly the unit''s list, in the unit''s order'; END IF;
  -- Reserved prior masses come from the pinned engine parameters.
  SELECT ep.* INTO prm FROM response_model r JOIN engine_params ep ON ep.id = r.engine_params_id WHERE r.id = st.response_model_id;
  IF EXISTS (SELECT 1 FROM session_hypothesis sh JOIN hypothesis h ON h.id = sh.hypothesis_id WHERE sh.session_id = sid
             AND ((h.kind = 'none' AND abs(sh.prior_probability - prm.prior_none) > 0.000000001)
               OR (h.kind = 'unmodelled' AND abs(sh.prior_probability - prm.prior_unmodelled) > 0.000000001)))
  THEN RAISE EXCEPTION 'NONE/UNMODELLED priors differ from the pinned engine parameters'; END IF;
  -- Every presentation carries its ranked candidates; rank 1 is the presented item.
  FOR qk IN SELECT * FROM session_question WHERE session_id = sid LOOP
   SELECT count(*) INTO n FROM question_candidate WHERE session_question_id = qk.id;
   IF n = 0 OR (SELECT max(rank) FROM question_candidate WHERE session_question_id = qk.id) <> n
   THEN RAISE EXCEPTION 'Question % needs a complete candidate ranking 1..n', qk.step_index; END IF;
   IF NOT EXISTS (SELECT 1 FROM question_candidate WHERE session_question_id = qk.id AND rank = 1 AND item_id = qk.item_id AND abs(eig - qk.expected_ig) <= 0.000000001)
   THEN RAISE EXCEPTION 'Rank 1 candidate must be the presented item with its expected_ig'; END IF;
   IF EXISTS (SELECT 1 FROM question_candidate a JOIN question_candidate b ON b.session_question_id = a.session_question_id AND b.rank = a.rank + 1
              WHERE a.session_question_id = qk.id AND b.eig > a.eig + 0.000000001)
   THEN RAISE EXCEPTION 'Candidate ranking must be in non-increasing EIG order'; END IF;
   -- Exact EIG ties go to the earliest item in pack order (the unit's item positions).
   IF EXISTS (SELECT 1 FROM question_candidate a JOIN question_candidate b ON b.session_question_id = a.session_question_id AND b.rank = a.rank + 1
              JOIN unit_item ua ON ua.unit_id = st.unit_id AND ua.item_id = a.item_id
              JOIN unit_item ub ON ub.unit_id = st.unit_id AND ub.item_id = b.item_id
              WHERE a.session_question_id = qk.id AND a.eig = b.eig AND ua.position > ub.position)
   THEN RAISE EXCEPTION 'Candidates with equal EIG must be ranked in pack order (unit_item.position)'; END IF;
  END LOOP;
  FOR stepkey IN SELECT id FROM session_step WHERE session_id = sid LOOP
   SELECT count(*), sum(probability) INTO n, p FROM step_posterior WHERE step_id = stepkey;
   IF n <> hcount OR abs(coalesce(p, 0) - 1) > 0.000000001 THEN RAISE EXCEPTION 'Posterior after an answer is incomplete or does not sum to 1'; END IF;
  END LOOP;
 END IF;
 IF st.status = 'diagnosed' AND NOT EXISTS (SELECT 1 FROM diagnosis d JOIN diagnosis_candidate c ON c.diagnosis_id = d.id JOIN session_hypothesis sh ON sh.id = c.session_hypothesis_id JOIN hypothesis h ON h.id = sh.hypothesis_id WHERE d.session_id = sid AND c.rank = 1 AND h.kind = 'misconception')
 THEN RAISE EXCEPTION 'A diagnosed session needs a rank-1 misconception candidate'; END IF;
 IF st.status LIKE 'escalated_%' AND NOT EXISTS (SELECT 1 FROM escalation WHERE session_id = sid) THEN RAISE EXCEPTION 'A refused session needs an escalation row'; END IF;
 SELECT * INTO esc FROM escalation WHERE session_id = sid;
 IF esc.id IS NOT NULL THEN
  SELECT count(*) INTO n FROM escalation_candidate WHERE escalation_id = esc.id;
  IF n > 0 AND ((SELECT max(rank) FROM escalation_candidate WHERE escalation_id = esc.id) <> n
                OR NOT EXISTS (SELECT 1 FROM escalation_candidate WHERE escalation_id = esc.id AND session_hypothesis_id = esc.leader_session_hypothesis_id))
  THEN RAISE EXCEPTION 'Escalation candidates must be ranked 1..n and include the leader'; END IF;
  IF st.status = 'escalated_no_separator' AND n < 2 THEN RAISE EXCEPTION 'A no-separator refusal needs a tied set of at least two'; END IF;
 END IF;
 IF st.status NOT IN ('in_progress','abandoned') AND EXISTS (SELECT 1 FROM session_question q WHERE q.session_id = sid AND NOT EXISTS (SELECT 1 FROM session_step t WHERE t.session_question_id = q.id))
 THEN RAISE EXCEPTION 'A finished session has an unanswered question'; END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION record_audit() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
DECLARE r jsonb; actor uuid;
BEGIN
 r := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 actor := nullif(current_setting('sonder.actor_id', true), '')::uuid;
 INSERT INTO audit_event (actor_id, event_type, relation_name, row_id, request_key, detail)
 VALUES (actor,
         CASE WHEN TG_TABLE_NAME IN ('content_version','response_model') AND TG_OP = 'UPDATE' AND r->>'status' = 'frozen' AND (to_jsonb(OLD)->>'status') <> 'frozen' THEN 'frozen' ELSE TG_OP END,
         TG_TABLE_NAME, (r->>'id')::uuid, nullif(current_setting('sonder.request_key', true), ''), '{}'::jsonb);
 -- Never copy passwords, tokens or names into an audit payload.
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;

-- ------------------------------------------------------------------ triggers
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['class_teacher','enrolment'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER membership_check BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION membership_guard()', t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['topic_revision','misconception_revision','topic_misconception','item','item_option','option_misconception','item_source','misconception_source','hypothesis','diagnostic_unit','unit_hypothesis','unit_item'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER a_content_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION content_guard()', t);
  EXECUTE format('CREATE OR REPLACE TRIGGER b_fixed_keys BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fixed_keys(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)', t,
                 'id','content_version_id','item_id','option_id','topic_revision_id','misconception_revision_id','topic_id','misconception_id','author_id','unit_id','hypothesis_id');
 END LOOP;
 FOREACH t IN ARRAY ARRAY['topic_revision','misconception_revision','topic_misconception','item','hypothesis','option_misconception','unit_hypothesis','unit_item'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER c_scope BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION content_scope()', t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['item','item_option','option_misconception'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = format('sonder.%I', t)::regclass AND tgname = 'item_cardinality') THEN
   EXECUTE format('CREATE CONSTRAINT TRIGGER item_cardinality AFTER INSERT OR UPDATE OR DELETE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION item_integrity()', t);
  END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['subject','topic','misconception','source_reference','engine_release','engine_params','item_review','session_question','question_candidate','session_step','session_hypothesis','step_posterior','diagnosis','diagnosis_candidate','escalation','escalation_candidate','audit_event'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_mutation()', t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['diagnostic_session','session_question','session_step','session_hypothesis','diagnosis','escalation'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER scope_check BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION session_guard()', t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['step_posterior','diagnosis_candidate','escalation_candidate'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER scope_check BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION evidence_scope()', t);
 END LOOP;
 EXECUTE 'CREATE OR REPLACE TRIGGER scope_check BEFORE INSERT ON question_candidate FOR EACH ROW EXECUTE FUNCTION candidate_scope()';
 FOREACH t IN ARRAY ARRAY['response_parameter','response_probability'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER response_check BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION response_guard()', t);
  EXECUTE format('CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fixed_keys(%L,%L,%L,%L)', t, 'id','response_model_id','hypothesis_id','option_id');
 END LOOP;
 FOREACH t IN ARRAY ARRAY['diagnostic_session','session_question','question_candidate','session_step','session_hypothesis','step_posterior','diagnosis','diagnosis_candidate','escalation','escalation_candidate'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = format('sonder.%I', t)::regclass AND tgname = 'trace_complete') THEN
   EXECUTE format('CREATE CONSTRAINT TRIGGER trace_complete AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION trace_complete()', t);
  END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['app_user','classroom','class_teacher','enrolment','content_version','item','item_option','option_misconception','item_review','engine_params','response_model','diagnostic_session'] LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION record_audit()', t);
 END LOOP;
END $$;
CREATE OR REPLACE TRIGGER review_check BEFORE INSERT ON item_review FOR EACH ROW EXECUTE FUNCTION item_review_guard();
CREATE OR REPLACE TRIGGER review_apply AFTER INSERT ON item_review FOR EACH ROW EXECUTE FUNCTION item_review_apply();
CREATE OR REPLACE TRIGGER frozen BEFORE UPDATE OR DELETE ON content_version FOR EACH ROW EXECUTE FUNCTION freeze_guard();
CREATE OR REPLACE TRIGGER frozen BEFORE UPDATE OR DELETE ON response_model FOR EACH ROW EXECUTE FUNCTION response_guard();
CREATE OR REPLACE TRIGGER session_scope BEFORE UPDATE ON diagnostic_session FOR EACH ROW EXECUTE FUNCTION session_guard();
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON diagnostic_session FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','enrolment_id','response_model_id','engine_release_id','unit_id','question_budget','request_key','started_at');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON class_teacher FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','class_id','teacher_id','assigned_at');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON enrolment FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','class_id','student_id','joined_at');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON response_model FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','content_version_id','engine_params_id','model_code','source','calibration_note','created_at');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON content_version FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','subject_id','version_code','created_at');
CREATE OR REPLACE TRIGGER fixed_keys BEFORE UPDATE ON app_user FOR EACH ROW EXECUTE FUNCTION fixed_keys('id','role','created_at');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON app_user FOR EACH ROW EXECUTE FUNCTION state_guard('status','active','active>deactivated,deactivated>active');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON classroom FOR EACH ROW EXECUTE FUNCTION state_guard('status','active','active>archived,archived>active');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON class_teacher FOR EACH ROW EXECUTE FUNCTION state_guard('status','active','active>departed,departed>active');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON enrolment FOR EACH ROW EXECUTE FUNCTION state_guard('status','active','active>left,left>active');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON content_version FOR EACH ROW EXECUTE FUNCTION state_guard('status','draft','draft>frozen');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON misconception_revision FOR EACH ROW EXECUTE FUNCTION state_guard('status','pending,validated,catalogued_only','pending>validated,pending>catalogued_only,catalogued_only>pending,validated>retired,pending>retired,catalogued_only>retired');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON item FOR EACH ROW EXECUTE FUNCTION state_guard('review_status','draft','draft>in_review,in_review>approved,in_review>rejected,rejected>draft');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON response_model FOR EACH ROW EXECUTE FUNCTION state_guard('status','draft','draft>frozen');
CREATE OR REPLACE TRIGGER state BEFORE INSERT OR UPDATE ON diagnostic_session FOR EACH ROW EXECUTE FUNCTION state_guard('status','in_progress','in_progress>diagnosed,in_progress>none_detected,in_progress>escalated_no_separator,in_progress>escalated_exhausted,in_progress>escalated_unmodelled,in_progress>abandoned');

-- ------------------------------------------------------------------ indexes (each serves a named query; see plan section 6)
CREATE INDEX IF NOT EXISTS auth_session_user_idx ON auth_session (user_id, expires_at);
CREATE INDEX IF NOT EXISTS teacher_classes_idx ON class_teacher (teacher_id, class_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS student_classes_idx ON enrolment (student_id, class_id);
CREATE INDEX IF NOT EXISTS misconception_catalogue_idx ON misconception_revision (content_version_id, status);
CREATE INDEX IF NOT EXISTS item_topic_idx ON item (topic_revision_id, review_status);
CREATE INDEX IF NOT EXISTS item_target_idx ON item (target_misconception_revision_id, review_status);
CREATE INDEX IF NOT EXISTS option_mapping_reverse_idx ON option_misconception (misconception_revision_id, option_id);
CREATE INDEX IF NOT EXISTS session_roster_idx ON diagnostic_session (enrolment_id, started_at DESC);
CREATE INDEX IF NOT EXISTS session_outcome_idx ON diagnostic_session (status, started_at) WHERE status <> 'in_progress';
CREATE INDEX IF NOT EXISTS audit_time_idx ON audit_event (occurred_at, event_type);
CREATE UNIQUE INDEX IF NOT EXISTS topic_misconception_home_idx ON topic_misconception (misconception_revision_id) WHERE membership = 'home';

-- ------------------------------------------------------------------ derived trace view
-- Support ("answers behind", spec 5.3) after each answered step, per session hypothesis. It is
-- fully determined by stored answers and frozen links, so it is a view, not a stored copy.
CREATE OR REPLACE VIEW step_support AS
SELECT st.id AS step_id, st.session_id, st.step_index, sh.id AS session_hypothesis_id, sh.slot,
       (SELECT count(*) FROM session_step t JOIN item_option o ON o.id = t.answer_option_id
        WHERE t.session_id = st.session_id AND t.step_index <= st.step_index
          AND CASE h.kind
                WHEN 'misconception' THEN EXISTS (SELECT 1 FROM option_misconception om WHERE om.option_id = o.id AND om.misconception_revision_id = h.misconception_revision_id)
                WHEN 'none' THEN o.is_correct
                ELSE NOT o.is_correct AND NOT EXISTS (SELECT 1 FROM option_misconception om WHERE om.option_id = o.id)
              END)::integer AS support
FROM session_step st JOIN session_hypothesis sh ON sh.session_id = st.session_id JOIN hypothesis h ON h.id = sh.hypothesis_id;

REVOKE ALL ON ALL TABLES IN SCHEMA sonder FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sonder FROM PUBLIC;

-- ------------------------------------------------------------------ self-verification (rolls everything back on failure)
DO $$
DECLARE
 expected_tables text[] := ARRAY['app_user','password_credential','auth_session','classroom','class_teacher','enrolment',
  'subject','class_subject','content_version','topic','topic_revision','misconception','misconception_revision',
  'topic_misconception','source_reference','misconception_source','item','item_option','option_misconception',
  'item_source','item_review','hypothesis','diagnostic_unit','unit_hypothesis','unit_item','engine_release','engine_params','response_model','response_parameter',
  'response_probability','diagnostic_session','session_hypothesis','session_question','question_candidate','session_step',
  'step_posterior','diagnosis','diagnosis_candidate','escalation','escalation_candidate','audit_event'];
 expected_indexes text[] := ARRAY['auth_session_user_idx','teacher_classes_idx','student_classes_idx','misconception_catalogue_idx',
  'item_topic_idx','item_target_idx','option_mapping_reverse_idx','session_roster_idx','session_outcome_idx','audit_time_idx','topic_misconception_home_idx'];
 missing text; n integer;
BEGIN
 SELECT string_agg(t, ', ') INTO missing FROM unnest(expected_tables) t WHERE to_regclass('sonder.' || t) IS NULL;
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Verification failed, missing tables: %', missing; END IF;
 SELECT count(*) INTO n FROM pg_tables WHERE schemaname = 'sonder';
 IF n <> array_length(expected_tables, 1) THEN RAISE EXCEPTION 'Verification failed: sonder schema has % tables, expected %', n, array_length(expected_tables, 1); END IF;
 SELECT string_agg(i, ', ') INTO missing FROM unnest(expected_indexes) i WHERE to_regclass('sonder.' || i) IS NULL;
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Verification failed, missing indexes: %', missing; END IF;
 IF to_regclass('sonder.step_support') IS NULL THEN RAISE EXCEPTION 'Verification failed: view step_support missing'; END IF;
 SELECT count(*) INTO n FROM pg_constraint c JOIN pg_namespace s ON s.oid = c.connamespace WHERE s.nspname = 'sonder' AND c.contype = 'f';
 IF n <> 66 THEN RAISE EXCEPTION 'Verification failed: % foreign keys, expected 66', n; END IF;
 SELECT count(*) INTO n FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'sonder' AND NOT g.tgisinternal;
 IF n <> 110 THEN RAISE EXCEPTION 'Verification failed: % triggers, expected 110', n; END IF;
END $$;
COMMIT;

-- Summary shown after a successful run.
SELECT count(*) FILTER (WHERE c.relkind = 'r') AS tables,
       count(*) FILTER (WHERE c.relkind = 'i') AS indexes
FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'sonder';
