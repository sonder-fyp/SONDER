# Sonder database schema plan: Iteration 1 (Mid-1)

Design date: 11 October 2026. **Revision 2** (same day, §12) fits the schema to the final Maths_v2 bank and the engine-spec amendment plan. This plan cuts the full-product design in [../../DB_SCHEMA_PLAN.md](../../DB_SCHEMA_PLAN.md) down to what Iteration 1 actually builds. It covers the scope in [ROADMAP.md](../../ROADMAP.md) (work packages I1-03 to I1-07), [ITERATION_1_MID_EVALUATION_CHECKLIST.md](../../../ITERATION_1_MID_EVALUATION_CHECKLIST.md), the Math-only [team work division](../../../ITERATION_1_TEAM_WORK_DIVISION_MATH_ONLY.md) and [MID_EVALUATION.md](../../MID_EVALUATION.md).

| File | What it is |
|---|---|
| [sonder_iteration1.sql](sonder_iteration1.sql) | **Authoritative.** One script that creates the whole Iteration 1 database in one transaction and verifies itself. Paste it into the Neon SQL Editor or run it with `psql`. |
| [sonder_iteration1.dbml](sonder_iteration1.dbml) | The same schema in DBML, for drawing the ERD at dbdiagram.io (checklist task T04.03). Generated from the database catalogue. |
| [sonder_iteration1_tables.pdf](sonder_iteration1_tables.pdf) | Every table with its columns, primary key and foreign keys. Generated from the database catalogue. |
| This file | Scope, decisions, rules, access, scenarios, coverage, how to run it, revision 2 changes (§12) and a per-table catalogue (Appendix A). |
| [tests/](tests/) | `behaviour_test.sql` (synthetic behaviour test) and `import_probe.py` (rolled-back load of the real Maths_v2 bank). See [tests/README.md](tests/README.md). |
| [tools/](tools/) | Generators for the DBML, PDF and Appendix A, plus a DBML parse check. See [tools/README.md](tools/README.md). |

If this document and the SQL ever disagree, the SQL wins. Appendix A, the DBML and the PDF were all generated from the catalogue of a database the SQL had just built, so they match it.

The links to the full-product design (`../../DB_SCHEMA_PLAN.md`, `../sonder.dbml`) point at files that exist on the author's machine but are **not yet committed** to the repository.

## 1. Summary

Iteration 1 needs a database for one flow: **a reviewed, versioned Math content pack feeds a real Bayesian diagnostic run that a student starts from a class, and the teacher sees the evidence and the outcome on a dashboard.** The schema has **38 tables, 229 columns, 61 foreign keys, 11 secondary indexes, 102 triggers and 1 view** in six domains:

| Domain | Tables | Why Iteration 1 needs it |
|---|---|---|
| Users and access (3) | `app_user`, `password_credential`, `auth_session` | Role-based dashboards and demo accounts (T07.04, T07.08, T13.05). |
| Classes (4) | `classroom`, `class_teacher`, `enrolment`, `class_subject` | "Basic class flow": create a class, join by code, start a run from a class (I1-06, T07.05). |
| Math content pack (14) | `subject`, `content_version`, `topic`, `topic_revision`, `misconception`, `misconception_revision`, `topic_misconception`, `source_reference`, `misconception_source`, `item`, `item_option`, `option_misconception`, `item_source`, `item_review` | Reviewed, versioned Math topic with misconceptions, items/options, Q-matrix, provenance and review records (I1-03, T05.01 to T05.08). |
| Engine model (6) | `hypothesis`, `engine_release`, `engine_params`, `response_model`, `response_parameter`, `response_probability` | Priors, slip/guess, thresholds and likelihood assumptions made reviewable, versioned and frozen (T06.02). |
| Diagnostic runs (10) | `diagnostic_session`, `session_hypothesis`, `session_question`, `question_candidate`, `session_step`, `step_posterior`, `diagnosis`, `diagnosis_candidate`, `escalation`, `escalation_candidate` (+ view `step_support`) | Posterior per answer, information-gain selection with its full ranking, stopping/refusal, evidence trail (I1-04, T06.03 to T06.06). |
| Audit (1) | `audit_event` | Who changed or froze what and when (auditability NFR, T03.05). |

The database is **not on the calculation path**. The Python engine reads a frozen pack, computes posteriors and information gain, and writes each presented question, answer, posterior and outcome in one transaction. Database triggers *check* those writes (complete, normalised, in order, inside the right pack). They never calculate anything.

## 2. Scope decisions

### In scope

The entities listed in checklist task T04.03 ("Math topic, misconception, item/options, Q-matrix mapping, version/review status, session, answer/step, posterior, and outcome"), plus what the live flow, class flow and dashboards need to run them.

### Deferred, with the iteration that brings it

| Deferred table(s) from the full design | Arrives with | Reason it is not in Iteration 1 |
|---|---|---|
| `teacher_review` | Iteration 2 (Gantt M3–M4 "Teacher approval, escalation, student intervention") | Teacher approval is not an Iteration 1 deliverable. The refusal itself *is* (stored in `escalation`). |
| Remediation, verification and intervention tables (full tier 2) | Iteration 2–3 (M3–M6) | Interventions and the delayed check come after teacher review. |
| `guardian_link`, parent summaries | Iteration 3 (M5–M6 "parent/admin views") | No parent screens in Iteration 1. The `parent` role value is kept so roles never need a migration. |
| Announcements and direct messages (full tier 3) | Iteration 3 | Explicitly excluded (T07.06). |
| AI pipeline, provenance, evaluation tables (full tier 4) and vectors (tier 5) | Iteration 2+ | Generative AI stays outside the Iteration 1 calculation (T06.07). Question generation and Learning Hub are later. |
| `auth_token` (password reset, email verification) | When real users exist | Iteration 1 uses synthetic demo accounts only. |
| `privacy_request` and the `withdrawn` user status | Before any real participant | No real student data is collected (T13.04). Withdrawal needs an agreed retention policy first. |
| `student_home_class` | Later | A convenience default. A run always names its enrolment explicitly. |
| `item_numeric_parameter` | With the distractor engine (feature 15) | Not needed for authored four-option items. |
| `item_prediction` | If coincidental-correct predictions need explaining | Inference uses `response_probability`, which already holds the full P(option given hypothesis) table. `item_prediction` only explained it. |

Physics and Chemistry content is out of scope for Iteration 1, but the schema stays subject-generic (`subject` scopes every code and external ID). Adding Physics later means adding rows, not tables.

### Deliberate changes from the full design (apply these to the full plan too)

Every Iteration 1 table exists in the full design's Tier 1, with the same name and the same key style. A machine comparison against [../sonder.dbml](../sonder.dbml) found these structural differences, all of them deliberate:

1. **`item_review` replaces `item_approval`.** The full design recorded only approvals. The checklist requires "reviewer, review date, review decision" and recording rejected items and corrections (T05.04 to T05.06). `item_review` is an append-only event row with these properties:
   - It records `approved` or `rejected`, plus a `review_round`.
   - The database blocks a review by the item's own author, which enforces the team's "no task is self-reviewed" rule.
   - Inserting the row is the *only* way to move an item to approved or rejected.
2. **`item.author_id`, `llm_assisted`, `assistance_note`.** T05.04 asks for the "author or generator" and disclosure of material LLM assistance. A note is mandatory whenever `llm_assisted` is true. `origin` is `authored` or `curated`. Generated items come later with their own provenance tables.
3. **`content_version.pack_sha256`, required to freeze.** T05.07 asks to prove the live engine uses "this exact version from a clean checkout". The hash of the committed pack file is stored on the version, so the database pack can be matched to a Git commit.
4. **Freeze also requires a source on every curated item** (`item_source`), so licence and permission are recorded for every reused question (T05.04, T13.02).
5. **A misconception revision may be inserted already `validated`**, because Iteration 1 imports a pack that was reviewed before import. The full design forced `pending` first.
6. **Smaller rules:**
   - Non-blank checks on names, stems and refusal reasons.
   - `subject.code` must be upper case.
   - A "frozen" audit event is also written for response models.
   - A PostgreSQL 16+ pre-flight check.
   - Verification runs inside the same transaction, so the script works in the Neon SQL Editor, which has no psql meta-commands.
7. **Revision 2 additions** (§12): cross-topic topic membership, an option link cap of three, rule V11, refusal tie sets with a leader, hypothesis slots, the EIG candidate ranking, answer notes, the `step_support` view, `engine_params` (with threshold columns moved out of `engine_release`) and stem families for A/B twins.

**Warning:** do not run the full design's `setup.sql` or `01_core.sql` on an Iteration 1 database. `CREATE TABLE IF NOT EXISTS` would silently skip the existing tables and leave both `item_approval` and `item_review`. Move to the full schema with a reviewed additive migration (§9).

### Standing decisions (unchanged from the full design)

- **Keys:** every table has `uuid PRIMARY KEY DEFAULT gen_random_uuid()` (built into PostgreSQL 13+, no extension). Business uniqueness is always a separate `UNIQUE` constraint, so a surrogate key never hides a duplicate relationship.
- **Types:** `text` plus `CHECK` instead of enums, and `timestamptz` everywhere.
- **JSON:** one JSONB column (`audit_event.detail`, an opaque note that nothing joins on or constrains).
- **Deletes:** content and history foreign keys are `RESTRICT`. Only a draft item's options, mappings and sources, and a user's credentials and login sessions, cascade. Normal operation uses status changes and new versions, never deletes.
- **Classes and users:** many teachers per class, many classes per student, and every run belongs to exactly one enrolment. Archived classes keep their history but refuse new joins and runs. Deactivated users keep their history.
- **Platform:** single institution, four-option single-answer questions only, all times stored in UTC as `timestamptz`.

## 3. How the tables fit together

```
app_user ─┬─ password_credential, auth_session
          ├─ class_teacher ─── classroom ─── class_subject ─── subject
          └─ enrolment ──────┘                                   │
                │                        content_version ────────┤ (one pack per subject+version)
                │                          │   topic ── topic_revision ──┐
                │                          │   misconception ── misconception_revision ── misconception_source ── source_reference
                │                          │                     │        └─ topic_misconception ─┘ (home | cross_topic)
                │                          │   item (topic_revision, target misconception_revision, author, stem_family) ── item_source
                │                          │     ├─ item_option ── option_misconception (Q-matrix: 0–3 links per wrong option; V11)
                │                          │     └─ item_review (append-only decisions)
                │                          ├─ hypothesis (each validated misconception + NONE + UNMODELLED)
                │                          └─ response_model ── response_parameter, response_probability (per option)
                │                                └─ engine_params (versioned, hashed parameter file)
                └─ diagnostic_session (enrolment, frozen response_model, engine_release, optional topic)
                      ├─ session_hypothesis (slot, prior)
                      ├─ session_question ── question_candidate (EIG ranking)
                      │        └─ session_step (answer, answer_note) ── step_posterior      [view step_support]
                      ├─ diagnosis ── diagnosis_candidate (rank 1, 2)
                      └─ escalation (leader) ── escalation_candidate (tied set, ranked)
audit_event (automatic, append-only)
```

A pack's version is reached through `topic_revision` (an item has no copied `content_version_id`). A session's student and class come through `enrolment`, and its pack comes through `response_model`. A run therefore pins everything that produced it: the pack, the likelihoods, the parameter file (through `response_model.engine_params_id`) and the engine build. With hypothesis slots and the stored candidate ranking, any old run can be replayed exactly.

## 4. Rules the database enforces

All of these were exercised on PostgreSQL 16 and 17 (§10). "Deferred" means checked at `COMMIT`, so the engine or import can write a whole item or step inside one transaction.

**Content and review**
- Exactly four options (labels A–D, unique per item) and exactly one correct option per item (deferred).
- The correct option has no misconception link, and a wrong option has at most **three** (deferred; Maths_v2 T7-003 option A has three).
- **Rule V11:** a misconception is linked to at most **two** options of the same item (deferred). This rejects the three B14 items whose three wrong options all carry MATH-1416.
- Topic, target misconception, mappings and hypotheses must belong to the same subject *and* the same pack version. A Physics misconception cannot be linked to a Math option.
- An item's target misconception must be one its topic keeps (`topic_misconception.disposition = 'keep'`). That membership is either the misconception's **home** topic (exactly one per pack, with a coverage target) or a **cross-topic** membership (no coverage target, a written reason required). Item external IDs are unique within a pack.
- An item and its options, mappings and sources can change **only while the item is a draft**. In review and approved items are locked, and only draft items can be deleted.
- Approval or rejection happens **only** by inserting an `item_review`. The reviewer must be an active teacher or admin, not the author, and the review must be the next round. Reviews are immutable.
- **Freeze gate** (`content_version` draft → frozen). The pack needs:
  - a `pack_sha256`
  - at least one approved item, and no draft or in-review items
  - a source on every curated approved item
  - the NONE and UNMODELLED hypotheses
  - every approved target and every hypothesis validated and engine-ready (`engine_tier = 1`)
  - every cross-topic misconception to have a home topic in the pack

  Frozen packs are immutable, cannot be unfrozen or deleted, and lock every row beneath them.
- **Response model freeze.** The content must be frozen first. Then every approved item × hypothesis needs exactly four option probabilities summing to 1 (tolerance 1e-9). After that the model is immutable.

**Runs**
- A run needs a frozen response model, an active student enrolment in an active class, and a class that teaches the pack's subject. An optional topic must belong to that pack.
- Priors are written before the first question. They must cover every chosen hypothesis, include NONE and UNMODELLED, and sum to 1 (deferred). Each hypothesis has a unique **slot**: misconceptions 0…k−1, NONE = k, UNMODELLED = k+1. The NONE and UNMODELLED priors must equal the pinned `engine_params` values.
- Questions are presented in order (`step_index` = answers so far), within `question_budget`, one at a time, never repeating an item, never showing the twin (same `stem_family`) of an item already shown, and only approved items from the run's pack and topic.
- Every presentation stores its **candidate ranking** (`question_candidate`): ranks 1…n, non-increasing EIG, rank 1 being the presented item with its `expected_ig`. A candidate must be eligible (approved, in scope, not already shown, not a twin of one shown). Checked at commit.
- An answer must be an option of the presented item and carries a non-blank `answer_note`. Unique `(session_id, request_key)` makes a retried answer harmless (idempotent). Each answer needs a complete posterior over the run's hypotheses that sums to 1 (deferred).
- Questions, answers, priors, posteriors, diagnoses, escalations and their candidates are **append-only**.
- A `diagnosed` run needs a diagnosis with a rank-1 misconception. An `escalated_*` run needs an `escalation` row with a **leader** from the same run. Its candidates, when present, are ranked 1…n and include the leader; an `escalated_no_separator` refusal needs a tied set of at least two. The ceiling p(leader)/p(tied set) is derived from the last posterior, never stored. A finished run has no unanswered question, and finished runs are immutable.
- **Engine parameters** (`engine_params`) are immutable once written and pass the spec's checks P1–P6 as CHECK constraints (for example `0 < guess < 0.5`, `theta + theta_unmodelled > 1`, `min_support_none ≥ min_support`).

**Accounts and classes**
- Only students enrol, and only teachers are assigned to classes.
- Archived classes refuse new enrolments.
- A user's role cannot change.
- A join code is unique, upper case and at least 8 characters.

### State machines

All transitions below are enforced in the database by `state_guard`. Other preconditions are listed above.

| Table.column | Starts as | Allowed transitions |
|---|---|---|
| `app_user.status` | active | active ⇄ deactivated |
| `classroom.status` | active | active ⇄ archived |
| `class_teacher.status` | active | active ⇄ departed |
| `enrolment.status` | active | active ⇄ left |
| `content_version.status` | draft | draft → frozen (terminal) |
| `misconception_revision.status` | pending, validated or catalogued_only | pending → validated / catalogued_only / retired; catalogued_only → pending / retired; validated → retired |
| `item.review_status` | draft | draft → in_review; in_review → approved / rejected (only via `item_review`); rejected → draft |
| `response_model.status` | draft | draft → frozen (terminal) |
| `diagnostic_session.status` | in_progress | in_progress → diagnosed / none_detected / escalated_no_separator / escalated_exhausted / escalated_unmodelled / abandoned (all terminal) |

The session outcomes cover every Iteration 1 engine result (T06.05):
- confident misconception: `diagnosed`
- confident "no misconception": `none_detected`
- no item can separate the leading pair: `escalated_no_separator`
- question budget used up without enough evidence: `escalated_exhausted`
- answers fit no modelled misconception: `escalated_unmodelled`
- student stops: `abandoned`

An invalid answer or invalid content is *rejected* (the write fails), so no outcome is invented for it.

## 5. Normalisation

Every table is in **BCNF**, and therefore also in 3NF and 2NF. Appendix A lists each table's candidate keys. In every table, each candidate key determines all other columns, and no other functional dependency is assumed. Examples:
- **`enrolment`:** `(class_id, student_id) → status, joined_at`. Neither class nor student alone determines those columns, so there is no 2NF problem on the composite key. Class name lives only in `classroom` and student name only in `app_user`.
- **`option_misconception`:** `(option_id, misconception_revision_id) → rationale` is a fact about the pair, not about either side.
- **`response_probability`:** `(response_model_id, hypothesis_id, option_id) → probability`. The item is reachable through the option, so it is not copied, which avoids a transitive dependency.

Transitive dependencies were removed rather than copied:
- An item gets its pack through `topic_revision`.
- A run gets its student and class through `enrolment`, and its pack and subject through `response_model`.
- A diagnosis's confidence is read from the last `step_posterior`.
- The rank-1/rank-2 pair is two rows, not a JSON array.

**4NF:** a misconception's sources, its topic memberships and an option's misconception links are separate relations, never one cross-product table. **5NF:** decomposing any of these pairs further would invent combinations, so there is nothing to split.

**Revision 2 tables and columns:**
- **`engine_params`:** candidate keys (id), (params_version), (params_sha256); each determines every parameter value. BCNF. A run reaches it through `response_model.engine_params_id`, so no parameter or version is copied onto the session, which would be a transitive dependency.
- **`question_candidate`:** candidate keys (id), (session_question_id, rank), (session_question_id, item_id); each determines `eig` and the other columns. BCNF.
- **`topic_misconception.membership`:** whether `target_minimum` is set depends on `membership` by a CHECK, not by a functional dependency between rows; the key (topic_revision_id, misconception_revision_id) still determines every column. BCNF.
- **`session_hypothesis.slot`:** candidate keys (id), (session_id, hypothesis_id), (session_id, slot). BCNF.
- **Support counts** are a view (`step_support`), not a table: they are fully determined by stored answers and frozen links, so storing them would be redundancy without a reason.

**Deliberate, controlled redundancy** (each one is guarded by a trigger):
- **`session_step.session_id` and `step_index`** repeat what its `session_question` already says. They exist so that `UNIQUE (session_id, step_index)` and request-key idempotency can be declared. This does **not** lower BCNF: `session_question_id` is itself a candidate key, and the trigger checks that the copies match.
- **`item.review_status`** is the workflow state, and `item_review` rows are the decision events. Approved and rejected states are only reachable by inserting the matching review, so the two cannot disagree. Draft and in review have no event to derive from, so the state column is needed.
- **`step_posterior`** stores a computed result on purpose: it is the evidence of what the engine concluded at that moment, not a cache of something re-derivable from other columns.
- **Rank 1 of `question_candidate`** repeats the presented item and its EIG from `session_question`. The ranking is recorded as one complete list (what the teacher's evidence panel shows), and the commit-time check makes the copies agree.
- **`escalation.leader_session_hypothesis_id`** and **`session_step.answer_note`** are recorded engine outputs, like `selection_reason` and the diagnosis ranks. The leader could be recomputed from the last posterior and slots, and the note from the answer and links, but the trace must show exactly what the engine emitted; the leader is checked to belong to the run and to the tied set.

## 6. Who reads and writes what

PostgreSQL does not authenticate end users here. The application server (BFF/FastAPI) authenticates each request and must filter every read through the path below. The script grants nothing to `PUBLIC`. Create least-privilege service roles separately (§8, step 6).

| Role | Reads (join path that proves access) | Writes |
|---|---|---|
| Student | Own `enrolment` → own `diagnostic_session`. Their pending `session_question` → `item` + `item_option` text **without** `is_correct` or mappings. | Join an active class by `join_code` (→ `enrolment`). Start a run for their own active enrolment. Answer the pending question. Engine-produced rows are written by the engine service, not by the student. |
| Teacher | `class_teacher` (active, own) → `classroom` → `enrolment` → `app_user` and `diagnostic_session` → questions, answers, posteriors, `diagnosis`/`escalation` and candidates. Approved content for display. | Create a class (`classroom` + own `class_teacher` + `class_subject` in one transaction). Show or rotate the join code. Archive. Nothing in the engine evidence. |
| Admin (content team) | All content and engine-model tables, coverage counts and the audit log. No default read of individual runs. | Author draft content, submit for review, record `item_review` (never on own items), freeze packs, register `engine_params` and `engine_release`, build and freeze response models. |
| Parent | Nothing yet. The role value exists so that adding parent features later needs no data migration. | Nothing. |
| Engine service | Frozen pack: approved items, options, hypotheses, response model, engine params, engine release. | `diagnostic_session`, `session_hypothesis`, `session_question`, `question_candidate`, `session_step`, `step_posterior`, `diagnosis*`, `escalation*`, each step in one transaction. Reads `step_support` for the trace. |

**Product rule to keep in Iteration 1:** Sonder's principle is that a diagnosis never reaches a student or parent unreviewed. Teacher review arrives in Iteration 2, so the student screen should show only that the run is complete and awaiting the teacher. It should not show the misconception or the probabilities. This is an application rule, and Open question 1 asks the team to confirm it.

## 7. Scenarios traced through the schema

"Tested" means the scenario was run against PostgreSQL 16 and 17 in the behaviour test described in §10. The N-numbers are the rejected cases from that test.

| # | Scenario | Tables and path | Result |
|---|---|---|---|
| 1 | Content team authors a Math topic with two misconceptions and two items, then submits them for review | `content_version`, `topic`(+`_revision`), `misconception`(+`_revision`), `topic_misconception`, `item`, `item_option`, `option_misconception`, `item_source`, `hypothesis` | Tested. |
| 2 | Reviewer rejects an item with a reason, the author fixes it, the reviewer approves round 2 | `item_review` rounds 1 and 2; item rejected → draft → in_review → approved | Tested. Both decisions stay on record. |
| 3 | Author tries to approve their own item | `item_review.reviewer_id = item.author_id` | Rejected (N11). |
| 4 | Someone "approves" by editing the status column | `item.review_status` update without a review row | Rejected (N12). |
| 5 | Option edited while in review, or approved stem edited | `content_guard` | Rejected (N13, N16). Fix: reject the item, edit it as a draft, re-review. |
| 6 | Malformed items: 3 options, two correct, an option E, a link on the correct option, a fourth link on one wrong option | deferred `item_integrity`, label check | Rejected (N01–N05). Three links on one option are accepted (P41). |
| 7 | Physics misconception linked to a Math option, or a duplicate M1 code within Math | `content_scope`, `UNIQUE(subject_id, code)` | Rejected (N06, N07). M1 can repeat across subjects, and MATH-1379-style IDs are `external_id`. |
| 8 | Freeze attempted too early, or without a pack hash | `freeze_guard`, check constraint | Rejected (N15, N19). |
| 9 | Pack frozen; someone edits a topic name or adds an item | `content_guard` | Rejected (N20, N21). Changes go into a new `content_version`, and old runs keep the old pack. |
| 10 | Response model with a distribution that does not sum to 1 | `response_guard` at freeze | Rejected (N23). |
| 11 | **Normal run:** priors, Q1 answered, posterior, Q2 chosen by expected information gain, answered, diagnosed M1 (rank 2 M2) | `diagnostic_session` → `session_hypothesis` → `session_question` → `session_step` → `step_posterior` → `diagnosis` → `diagnosis_candidate` | Tested. The evidence-trail query in §10 reproduces the posterior after every answer. |
| 12 | **Ambiguous run:** M1, M2 and M3 tie at 0.30 and no item separates them | status `escalated_no_separator`, `escalation` (reason, leader) + three ranked `escalation_candidate` rows | Tested (P44); the ceiling derives to 1/3 (P45). A one-member tie set, a leader outside the set, or a leader from another run is rejected (N60–N62). |
| 13 | Budget runs out with weak evidence | `question_budget` + status `escalated_exhausted` | Supported. A question past the budget is rejected (N32). |
| 14 | Student closes the browser after a question is shown | `session_question` with no `session_step` | Resume shows the same question, and a second question is refused while one is pending (N24). |
| 15 | Student abandons mid-run | status `abandoned` with the pending question kept | Tested. No fake answer is created. |
| 16 | **Failure:** answer is an option from a different item | `session_guard` | Rejected (N25). No diagnosis is fabricated. |
| 17 | **Failure:** engine bug writes a posterior that does not sum to 1, or a prior after the first question | deferred `trace_complete`, `session_guard` | Rejected (N26, N27). The whole step rolls back. |
| 18 | Network retry resends an answer that already committed | `UNIQUE(session_id, request_key)` | Second insert refused (N28). The server returns the stored result. |
| 19 | Someone rewrites a stored answer, reopens a finished run, or marks a run diagnosed without a diagnosis | append-only and terminal guards, `trace_complete` | Rejected (N29, N31, N30). |
| 20 | Student in two classes starts a Math run | the run names one `enrolment`, and its class must have `class_subject` = Math | Allowed only through the Math class (N33 rejects the other). |
| 21 | Teacher account enrolled as a student, a duplicate enrolment, or joining an archived class | `membership_guard`, `UNIQUE(class_id, student_id)` | Rejected (N34–N36). |
| 22 | Run against a draft (unfrozen) model | `session_guard` | Rejected (N39). |
| 23 | Teacher dashboard: outcomes across my classes | `class_teacher` → `classroom` → `enrolment` → `app_user` + `diagnostic_session` (via `teacher_classes_idx`, `session_roster_idx`) | Tested query (§10). |
| 24 | Coverage: approved items per topic misconception against its target | `topic_misconception` ⟕ `item` (target, approved) | Tested query: shows 1 of 3 per misconception in the test pack (T05.08 "record coverage and gaps honestly"). |
| 25 | Audit: who froze the pack and when | `audit_event` (`frozen` event on `content_version`, actor from `sonder.actor_id`) | Tested. Audit rows cannot be deleted (N40). |
| 26 | A teacher leaves the class | `class_teacher` active → departed | Attribution is kept and access is removed. Replacement teachers see the class's past runs through their own assignment. |
| 27 | A misconception is retired later | new pack with a `retired` revision, old pack untouched | Old runs stay reproducible, and new runs cannot hypothesise it. |
| 28 | A T3 item targets MATH-2359, whose home is T7 | `topic_misconception` cross-topic row with a reason | Accepted (P41 and the import probe). A cross-topic row without a reason or with a coverage target, or a second home topic, is rejected (N42–N44). |
| 29 | B14 item links MATH-1416 to all three wrong options | deferred `item_integrity` (V11) | Rejected (N41; import probe rejects T6-011B, T6-014B, T6-016B). |
| 30 | A run shows T6-010, then tries its twin T6-010B | `item.stem_family`, `session_guard`, `candidate_scope` | Rejected as a presentation (N54) and as a candidate (N51). |
| 31 | Teacher opens the evidence panel for step 2 | `question_candidate` (full EIG ranking), `session_step.answer_note`, `step_support` view, `session_hypothesis.slot` | Tested (P43). A question without a ranking, a wrong rank 1, or a rising EIG is rejected (N58, N59, N53). |
| 32 | Engine parameters change from guess 0.30 to 0.25 | new `engine_params` row, new `response_model`; old runs keep theirs | Supported. Editing a used parameter row is rejected (N49); invalid parameter sets fail P1–P6 (N46–N48). |
| 33 | Run hypotheses listed in the wrong order, or a NONE prior that ignores the parameter file | `session_hypothesis.slot`, `trace_complete` | Rejected (N55–N57). |

## 8. Running it in Neon

The script creates the `sonder` schema inside an existing database. It does not create the Neon project, database, roles, grants or any content. No step below was run against Neon. Confirm any Neon CLI command from `neon --help` for your installed version before using it. This plan does not guess flags.

1. **Pre-flight.**
   - Use a dedicated Neon project and a **working branch** (for example `iteration1-schema`), not `main`.
   - Confirm in the Console or with `SELECT version();` that the branch runs PostgreSQL 16 or 17 (the script refuses older servers).
   - Keep the connection string out of Git, as CONTRIBUTING.md requires.
2. **Apply.** Either:
   - **Neon Console → SQL Editor:** pick the working branch and database, paste the whole of `sonder_iteration1.sql`, and run it. The final output is one row: `tables 38 | indexes 97`. The 97 includes primary-key and unique-constraint indexes.
   - **psql:** `psql "<working-branch connection string>" -X -v ON_ERROR_STOP=1 -f docs/db/iteration1/sonder_iteration1.sql`
3. **If anything fails,** the script's single transaction rolls back and the branch is unchanged. The built-in verification block also fails the run if the counts are wrong:
   - 38 tables
   - the 11 named indexes and the `step_support` view
   - 61 foreign keys
   - 102 triggers
4. **Re-running** the identical script is safe and repeats the verification. It is not a migration tool, so change the schema later with reviewed `ALTER` migrations, not by editing and re-running this file.
5. **Search path.** Tables live in the `sonder` schema. The application should either qualify names (`sonder.item`) or set `search_path = sonder` on its connection or role.
6. **Service roles (separate step, not in the script).**
   - Create a non-owner role for the app and one for the engine. Grant `USAGE` on schema `sonder` and only the table operations each needs.
   - Never give an application role ownership, `TRUNCATE`, or the right to disable triggers. The schema owner can bypass protections.
   - Set `sonder.actor_id` (and optionally `sonder.request_key`) per transaction so audit rows name the acting user.
7. **Load content** with the Iteration 1 import (T05.07). `tests/import_probe.py` shows the mapping that fits; it is a probe, not the importer:
   - Create the authors' and reviewers' accounts first (`author_id` and `reviewer_id` must be real teacher or admin accounts, and different people).
   - Map items to topics by ID prefix (T1–T7), not by the bank's `topic` label; add a cross-topic membership for each item whose target belongs to another topic; give A/B twins a shared `stem_family`.
   - Insert each item with its four options in one transaction.
   - Record reviews, set `pack_sha256`, then freeze.
8. **Promote** only after checks pass. Either point the deployment at the verified branch, or replay the same script on a fresh empty `main`. Never run rehearsal scripts or test data against a `main` that already holds data. Test data belongs on a throwaway branch that you delete afterwards.

## 9. From Iteration 1 to the full schema

Iteration 1 is a strict starting subset, so every later step is **additive**:
- **Iteration 2:** create `teacher_review`, then the full tier-2 learning tables.
- **Later iterations:** add `guardian_link` and the messaging tables, then AI and provenance, then vectors. Each comes as its own reviewed migration file.

Before writing those migrations, update the full design so it starts from this schema: adopt `item_review`, the item authorship fields and `pack_sha256`, and drop `item_approval`; and adopt every revision 2 change in §12 (the full design's `01_core.sql` still has the two-link cap, rank 1–2 refusals, thresholds on `engine_release`, and no slots, ranking, `engine_params` or stem families). Then the project has one lineage instead of two diverging designs. Columns kept in Iteration 1 only for that alignment (`locale`, `classroom.time_zone`, `grade8_in_scope`) cost nothing now.

| Likely change | Safe way to absorb it |
|---|---|
| Teacher review arrives | Add `teacher_review` referencing `diagnostic_session`. Existing runs need no backfill: "no review yet" is the correct state for them. |
| Physics or Chemistry content | Insert `subject` rows and new packs. No schema change. |
| Need `withdrawn` users or real-participant withdrawal | Swap the `app_user.status` check and state-guard edges in one migration, add `privacy_request`, and agree retention first. |
| Better likelihood model | New `response_model` rows (and, if needed, a new `engine_release`). Old runs stay pinned to the old model. |
| Item content needs fixing after freeze | Create a new `content_version`. Never alter a frozen pack. |

## 10. What was verified

Revision 2 was checked again from scratch. All of this ran locally in throwaway Docker containers (official `postgres:15`, `postgres:16` and `postgres:17` images), which were removed afterwards. None of it touched Neon or the application code.

- **Apply:** the script ran on an empty database on **PostgreSQL 16 and 17**, twice each (the rerun is safe). Its built-in verification passed: 38 tables, 11 named indexes, the view, 61 foreign keys, 102 triggers.
- **Version gate:** on **PostgreSQL 15** it stopped at the version check and left no schema behind.
- **Same result on both versions:** the catalogues extracted from 16 and 17 (tables, columns, constraints, indexes, triggers) are identical.
- **Behaviour test** ([tests/behaviour_test.sql](tests/behaviour_test.sql)), synthetic data, on both versions: **63 invalid writes rejected**, each by the intended rule (the message of every case was read, not just counted), and **7 positive checks passed**, with no unexpected errors. The rejected cases are N01–N63 (§7 maps them to scenarios); the positive checks are P41–P47.
- **Import probe** ([tests/import_probe.py](tests/import_probe.py)) against the real `data/Maths_v2` bank, in a rolled-back transaction, on both versions:

  | Group | Bank items | Loaded | Rejected |
  |---|---|---|---|
  | Eligible (non-twin) | 103 | **103** | 0 |
  | Operation-version twins | 14 | 11 | 3: T6-011B, T6-014B, T6-016B, each "a misconception is linked to more than two options (rule V11)" |

  Loaded: 114 items, 456 options, 327 misconception links, 25 items with a stem family, 13 cross-topic memberships. T7-003 (three links on option A) loaded. The pack then froze with the SHA-256 of `items.csv`, and nothing remained after the rollback. The probe uses placeholder accounts, so it shows the data *fits*, not that the review attribution is resolved.
- **Generated files:** the DBML, PDF and Appendix A were regenerated from the PostgreSQL 16 catalogue with [tools/generate.py](tools/generate.py), and the DBML was parsed with `@dbml/core` 10.3.1 (installed outside the repo).
- **Not verified:**
  - Running in the Neon SQL Editor itself (only plain PostgreSQL was tested).
  - Performance at any scale.
  - Application-side rules (§6, §12).
  - Concurrency races beyond what the row locks in the triggers are designed to serialise.
  - The full Maths_v2 bank through a real engine run (the probe stops at freezing the pack).

## 11. Open questions (with recommendations)

| # | Question | Recommendation |
|---|---|---|
| 1 | What does a student see when a run ends, before teacher review exists? | Show "complete, awaiting your teacher" only. The teacher dashboard shows the evidence and outcome. This keeps the "never unreviewed" promise honest at Mid-1. |
| 2 | Exact likelihood model, priors and slip/guess values (T06.02) | The spec's values are assumed, not measured. Store them as one `engine_params` row (version + hash) and the materialised table in `response_probability`; the schema rejects unnormalised tables and invalid parameter sets. Record the reasoning in `response_model.calibration_note`. |
| 3 | Content team accounts | Give Harris, Ashher and Ahmed named `admin` accounts in the demo database, so authorship and reviews point at real people and the self-review block works. The import must map names in the content files to these accounts. |
| 4 | Real login for Mid-1, or demo accounts only? | Use real password login on synthetic demo accounts (the tables exist), without reset or email flows. That gives real role checks for the dashboards (T13.05) at little cost. |
| 5 | Who is recorded as author and reviewer for the imported Maths_v2 items? The manifest says the items were generated by Claude and approved by Harris; the schema requires a human author account and a different reviewer. | Record Harris as the author (curator of LLM output, `llm_assisted = true`) and record Ashher's independent review as the `item_review` for the items Ashher actually accepted. Items without an independent human review stay out of the frozen Mid-1 pack. |

## 12. Revision 2: changes, reasons and decisions

Revision 2 applies the nine changes requested after the dataset and engine-spec reviews ([../../ENGINE_SPEC_AMENDMENT_PLAN.md](../../ENGINE_SPEC_AMENDMENT_PLAN.md), not yet committed; and `validation/MATHS_V2_REVIEW.md` findings M1, M2, M4).

**Decisions used.** The team has not recorded decisions D-A to D-E anywhere in the repository, so the defaults below were applied. Change them by editing the affected rule and rerunning the tests.

| Decision | Default applied | Where it shows up |
|---|---|---|
| D-A: keep V11 (a misconception on at most two options of an item) | Kept | `item_integrity`; three B14 items are rejected at import |
| D-B: per-topic packs; operation-version twins ineligible in Mid-1; foreign misconceptions linked by eligible items become hypotheses | Applied | Cross-topic memberships in the schema; twin eligibility is an **application** rule |
| D-C: K_MAX = 7 | Recorded only | Application constant, not a column. Note: `sonder_engine/model.py` on `dev` still has `MAX_MISCONCEPTIONS = 6` |
| D-D: min_support = 3 | Recorded only | A value in the `engine_params` row, not a schema rule |
| D-E: keep inseparable pairs separate | Kept | No schema change; refusals store the tied set |

| # | Change | Reason | Schema objects |
|---|---|---|---|
| 1 | **Cross-topic targets.** `topic_misconception.membership` is `home` (one per misconception per pack, with a coverage target) or `cross_topic` (no target, reason required). An item's target may be a cross-topic misconception its topic keeps. The same-subject/same-pack rule is unchanged. | 26 Maths_v2 items link or target misconceptions owned by another topic (validator finding M2); revision 1 rejected the 18 cross-topic targets. | `membership` column, two CHECKs, unique partial index `topic_misconception_home_idx`, freeze check that every cross-topic misconception has a home |
| 2 | **Option link cap three.** A wrong option may carry up to three misconception links; a correct option still carries none. | T7-003 option A links MATH-2271, MATH-1514 and MATH-1773. Three is the maximum in the bank; four is still rejected. | `item_integrity` |
| 3 | **Refusal tie sets with a leader.** `escalation.leader_session_hypothesis_id` (required); `escalation_candidate.rank` is 1…n. No-separator refusals need at least two candidates, which include the leader. The ceiling is **derived**, not stored. | The amended spec's R4 names a tied *set* of two or more, and the T5/T6/T7 packs can tie three hypotheses. | Column, rank CHECK, `session_guard`, `trace_complete` |
| 4 | **Hypothesis slots.** `session_hypothesis.slot`, unique per run, ordered misconceptions → NONE → UNMODELLED. | Ties break by hypothesis order (spec 5.0), so replay needs the order. Pack-level order is not needed: the session order is the one used. | Column, unique key, `trace_complete` |
| 5 | **Trace detail.** `question_candidate` stores the full EIG ranking per presentation; `session_step.answer_note` stores the engine's note; view `step_support` gives support counts per step and hypothesis. **No JSONB was added.** | The teacher evidence panel (spec 5.6) shows the ranking, support and note. Support is derivable, so it is a view. | New table, column, view, `candidate_scope`, `trace_complete` |
| 6 | **Engine configuration.** New immutable `engine_params` (version, SHA-256, slip, guess, reserved priors, theta, theta_unmodelled, min_support, min_support_none, delta, EIG floor, default budget) with P1–P6 as CHECKs. `response_model.engine_params_id` pins it; the duplicate threshold columns were **removed** from `engine_release`, which keeps the code build and selection policy. Priors of NONE/UNMODELLED must match the pinned file. | The spec pins a params version and hash per run. One table keeps the "frozen inputs" principle without copying values onto sessions. | New table, FK, trimmed `engine_release`, `trace_complete` |
| 7 | **V11 check.** No misconception on more than two options of one item, checked at commit like the four-option rule. | D-A; the likelihood model breaks for three predicted options (amendment plan §2). | `item_integrity` |
| 8 | **Twin marker.** Optional `item.stem_family`. A run never shows two items of one family, and a candidate ranking never lists the twin of an item already shown. | A/B twins share stem and answer (14 pairs in the bank). | Column, `session_guard`, `candidate_scope` |
| 9 | **Application rules, not schema.** K_MAX = 7; operation-version twins are not eligible in Mid-1 packs; `min_support = 3` is a parameter value; the student screen hides unreviewed results. | These are engine or BFF decisions that may change per pack without a migration. | None |

**Counts before → after:** tables 36 → 38; columns 208 → 229; foreign keys 57 → 61; secondary indexes 10 → 11; triggers 97 → 102; views 0 → 1.

**For the full-product design** (`docs/db/01_core.sql`, not changed here): it would need every change above, plus `item_review` from revision 1.

## Appendix A: per-table catalogue (generated from the database)

For every table: purpose, columns (types; `NULL` marks optional columns), candidate keys (each key determines every other column, which is the functional dependency relied on), foreign keys with delete rules, checks, secondary indexes with the query each serves, the state machine, and triggers. Every table is in BCNF (§5). The view `step_support` is described in §4 and §12.

<!-- APPENDIX:BEGIN (generated by tools/generate.py; do not edit by hand) -->

### Users and access

#### `app_user`

One account per person with a single role; deactivation keeps history.

- **Columns:** `id uuid`, `email text`, `role text`, `display_name text`, `locale text`, `time_zone text`, `status text`, `created_at timestamp with time zone`.
- **Candidate keys:** (id); (email). Each determines every other column of the row.
- **Foreign keys:** none.
- **Checks:** `(length(btrim(display_name)) > 0)`; `(email = lower(btrim(email)))`; `(role IN ('student', 'teacher', 'parent', 'admin'))`; `(status IN ('active', 'deactivated'))`.
- **State machine (database-enforced):** `status` starts as active; allowed transitions active → deactivated, deactivated → active.
- **Triggers:** audit (record_audit), fixed_keys (fixed_keys), state (state_guard).

#### `password_credential`

The account's password hash, kept apart from the profile.

- **Columns:** `id uuid`, `user_id uuid`, `password_hash text`, `changed_at timestamp with time zone`.
- **Candidate keys:** (id); (user_id). Each determines every other column of the row.
- **Foreign keys:** `user_id` → `app_user.id` ON DELETE CASCADE.

#### `auth_session`

A login session: hashed token, expiry and revocation.

- **Columns:** `id uuid`, `user_id uuid`, `token_hash text`, `created_at timestamp with time zone`, `expires_at timestamp with time zone`, `revoked_at timestamp with time zone NULL`.
- **Candidate keys:** (id); (token_hash). Each determines every other column of the row.
- **Foreign keys:** `user_id` → `app_user.id` ON DELETE CASCADE.
- **Checks:** `(expires_at > created_at)`; `((revoked_at IS NULL) OR (revoked_at >= created_at))`.
- **Secondary indexes:** `auth_session_user_idx`: Sign-in/sign-out: a user's live sessions by expiry.

### Classes

#### `classroom`

A class a teacher creates and students join with a unique join code.

- **Columns:** `id uuid`, `name text`, `note text`, `join_code text`, `grade_level smallint`, `time_zone text`, `status text`, `created_at timestamp with time zone`.
- **Candidate keys:** (id); (join_code). Each determines every other column of the row.
- **Foreign keys:** none.
- **Checks:** `((grade_level >= 1) AND (grade_level <= 12))`; `((join_code = upper(btrim(join_code))) AND (length(join_code) >= 8))`; `(length(btrim(name)) > 0)`; `(status IN ('active', 'archived'))`.
- **State machine (database-enforced):** `status` starts as active; allowed transitions active → archived, archived → active.
- **Triggers:** audit (record_audit), state (state_guard).

#### `class_teacher`

Which teachers teach a class (many-to-many); departure keeps attribution.

- **Columns:** `id uuid`, `class_id uuid`, `teacher_id uuid`, `status text`, `assigned_at timestamp with time zone`.
- **Candidate keys:** (id); (class_id, teacher_id). Each determines every other column of the row.
- **Foreign keys:** `class_id` → `classroom.id` ON DELETE RESTRICT; `teacher_id` → `app_user.id` ON DELETE RESTRICT.
- **Checks:** `(status IN ('active', 'departed'))`.
- **Secondary indexes:** `teacher_classes_idx`: Teacher dashboard and class list: a teacher's active classes.
- **State machine (database-enforced):** `status` starts as active; allowed transitions active → departed, departed → active.
- **Triggers:** audit (record_audit), fixed_keys (fixed_keys), membership_check (membership_guard), state (state_guard).

#### `enrolment`

A student's membership of one class; one row per (class, student).

- **Columns:** `id uuid`, `class_id uuid`, `student_id uuid`, `status text`, `joined_at timestamp with time zone`.
- **Candidate keys:** (id); (class_id, student_id). Each determines every other column of the row.
- **Foreign keys:** `class_id` → `classroom.id` ON DELETE RESTRICT; `student_id` → `app_user.id` ON DELETE RESTRICT.
- **Checks:** `(status IN ('active', 'left'))`.
- **Secondary indexes:** `student_classes_idx`: Student class list and run start: a student's enrolments.
- **State machine (database-enforced):** `status` starts as active; allowed transitions active → left, left → active.
- **Triggers:** audit (record_audit), fixed_keys (fixed_keys), membership_check (membership_guard), state (state_guard).

#### `class_subject`

Which subjects a class studies; a run needs its class to teach the pack's subject.

- **Columns:** `id uuid`, `class_id uuid`, `subject_id uuid`.
- **Candidate keys:** (id); (class_id, subject_id). Each determines every other column of the row.
- **Foreign keys:** `class_id` → `classroom.id` ON DELETE RESTRICT; `subject_id` → `subject.id` ON DELETE RESTRICT.

### Math content pack

#### `subject`

A subject (Mathematics now; Physics and Chemistry later) that scopes codes and IDs.

- **Columns:** `id uuid`, `code text`, `name text`.
- **Candidate keys:** (id); (code); (name). Each determines every other column of the row.
- **Foreign keys:** none.
- **Checks:** `((code = upper(btrim(code))) AND (length(code) > 0))`.
- **Triggers:** immutable (reject_mutation).

#### `content_version`

One versioned content pack per subject; frozen packs are immutable and carry the pack file hash.

- **Columns:** `id uuid`, `subject_id uuid`, `version_code text`, `note text`, `pack_sha256 text NULL`, `status text`, `created_at timestamp with time zone`.
- **Candidate keys:** (id); (subject_id, version_code). Each determines every other column of the row.
- **Foreign keys:** `subject_id` → `subject.id` ON DELETE RESTRICT.
- **Checks:** `((status <> 'frozen') OR (pack_sha256 IS NOT NULL))`; `(pack_sha256 ~ '^[0-9a-f]{64}$')`; `(status IN ('draft', 'frozen'))`; `(length(btrim(version_code)) > 0)`.
- **State machine (database-enforced):** `status` starts as draft; allowed transitions draft → frozen.
- **Triggers:** audit (record_audit), fixed_keys (fixed_keys), frozen (freeze_guard), state (state_guard).

#### `topic`

Stable topic identity within a subject (external ID).

- **Columns:** `id uuid`, `subject_id uuid`, `external_id text`.
- **Candidate keys:** (id); (subject_id, external_id). Each determines every other column of the row.
- **Foreign keys:** `subject_id` → `subject.id` ON DELETE RESTRICT.
- **Triggers:** immutable (reject_mutation).

#### `topic_revision`

The topic as it appears in one pack version (name, blurb).

- **Columns:** `id uuid`, `topic_id uuid`, `content_version_id uuid`, `name text`, `blurb text`, `grade8_in_scope boolean`.
- **Candidate keys:** (id); (content_version_id, topic_id). Each determines every other column of the row.
- **Foreign keys:** `content_version_id` → `content_version.id` ON DELETE RESTRICT; `topic_id` → `topic.id` ON DELETE RESTRICT.
- **Triggers:** a_content_guard (content_guard), b_fixed_keys (fixed_keys), c_scope (content_scope).

#### `misconception`

Stable misconception identity: code unique per subject, plus external ID such as MATH-1379.

- **Columns:** `id uuid`, `subject_id uuid`, `code text`, `external_id text`.
- **Candidate keys:** (id); (subject_id, code); (subject_id, external_id). Each determines every other column of the row.
- **Foreign keys:** `subject_id` → `subject.id` ON DELETE RESTRICT.
- **Triggers:** immutable (reject_mutation).

#### `misconception_revision`

The misconception's definition and engine readiness in one pack version.

- **Columns:** `id uuid`, `misconception_id uuid`, `content_version_id uuid`, `name text`, `description text`, `cognitive_origin text`, `status text`, `engine_tier smallint`.
- **Candidate keys:** (id); (content_version_id, misconception_id). Each determines every other column of the row.
- **Foreign keys:** `content_version_id` → `content_version.id` ON DELETE RESTRICT; `misconception_id` → `misconception.id` ON DELETE RESTRICT.
- **Checks:** `((engine_tier <> 1) OR (status = 'validated'))`; `(engine_tier IN (1, 2))`; `(status IN ('pending', 'validated', 'catalogued_only', 'retired'))`.
- **Secondary indexes:** `misconception_catalogue_idx`: Admin catalogue and pack validation: misconceptions in a pack by status.
- **State machine (database-enforced):** `status` starts as pending or validated or catalogued_only; allowed transitions pending → validated, pending → catalogued_only, catalogued_only → pending, validated → retired, pending → retired, catalogued_only → retired.
- **Triggers:** a_content_guard (content_guard), b_fixed_keys (fixed_keys), c_scope (content_scope), state (state_guard).

#### `topic_misconception`

Which misconceptions a topic covers: its home topic (with a coverage target) or a cross-topic membership (with a reason).

- **Columns:** `id uuid`, `topic_revision_id uuid`, `misconception_revision_id uuid`, `membership text`, `target_minimum integer NULL`, `old_topic_label text NULL`, `review_note text`, `disposition text`.
- **Candidate keys:** (id); (topic_revision_id, misconception_revision_id). Each determines every other column of the row.
- **Foreign keys:** `misconception_revision_id` → `misconception_revision.id` ON DELETE RESTRICT; `topic_revision_id` → `topic_revision.id` ON DELETE RESTRICT.
- **Checks:** `((membership = 'home') = (target_minimum IS NOT NULL))`; `((membership = 'home') OR (length(btrim(review_note)) > 0))`; `(disposition IN ('keep', 'move', 'remove'))`; `(membership IN ('home', 'cross_topic'))`; `(target_minimum > 0)`.
- **Secondary indexes:** `topic_misconception_home_idx`: Integrity: each misconception has at most one home topic per pack (unique, partial).
- **Triggers:** a_content_guard (content_guard), b_fixed_keys (fixed_keys), c_scope (content_scope).

#### `source_reference`

A citable source with its licence.

- **Columns:** `id uuid`, `citation_key text`, `citation text`, `url text NULL`, `licence text`, `scope_note text`.
- **Candidate keys:** (id); (citation_key). Each determines every other column of the row.
- **Foreign keys:** none.
- **Triggers:** immutable (reject_mutation).

#### `misconception_source`

Sources behind a misconception definition.

- **Columns:** `id uuid`, `misconception_revision_id uuid`, `source_id uuid`, `locator text`.
- **Candidate keys:** (id); (misconception_revision_id, source_id, locator). Each determines every other column of the row.
- **Foreign keys:** `misconception_revision_id` → `misconception_revision.id` ON DELETE RESTRICT; `source_id` → `source_reference.id` ON DELETE RESTRICT.
- **Triggers:** a_content_guard (content_guard), b_fixed_keys (fixed_keys).

#### `item`

A four-option question: stem, topic, target misconception, author, LLM-assistance disclosure, review state, stem family for A/B twins.

- **Columns:** `id uuid`, `topic_revision_id uuid`, `target_misconception_revision_id uuid`, `external_id text`, `stem text`, `batch text NULL`, `difficulty_est numeric NULL`, `origin text`, `author_id uuid`, `llm_assisted boolean`, `assistance_note text`, `review_status text`, `stem_family text NULL`.
- **Candidate keys:** (id); (topic_revision_id, external_id). Each determines every other column of the row.
- **Foreign keys:** `author_id` → `app_user.id` ON DELETE RESTRICT; `target_misconception_revision_id` → `misconception_revision.id` ON DELETE RESTRICT; `topic_revision_id` → `topic_revision.id` ON DELETE RESTRICT.
- **Checks:** `((NOT llm_assisted) OR (length(btrim(assistance_note)) > 0))`; `((difficulty_est >= (0)) AND (difficulty_est <= (1)))`; `(origin IN ('authored', 'curated'))`; `(review_status IN ('draft', 'in_review', 'approved', 'rejected'))`; `(length(btrim(stem)) > 0)`; `((stem_family IS NULL) OR (length(btrim(stem_family)) > 0))`.
- **Secondary indexes:** `item_target_idx`: Coverage check: approved items per target misconception.; `item_topic_idx`: Engine pack export and topic picker: approved items under a topic.
- **State machine (database-enforced):** `review_status` starts as draft; allowed transitions draft → in_review, in_review → approved, in_review → rejected, rejected → draft.
- **Triggers:** a_content_guard (content_guard), audit (record_audit), b_fixed_keys (fixed_keys), c_scope (content_scope), item_cardinality (deferred item_integrity), state (state_guard).

#### `item_option`

One of the four labelled options (A-D); exactly one is correct.

- **Columns:** `id uuid`, `item_id uuid`, `label text`, `external_id text NULL`, `option_text text`, `is_correct boolean`.
- **Candidate keys:** (id); (item_id, label). Each determines every other column of the row.
- **Conditional uniqueness (not a candidate key, column nullable):** (item_id, external_id).
- **Foreign keys:** `item_id` → `item.id` ON DELETE CASCADE.
- **Checks:** `(label IN ('A', 'B', 'C', 'D'))`.
- **Triggers:** a_content_guard (content_guard), audit (record_audit), b_fixed_keys (fixed_keys), item_cardinality (deferred item_integrity).

#### `option_misconception`

Q-matrix: a wrong option's link to up to three misconceptions, with rationale; a misconception sits on at most two options of an item.

- **Columns:** `id uuid`, `option_id uuid`, `misconception_revision_id uuid`, `rationale text`.
- **Candidate keys:** (id); (option_id, misconception_revision_id). Each determines every other column of the row.
- **Foreign keys:** `misconception_revision_id` → `misconception_revision.id` ON DELETE RESTRICT; `option_id` → `item_option.id` ON DELETE CASCADE.
- **Secondary indexes:** `option_mapping_reverse_idx`: Q-matrix inspection: which options point at a misconception.
- **Triggers:** a_content_guard (content_guard), audit (record_audit), b_fixed_keys (fixed_keys), c_scope (content_scope), item_cardinality (deferred item_integrity).

#### `item_source`

Sources behind an item (required at freeze for curated items).

- **Columns:** `id uuid`, `item_id uuid`, `source_id uuid`, `locator text`.
- **Candidate keys:** (id); (item_id, source_id, locator). Each determines every other column of the row.
- **Foreign keys:** `item_id` → `item.id` ON DELETE CASCADE; `source_id` → `source_reference.id` ON DELETE RESTRICT.
- **Triggers:** a_content_guard (content_guard), b_fixed_keys (fixed_keys).

#### `item_review`

A recorded review decision (approved or rejected) by someone other than the author.

- **Columns:** `id uuid`, `item_id uuid`, `review_round integer`, `reviewer_id uuid`, `decision text`, `note text`, `decided_at timestamp with time zone`.
- **Candidate keys:** (id); (item_id, review_round). Each determines every other column of the row.
- **Foreign keys:** `item_id` → `item.id` ON DELETE RESTRICT; `reviewer_id` → `app_user.id` ON DELETE RESTRICT.
- **Checks:** `(decision IN ('approved', 'rejected'))`; `(length(btrim(note)) > 0)`; `(review_round > 0)`.
- **Triggers:** audit (record_audit), immutable (reject_mutation), review_apply (item_review_apply), review_check (item_review_guard).

### Engine model (frozen inputs)

#### `hypothesis`

The engine's candidate states in a pack: each misconception plus NONE and UNMODELLED.

- **Columns:** `id uuid`, `content_version_id uuid`, `kind text`, `misconception_revision_id uuid NULL`.
- **Candidate keys:** (id); (content_version_id, kind, misconception_revision_id) with NULLS NOT DISTINCT. Each determines every other column of the row.
- **Foreign keys:** `content_version_id` → `content_version.id` ON DELETE RESTRICT; `misconception_revision_id` → `misconception_revision.id` ON DELETE RESTRICT.
- **Checks:** `((kind = 'misconception') = (misconception_revision_id IS NOT NULL))`; `(kind IN ('misconception', 'none', 'unmodelled'))`.
- **Triggers:** a_content_guard (content_guard), b_fixed_keys (fixed_keys), c_scope (content_scope).

#### `engine_release`

An engine code build and its selection policy, pinned by every run.

- **Columns:** `id uuid`, `release_code text`, `code_hash text`, `selection_policy text`, `created_at timestamp with time zone`.
- **Candidate keys:** (id); (release_code). Each determines every other column of the row.
- **Foreign keys:** none.
- **Triggers:** immutable (reject_mutation).

#### `engine_params`

One versioned, hashed engine parameter file: slip, guess, reserved priors, thresholds, support rules, budget (all assumed).

- **Columns:** `id uuid`, `params_version text`, `params_sha256 text`, `slip numeric`, `guess numeric`, `prior_none numeric`, `prior_unmodelled numeric`, `theta numeric`, `theta_unmodelled numeric`, `min_support integer`, `min_support_none integer`, `delta_sep numeric`, `eig_floor numeric`, `default_budget integer`, `created_at timestamp with time zone`.
- **Candidate keys:** (id); (params_sha256); (params_version). Each determines every other column of the row.
- **Foreign keys:** none.
- **Checks:** `((prior_none + prior_unmodelled) < (1))`; `((theta + theta_unmodelled) > (1))`; `(min_support_none >= min_support)`; `(default_budget >= 1)`; `((delta_sep >= (0)) AND (delta_sep < 0.5))`; `(eig_floor >= (0))`; `((guess > (0)) AND (guess < 0.5))`; `(min_support >= 1)`; `(params_sha256 ~ '^[0-9a-f]{64}$')`; `(length(btrim(params_version)) > 0)`; `(prior_none > (0))`; `(prior_unmodelled > (0))`; `((slip > (0)) AND (slip < 0.5))`; `((theta > 0.5) AND (theta < (1)))`; `((theta_unmodelled > (0)) AND (theta_unmodelled < (1)))`.
- **Triggers:** audit (record_audit), immutable (reject_mutation).

#### `response_model`

A versioned set of answer likelihoods for a frozen pack, built from one engine_params file.

- **Columns:** `id uuid`, `content_version_id uuid`, `engine_params_id uuid`, `model_code text`, `source text`, `calibration_note text`, `status text`, `created_at timestamp with time zone`.
- **Candidate keys:** (id); (content_version_id, model_code). Each determines every other column of the row.
- **Foreign keys:** `content_version_id` → `content_version.id` ON DELETE RESTRICT; `engine_params_id` → `engine_params.id` ON DELETE RESTRICT.
- **Checks:** `(source IN ('prior', 'calibrated'))`; `(status IN ('draft', 'frozen'))`.
- **State machine (database-enforced):** `status` starts as draft; allowed transitions draft → frozen.
- **Triggers:** audit (record_audit), fixed_keys (fixed_keys), frozen (response_guard), state (state_guard).

#### `response_parameter`

Slip and guess assumptions per hypothesis in a response model.

- **Columns:** `id uuid`, `response_model_id uuid`, `hypothesis_id uuid`, `slip numeric`, `guess numeric`.
- **Candidate keys:** (id); (response_model_id, hypothesis_id). Each determines every other column of the row.
- **Foreign keys:** `hypothesis_id` → `hypothesis.id` ON DELETE RESTRICT; `response_model_id` → `response_model.id` ON DELETE RESTRICT.
- **Checks:** `((guess >= (0)) AND (guess <= (1)))`; `((slip >= (0)) AND (slip <= (1)))`.
- **Triggers:** fixed_keys (fixed_keys), response_check (response_guard).

#### `response_probability`

P(option | hypothesis) for every approved item; four values summing to 1.

- **Columns:** `id uuid`, `response_model_id uuid`, `hypothesis_id uuid`, `option_id uuid`, `probability numeric`.
- **Candidate keys:** (id); (response_model_id, hypothesis_id, option_id). Each determines every other column of the row.
- **Foreign keys:** `hypothesis_id` → `hypothesis.id` ON DELETE RESTRICT; `option_id` → `item_option.id` ON DELETE RESTRICT; `response_model_id` → `response_model.id` ON DELETE RESTRICT.
- **Checks:** `((probability >= (0)) AND (probability <= (1)))`.
- **Triggers:** fixed_keys (fixed_keys), response_check (response_guard).

### Diagnostic runs

#### `diagnostic_session`

One diagnostic run for one enrolment, pinned to a response model and engine release; outcome status.

- **Columns:** `id uuid`, `enrolment_id uuid`, `response_model_id uuid`, `engine_release_id uuid`, `topic_revision_id uuid NULL`, `question_budget integer`, `request_key text`, `started_at timestamp with time zone`, `ended_at timestamp with time zone NULL`, `status text`.
- **Candidate keys:** (id); (enrolment_id, request_key). Each determines every other column of the row.
- **Foreign keys:** `engine_release_id` → `engine_release.id` ON DELETE RESTRICT; `enrolment_id` → `enrolment.id` ON DELETE RESTRICT; `response_model_id` → `response_model.id` ON DELETE RESTRICT; `topic_revision_id` → `topic_revision.id` ON DELETE RESTRICT.
- **Checks:** `((status = 'in_progress') = (ended_at IS NULL))`; `((ended_at IS NULL) OR (ended_at >= started_at))`; `(question_budget > 0)`; `(status IN ('in_progress', 'diagnosed', 'none_detected', 'escalated_no_separator', 'escalated_exhausted', 'escalated_unmodelled', 'abandoned'))`.
- **Secondary indexes:** `session_outcome_idx`: Teacher dashboard: finished runs by outcome (diagnosed, refused, abandoned).; `session_roster_idx`: Student history and teacher class view: an enrolment's runs, newest first.
- **State machine (database-enforced):** `status` starts as in_progress; allowed transitions in_progress → diagnosed, in_progress → none_detected, in_progress → escalated_no_separator, in_progress → escalated_exhausted, in_progress → escalated_unmodelled, in_progress → abandoned.
- **Triggers:** audit (record_audit), fixed_keys (fixed_keys), scope_check (session_guard), session_scope (session_guard), state (state_guard), trace_complete (deferred trace_complete).

#### `session_hypothesis`

Each hypothesis in a run, its slot (order used for ties and replay) and its prior probability.

- **Columns:** `id uuid`, `session_id uuid`, `hypothesis_id uuid`, `slot smallint`, `prior_probability numeric`.
- **Candidate keys:** (id); (session_id, hypothesis_id); (session_id, slot). Each determines every other column of the row.
- **Foreign keys:** `hypothesis_id` → `hypothesis.id` ON DELETE RESTRICT; `session_id` → `diagnostic_session.id` ON DELETE RESTRICT.
- **Checks:** `((prior_probability >= (0)) AND (prior_probability <= (1)))`; `(slot >= 0)`.
- **Triggers:** immutable (reject_mutation), scope_check (session_guard), trace_complete (deferred trace_complete).

#### `session_question`

A question shown at a step, with why it was chosen (entropy, expected information gain).

- **Columns:** `id uuid`, `session_id uuid`, `step_index integer`, `item_id uuid`, `presented_at timestamp with time zone`, `selection_reason text`, `entropy_before numeric`, `expected_ig numeric`.
- **Candidate keys:** (id); (session_id, item_id); (session_id, step_index). Each determines every other column of the row.
- **Foreign keys:** `item_id` → `item.id` ON DELETE RESTRICT; `session_id` → `diagnostic_session.id` ON DELETE RESTRICT.
- **Checks:** `(entropy_before >= (0))`; `(expected_ig >= (0))`; `(step_index >= 0)`.
- **Triggers:** immutable (reject_mutation), scope_check (session_guard), trace_complete (deferred trace_complete).

#### `question_candidate`

The ranked EIG of every candidate item considered for a shown question; rank 1 is the shown item.

- **Columns:** `id uuid`, `session_question_id uuid`, `item_id uuid`, `rank integer`, `eig numeric`.
- **Candidate keys:** (id); (session_question_id, item_id); (session_question_id, rank). Each determines every other column of the row.
- **Foreign keys:** `item_id` → `item.id` ON DELETE RESTRICT; `session_question_id` → `session_question.id` ON DELETE RESTRICT.
- **Checks:** `(eig >= (0))`; `(rank >= 1)`.
- **Triggers:** immutable (reject_mutation), scope_check (candidate_scope), trace_complete (deferred trace_complete).

#### `session_step`

The student's answer to a shown question and the engine's answer note; append-only, idempotent by request key.

- **Columns:** `id uuid`, `session_id uuid`, `step_index integer`, `session_question_id uuid`, `answer_option_id uuid`, `answered_at timestamp with time zone`, `request_key text`, `calculation_ms numeric`, `answer_note text`.
- **Candidate keys:** (id); (session_id, request_key); (session_id, step_index); (session_question_id). Each determines every other column of the row.
- **Foreign keys:** `answer_option_id` → `item_option.id` ON DELETE RESTRICT; `session_id` → `diagnostic_session.id` ON DELETE RESTRICT; `session_question_id` → `session_question.id` ON DELETE RESTRICT.
- **Checks:** `(length(btrim(answer_note)) > 0)`; `(calculation_ms >= (0))`; `(step_index >= 0)`.
- **Triggers:** immutable (reject_mutation), scope_check (session_guard), trace_complete (deferred trace_complete).

#### `step_posterior`

The posterior probability of each hypothesis after an answer.

- **Columns:** `id uuid`, `step_id uuid`, `session_hypothesis_id uuid`, `probability numeric`.
- **Candidate keys:** (id); (step_id, session_hypothesis_id). Each determines every other column of the row.
- **Foreign keys:** `session_hypothesis_id` → `session_hypothesis.id` ON DELETE RESTRICT; `step_id` → `session_step.id` ON DELETE RESTRICT.
- **Checks:** `((probability >= (0)) AND (probability <= (1)))`.
- **Triggers:** immutable (reject_mutation), scope_check (evidence_scope), trace_complete (deferred trace_complete).

#### `diagnosis`

The engine's conclusion for a diagnosed run.

- **Columns:** `id uuid`, `session_id uuid`, `created_at timestamp with time zone`.
- **Candidate keys:** (id); (session_id). Each determines every other column of the row.
- **Foreign keys:** `session_id` → `diagnostic_session.id` ON DELETE RESTRICT.
- **Triggers:** immutable (reject_mutation), scope_check (session_guard), trace_complete (deferred trace_complete).

#### `diagnosis_candidate`

Rank 1 and rank 2 hypotheses of a diagnosis (confidence read from the last posterior).

- **Columns:** `id uuid`, `diagnosis_id uuid`, `session_hypothesis_id uuid`, `rank smallint`.
- **Candidate keys:** (id); (diagnosis_id, rank); (diagnosis_id, session_hypothesis_id). Each determines every other column of the row.
- **Foreign keys:** `diagnosis_id` → `diagnosis.id` ON DELETE RESTRICT; `session_hypothesis_id` → `session_hypothesis.id` ON DELETE RESTRICT.
- **Checks:** `(rank IN (1, 2))`.
- **Triggers:** immutable (reject_mutation), scope_check (evidence_scope), trace_complete (deferred trace_complete).

#### `escalation`

The engine's explicit refusal: reason and leading hypothesis (no separator, budget exhausted, unmodelled).

- **Columns:** `id uuid`, `session_id uuid`, `reason text`, `leader_session_hypothesis_id uuid`, `created_at timestamp with time zone`.
- **Candidate keys:** (id); (session_id). Each determines every other column of the row.
- **Foreign keys:** `leader_session_hypothesis_id` → `session_hypothesis.id` ON DELETE RESTRICT; `session_id` → `diagnostic_session.id` ON DELETE RESTRICT.
- **Checks:** `(length(btrim(reason)) > 0)`.
- **Triggers:** immutable (reject_mutation), scope_check (session_guard), trace_complete (deferred trace_complete).

#### `escalation_candidate`

The tied set behind a refusal (two or more for no separator), ranked; includes the leader.

- **Columns:** `id uuid`, `escalation_id uuid`, `session_hypothesis_id uuid`, `rank smallint`.
- **Candidate keys:** (id); (escalation_id, rank); (escalation_id, session_hypothesis_id). Each determines every other column of the row.
- **Foreign keys:** `escalation_id` → `escalation.id` ON DELETE RESTRICT; `session_hypothesis_id` → `session_hypothesis.id` ON DELETE RESTRICT.
- **Checks:** `(rank >= 1)`.
- **Triggers:** immutable (reject_mutation), scope_check (evidence_scope), trace_complete (deferred trace_complete).

### Audit

#### `audit_event`

Append-only log of important inserts, updates and freezes (who, what, when).

- **Columns:** `id uuid`, `actor_id uuid NULL`, `event_type text`, `relation_name text`, `row_id uuid`, `request_key text NULL`, `occurred_at timestamp with time zone`, `detail jsonb`.
- **Candidate keys:** (id). Each determines every other column of the row.
- **Foreign keys:** `actor_id` → `app_user.id` ON DELETE RESTRICT.
- **Secondary indexes:** `audit_time_idx`: Audit review: events in a time window.
- **Triggers:** immutable (reject_mutation).

<!-- APPENDIX:END -->
