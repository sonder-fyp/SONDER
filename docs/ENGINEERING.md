# Sonder - engineering plan

**Purpose:** target design for the FYP implementation. The [proposal-defence PoC](POC.md) supplies a UI reference; its fixture logic is not the engine specified here.
**Scope history:** this design includes bounded tutor and retrieval features that an earlier ConceptBridge plan had excluded. They are product features around the same diagnostic contribution; §1.3 explains the boundary.
**Scope:** every feature in the [project feature register](PROJECT.md#feature-register) (1–20, including 8a–8c, 11a–11d, 16a). Nothing is deferred.
**Companion docs:** [PROJECT.md](PROJECT.md) for approved-scope interpretation, [ROADMAP.md](ROADMAP.md) for sequencing, [MID_EVALUATION.md](MID_EVALUATION.md) for the Mid‑1 evidence requirements, and [POC.md](POC.md) for the historical demo.

---

## 1. Positioning

### 1.1 What Sonder is

A misconception-diagnosis system for Grade-8 Mathematics, Physics and Chemistry. A student answers questions; the engine maintains a probability distribution over *named* misconceptions rather than a single label; when a wrong answer is consistent with several misconceptions, it chooses the next question specifically to tell them apart; when the evidence genuinely does not converge, it refuses to diagnose and hands the case to a teacher. Every diagnosis is teacher-reviewed before a student or parent sees it. Around this core sit a learning hub, two assistant chat surfaces, a self-improving question bank, and class / messaging features.

### 1.2 The two halves of the system, and why the split matters

| Half | What it is | Property it must have | Technology |
|---|---|---|---|
| **Diagnostic core** | Bayesian posterior over misconceptions, entropy-based next-question selection, stopping/refusal rules, verification loop, calibration | **Closed-form, deterministic, auditable.** A teacher can be shown exactly why any diagnosis was reached. No neural network, no LLM, no retrieval anywhere in this path. | Python (FastAPI service), pure NumPy/SciPy, Postgres for state |
| **AI product surface** | Study-note generation, the two AI Consultants, the Concept Tutor chat, the AI Resource Finder, the parent-summary rewrite, and the self-improving question-bank pipeline (generator + distractor + misconception + quality scorer) | **Bounded, grounded, logged, and either teacher-gated or read-only.** An LLM never diagnoses and never writes to the live question bank without a teacher approving it. | Self-hosted open LLM + embedding model (vLLM), Postgres + `pgvector`, orchestrated from the Next.js app and the Python service |

The rule that connects them: **the LLM is never on the critical path of a diagnosis, and its output is never authoritative.** It rewrites, suggests, drafts, and retrieves. A teacher or the deterministic engine always has the final say. This is the single design invariant of the whole system.

### 1.3 Defending the scope expansion

the earlier ConceptBridge scope plan cut the chatbots and RAG because "an LLM-backed misconception chatbot" is exactly what a panel would call "a chatbot with extra steps." Re-adopting them is a deliberate choice, defensible on four points, all of which this architecture enforces mechanically:

1. **The contribution is unchanged.** The claim is *sequential hypothesis discrimination inside a closed remediate-and-verify loop, measured against one-shot classification* (Studies V1–V3). The Bayesian and entropy methods are prior work; the AI product features do not supply this contribution.
2. **The LLM cannot supply the contribution.** The diagnostic engine has zero LLM dependency and keeps working if every model server is down (a testable NFR — §11). Removing the LLM entirely leaves the full contribution intact.
3. **Every generative output is gated or bounded.** New questions and published diagnosis content require teacher approval (Feature 17 and the review gate). Direct chat answers are bounded by their concept or evidence context and logged. The parent rewrite is checked against the structured, approved diagnosis.
4. **Provenance is mandatory.** Every AI-generated artefact carries when it was made, which model made it, what it was grounded on, and who validated it (Feature 19, `provenance_entry` + `llm_call_log`).

State this in the report as a conscious decision: *the AI surface increases build scope but not contribution scope, and the architecture keeps the two separable so an examiner can evaluate the engine on its own.*

---

## 2. System context

```
                           ┌──────────────────────────────────────────────┐
                           │                 Browser (SPA)                │
                           │  student · teacher · parent · admin roles     │
                           └───────────────┬──────────────────────────────┘
                                           │ HTTPS
                           ┌───────────────▼──────────────────────────────┐
                           │            Next.js application               │
                           │  • UI (App Router, the PoC screens)         │
                           │  • Auth + RBAC + session                     │
                           │  • CRUD: users, classes, enrolment, messaging,│
                           │    announcements, teacher review workflow     │
                           │  • Chat orchestration (Consultant, Tutor)     │
                           │  • BFF: proxies to the engine + model services│
                           └───┬───────────────┬───────────────┬──────────┘
                               │ REST/JSON     │ REST/JSON     │ SQL
              ┌────────────────▼──┐   ┌────────▼─────────┐   ┌─▼───────────────────┐
              │  Engine service   │   │  Model service   │   │     PostgreSQL       │
              │  (FastAPI, Python)│   │  (vLLM, OpenAI-  │   │  • engine state     │
              │  • Bayes update   │   │   compatible)    │   │  • Q-matrix, items  │
              │  • discriminator  │   │  • 1 generation  │   │  • audit trail      │
              │  • stopping/refuse│   │    LLM (7–32B)   │   │  • users/classes/DM │
              │  • verification   │   │  • 1 embedding   │   │  • provenance,      │
              │  • calibration    │   │    model         │   │    llm_call_log     │
              │  • ML item-scorer │   │  • 1 reranker    │   │  • pgvector indexes │
              └───────┬───────────┘   └────────▲─────────┘   └─────────────────────┘
                      │ SQL                    │ REST (called by engine + Next)
                      └────────────────────────┘
                               ▲
              ┌────────────────┴───────────────────────────────────────┐
              │  Offline batch runner (cron / job queue)               │
              │  • nightly calibration refresh                         │
              │  • coverage-gap scan over the Q-matrix                 │
              │  • self-improving question-bank generation runs        │
              │  • evaluation harness (V1 simulation, V2 LLM baseline, │
              │    V3 offline benchmark) — produces the report charts  │
              └───────────────────────────────────────────────────────┘

  External (Resource Finder only): a web search endpoint — self-hosted SearXNG
  or a search API — reached from the Next.js server, never from the browser.
```

Four long-running services (Next.js, engine, model, Postgres) plus one scheduled batch runner. The model service and the batch runner both need the GPU; everything else is CPU.

---

## 3. Proposed technology stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend + BFF | **Next.js (App Router, TypeScript)** | The proposal-defence PoC screens are a UI reference. Server actions / route handlers for CRUD and chat orchestration are planned. |
| UI kit | **Tailwind + shadcn/ui** | The PoC uses these as a design reference. |
| Diagnostic engine + ML | **Python 3.11+, FastAPI, NumPy, SciPy, scikit-learn** | Pure closed-form maths for the engine; scikit-learn only for the *later* trained item-scorer (§8.6). Served with `uvicorn`/`gunicorn`. |
| Database | **PostgreSQL 16** | Single database, both services connect. `pgvector` extension for the four small embedding indexes (§7.2). No separate vector DB. |
| ORM | Next side: **Prisma** or **Drizzle**. Engine side: **SQLAlchemy** (or raw `psycopg` for the hot path). | One schema, migrations owned by one side (recommend the Next side owns product tables, engine side owns engine tables, in the same DB with a shared migration order — see §4.7 open decision). |
| LLM serving | **vLLM**, OpenAI-compatible API | One generation model, one embedding model, one cross-encoder reranker, all local. `Ollama` acceptable for local dev. |
| Generation model | **A 7–14B instruction-tuned open model** for routine calls; optionally a **32B** for question generation and the LLM-judge. | Class, not a fixed pick — Qwen2.5-Instruct, Llama-3.x-Instruct, Mistral-Small are all candidates. Exact model + quantisation is an open decision (§12), settle it in D1 against the actual GPU. |
| Embedding model | **A small English sentence-embedding model** (`bge-*`, `e5-*`, `gte-*`, `nomic-embed-text` class). | Runs on CPU if needed. 384–1024 dims. |
| Reranker | **A cross-encoder reranker** (`bge-reranker` class). | Used by the Resource Finder and, optionally, Tutor retrieval. |
| Background jobs | **`pg-boss`** (Node, Postgres-backed queue) or **cron** for the pilot. | Calibration, gap scan, generation runs, evaluation harness. Low volume — a queue is a convenience, not a requirement, at pilot scale. |
| Realtime (messaging) | **Polling** for the pilot (N≈30). SSE or WebSockets is a later upgrade. | Open decision (§12). |
| Deployment | **One GPU box** (model service + batch runner) + **one app box** (Next.js + engine + Postgres), or split further. Containerised (Docker Compose is enough for the pilot). | Must be installable by someone outside the team — an explicit ConceptBridge NFR. |
| Auth | Email/password + role, sessions in Postgres. | Four roles: student, parent, teacher, admin. No third-party IdP needed for a pilot. |

---

## 4. Data model

The schema is the heart of the system. The engine's defence answer — *"it's a database problem, not a retrieval problem"* — is literally true of the tables below: a diagnosis is a row in `session_step` being written after a closed-form update.

### 4.1 Content (the Q-matrix) — authored via the admin tool, versioned

| Table | Key columns | Purpose |
|---|---|---|
| `subject` | `id`, `name` (`mathematics`/`physics`/`chemistry`) | |
| `construct` | `id`, `subject_id`, `name`, `grade8_in_scope` | A curriculum topic (the Eedi `ConstructName`). |
| `misconception` | `id`, `subject_id`, `code` (`M1`…), `name`, `description`, `cognitive_origin`, `status` (`validated`/`pending`/`catalogued_only`), `tier` (1 = wired to the engine, 2 = catalogued only), `source_refs` | The catalogue. 100–150 per subject curated (`curated/misconceptions_final.csv`); ~30 per subject are Tier-1. |
| `item` | `id`, `construct_id`, `stem`, `correct_option_id`, `numeric_params` (JSON, maths only), `difficulty_est`, `origin` (`authored`/`generated`), `content_version_id`, `status` | A multiple-choice question. |
| `item_option` | `id`, `item_id`, `label` (A–D), `text`, `is_correct` | |
| `q_matrix_entry` | `id`, `item_option_id`, `misconception_id`, `predicted` (bool — does this misconception predict *this* wrong option), `rationale` | The map from wrong answers to misconceptions. This is what the engine reads. |
| `intervention` | `id`, `misconception_id`, `script`, `worked_example`, `content_version_id` | One remediation script per Tier-1 misconception. |
| `content_version` | `id`, `created_at`, `note`, `frozen_at` | Diagnoses stay interpretable against the Q-matrix that produced them (Feature 18 evidence trail). Every `diagnostic_session` records the `content_version_id` it ran under. |

### 4.2 Diagnostic sessions — the engine's working + audit state

| Table | Key columns | Purpose |
|---|---|---|
| `diagnostic_session` | `id`, `student_id`, `subject_id`, `construct_id` (nullable — broad checks span a subject), `mode` (`topic`/`broad`), `content_version_id`, `question_budget`, `started_at`, `outcome` (`in_progress`/`diagnosed`/`escalated_no_separator`/`escalated_exhausted`/`escalated_unmodelled`), `ended_at` | One diagnostic run. |
| `session_step` | `id`, `session_id`, `step_index`, `item_id`, `answer_option_id`, `posterior` (JSON: `{misconception_id → p}`, includes `NONE` and `UNMODELLED`), `entropy_before`, `expected_ig` (of the item that was chosen), `selection_reason` (text — teacher-facing), `outcome` | **Append-only.** The full evidence trail (Feature 18). Every posterior ever computed is on disk (Feature 9 / ConceptBridge E9). |
| `diagnosis` | `id`, `session_id`, `misconception_id`, `confidence`, `top2` (JSON — shown when both exceed threshold, the single-fault carve-out), `created_at` | Written only on a `diagnosed` outcome. |
| `escalation` | `id`, `session_id`, `reason`, `tied_pair` (JSON, nullable), `ai_suggestion_id` (nullable — see §8.5), `created_at`, `resolved_by`, `resolution` | Written on any escalated outcome. |
| `verification_check` | `id`, `diagnosis_id`, `kind` (`immediate`/`delayed`), `scheduled_for`, `item_id`, `taken_at`, `answer_option_id`, `result` (`resolved`/`persistent`/`uncertain`) | Feature 4 / ConceptBridge E6–E7. `delayed` fires 14–21 days after intervention completion. |
| `slip_guess_param` | `id`, `misconception_id` (nullable — can be global), `slip`, `guess`, `source` (`calibrated`/`prior`), `calibrated_at`, `sensitivity` (JSON) | Calibrated from real response data (ConceptBridge E5). Read by the engine on every update. |

### 4.3 Users, classes, messaging

| Table | Key columns | Purpose |
|---|---|---|
| `user` | `id`, `email`, `password_hash`, `role`, `display_name`, `locale` | |
| `guardian_link` | `parent_id`, `student_id` | A parent sees only their child(ren). |
| `class` | `id`, `name`, `subject_focus`, `teacher_id`, `join_code`, `archived` | Feature 11a/11b. `join_code` unique. |
| `enrolment` | `class_id`, `student_id`, `joined_at` | A student can be in several classes (Feature 11b). |
| `announcement` | `id`, `class_id`, `author_id`, `title`, `body`, `created_at` | Feature 11c. Read-only for students. |
| `dm_thread` | `id`, `kind` (`teacher_student`/`teacher_parent`), `teacher_id`, `student_id`, `created_at` | Feature 11d. The parent thread is keyed by the student it concerns. |
| `dm_message` | `id`, `thread_id`, `sender_id`, `body`, `sent_at`, `read_at` | |

### 4.4 Teacher review + parent-facing output

| Table | Key columns | Purpose |
|---|---|---|
| `teacher_review` | `id`, `session_id`, `teacher_id`, `decision` (`approved`/`corrected`/`rejected`/`resolved`), `corrected_misconception_id` (nullable), `note`, `decided_at` | Feature 9. Nothing reaches a student or parent until this row exists. |
| `parent_summary` | `id`, `session_id`, `child_id`, `what_we_found`, `what_to_work_on`, `hows_it_going`, `approved_by`, `approved_on`, `llm_call_id` (the bounded rewrite), `similarity_ok` (bool) | Feature 11. Generated by a single bounded LLM rewrite of the structured diagnosis, similarity-checked, with a raw-structured fallback (ConceptBridge P4 / FR-05). |

### 4.5 Student learning surface

| Table | Key columns | Purpose |
|---|---|---|
| `study_note` | `id`, `misconception_id`, `what_was_going_on`, `how_to_think`, `worked_example`, `origin` (`authored`/`generated`), `llm_call_id`, `approved_by` | Feature 6. Authored for Tier-1; may be LLM-drafted then teacher-approved. |
| `resource` | `id`, `misconception_id`, `title`, `url`, `kind` (`video`/`article`/`interactive`), `source`, `rationale`, `relevance`, `origin` (`curated`/`found`), `found_run_id` (nullable), `approved_by` | Features 7 + 8b. Curated links plus AI-found candidates (teacher-approved before they show). |
| `concept_doc` | `id`, `misconception_id` (nullable — some are general), `title`, `body`, `doc_type` (`explanation`/`worked_example`/`analogy`/`common_error`) | The **first-party corpus the Concept Tutor retrieves over** (Feature 8c). A few hundred short docs, authored + teacher-approved. |
| `concept_doc_chunk` | `id`, `concept_doc_id`, `chunk_index`, `text`, `embedding` (`vector`) | pgvector index. Chunks are small (≈1–3 sentences) because the docs are short. |

### 4.6 AI pipeline + trust

| Table | Key columns | Purpose |
|---|---|---|
| `coverage_gap` | `id`, `kind` (`separator` = a pair no item separates / `thin_coverage` = one misconception with too few items), `subject_id`, `misconception_ids` (JSON, 1 or 2), `status` (`open`/`generating`/`in_review`/`closed`), `detected_at`, `detected_from` | Features 12–13. Output of the nightly gap scan (deterministic — §8.7). |
| `generation_run` | `id`, `gap_id`, `trigger` (JSON — student/session that surfaced it, or `scheduled`), `drafter_model`, `scorer_model`, `pass_mark`, `target_min`, `target_max`, `started_at`, `status`, `rounds` (JSON summary), `final_batch` (JSON) | Feature 16a. One generate→score→reject loop. |
| `generated_item` | `id`, `run_id`, `stem`, `options` (JSON), `mapping` (JSON — option → misconception + rationale), `distractor_source` (`computed`/`ai`), `mapping_source` (`ai`/`engine_verified`), `score`, `score_breakdown` (JSON), `status` (`kept`/`rejected`/`approved`/`published`), `reject_reason` | Staging area. Only rows that reach `published` become `item` rows. |
| `generation_review` | `id`, `generated_item_id`, `reviewer_id`, `verdict`, `note`, `decided_at` | Feature 17. Two-reviewer agreement for separator items; per-item for batches. |
| `provenance_entry` | `id`, `artefact_type` (`question`/`distractor_set`/`study_note`/`resource`/`consultant_suggestion`/`generation_run`), `artefact_id`, `created_on`, `generated_by` (model + version + prompt hash), `grounded_on` (JSON — corpus ids / few-shot item ids / web urls), `validators` (JSON), `status` | Feature 19. One row per AI artefact, ever. |
| `llm_call_log` | `id`, `feature` (`parent_rewrite`/`tutor`/`consultant`/`drafter`/`judge`/`resource_rationale`/…), `model`, `prompt_tokens`, `completion_tokens`, `latency_ms`, `grounding_ref` (JSON), `similarity_score` (nullable), `outcome` (`ok`/`fallback`/`blocked`), `session_id`/`user_id`, `created_at` | Every LLM call in the system. Enforces the "bounded and logged" invariant and feeds the cost / usage section of the report. |
| `item_embedding` | `item_id`, `embedding` (`vector`) | pgvector index. Used for (a) few-shot exemplar selection in the generation pipeline and (b) the near-duplicate check before a generated item is offered to a teacher. |

### 4.7 Open decisions in the data layer

- **Migration ownership.** Two services, one DB. Recommend: product tables (`user`, `class`, `dm_*`, `announcement`, `teacher_review`, `study_note`, `resource`, `concept_doc*`) migrated from the Next side (Prisma/Drizzle); engine tables (`misconception`, `item*`, `q_matrix_entry`, `session*`, `diagnosis`, `verification_check`, `slip_guess_param`, `content_version`) migrated from the Python side (Alembic). Pipeline tables (`coverage_gap`, `generation_*`, `provenance_entry`, `llm_call_log`, `item_embedding`) — assign to whichever service writes them most (mostly the batch runner → Python/Alembic). Agree the split and a single ordering in D1.
- **`posterior` storage.** JSON column is simplest and matches the PoC. If the evaluation harness needs to query posteriors at scale, a narrow `session_step_posterior(session_step_id, misconception_id, p)` table is the alternative. Decide after V1's query patterns are known.

---

## 5. The diagnostic engine (Features 1–5, 18) — no ML, no LLM, no retrieval

This is the ConceptBridge contribution, unchanged. Summarised here for completeness; the full derivation lives in the report's engine chapter.

### 5.1 Posterior update (Feature 1)

State: a distribution `p` over `{M1 … Mk, NONE, UNMODELLED}` for the active construct. Prior: uniform over the misconceptions the construct's items can express, with a fixed small mass on `UNMODELLED`.

On each answered item, for every hypothesis `h`, the likelihood of the observed option `o` is:

```
P(o | h) = (1 − slip_h)              if h predicts o        (q_matrix_entry.predicted = true)
         = guess_h / (n_options − 1) if h predicts a different wrong option
         = slip_h                    if o is the correct option and h is a misconception
         = (1 − guess_h)             if o is the correct option and h = NONE
UNMODELLED contributes a flat, near-uniform likelihood (it explains anything weakly).
```

`slip_h`, `guess_h` come from `slip_guess_param` (calibrated — ConceptBridge E5). Bayes rule, renormalise, append a `session_step` row with the new posterior and the reason. **Closed form. Microseconds. Fully explainable.**

### 5.2 Discriminator selection (Feature 2)

Among unused items for the construct, pick the one that maximises **expected reduction in Shannon entropy** of the posterior:

```
EIG(item) = H(p)  −  Σ_o  P(o) · H(p | o)
```

where `P(o)` is the current predictive probability of option `o` and `p | o` is the one-step-updated posterior. This is CD-CAT entropy item selection (Tatsuoka 1983; Xu/Chang/Douglas 2003; Cheng 2009) — cited, not claimed. Sub-second, no model inference. The `selection_reason` written to the step is a template filled from the EIG computation ("chosen to separate M2 from M3, which both predicted '6 mol' on the previous item").

### 5.3 Stopping and refusal (Feature 3)

- **Diagnose** when one hypothesis ≥ `θ_confident` (e.g. 0.75) with ≥ 2 answers behind it.
- **None-detected** when `NONE` ≥ `θ_confident`.
- **Escalate — no separator** when the top two misconceptions are within `ε` and no unused item has `EIG > δ` (they cannot be separated). Logs a `coverage_gap(kind=separator)`.
- **Escalate — exhausted** when the question budget is spent with nothing above `θ_confident`. May log a `coverage_gap(kind=thin_coverage)` for the leading misconception.
- **Escalate — unmodelled** when `UNMODELLED` carries meaningful mass — none of the catalogued hypotheses fit (ConceptBridge E4).

Refusal is a first-class outcome, not an error. The thresholds are engine config, tuned in V1 and reported.

### 5.4 Verification loop (Feature 4)

On teacher approval, an intervention is delivered (script + worked example + study note + resource). An **immediate** `verification_check` schedules a fresh isomorphic item (generated for maths, hand-authored pool for physics/chemistry). A **delayed** check schedules another 14–21 days after intervention completion. Results: `resolved` / `persistent` / `uncertain`, feeding Feature 20's durability statistics.

### 5.5 One engine, three subjects (Feature 5)

The engine reads `q_matrix_entry` rows and `slip_guess_param`; it has no subject-specific branch. Physics and Chemistry differ only in content (hand-authored items, no numeric generator) — a content constraint, not an engine one. C3 in ConceptBridge is deliberately falsifiable: if transfer fails on Chemistry, that is a reported finding.

### 5.6 Engine API (called by Next.js BFF)

| Method | Endpoint | Body → Response |
|---|---|---|
| POST | `/engine/sessions` | `{student_id, subject, construct?, mode}` → `{session_id, first_item}` |
| POST | `/engine/sessions/{id}/answers` | `{item_id, option_id}` → `{next_item}` **or** `{outcome, diagnosis? , escalation?}` |
| GET | `/engine/sessions/{id}/trace` | → full `session_step` list with posteriors + reasons (teacher evidence panel) |
| POST | `/engine/verifications/{id}/answers` | `{option_id}` → `{result}` |
| POST | `/engine/calibration/runs` | `{}` → kicks off a calibration refresh (batch) |
| POST | `/engine/gap-scan` | `{}` → refreshes `coverage_gap` (batch) |

All synchronous and fast except the last two, which enqueue batch jobs.

---

## 6. The model service (self-hosted)

### 6.1 What runs on the GPU

| Model | Role | Approx size | Called by |
|---|---|---|---|
| **Generation LLM** | question drafting, distractor prose (physics/chem), misconception-mapping proposals, the LLM-judge, study-note drafts, parent rewrite, both Consultants' phrasing step, Concept Tutor answers, Resource Finder rationales | 7–14B for routine; a 32B variant for drafting/judging if the GPU allows | engine service (pipeline, calibration-adjacent) and Next.js BFF (chats, rewrite) |
| **Embedding model** | `concept_doc_chunk`, `item_embedding`, ad-hoc query embedding | small (runs on CPU if needed) | Next.js BFF (Tutor retrieval), engine service (few-shot + dedup), batch runner (indexing) |
| **Cross-encoder reranker** | reorder web candidates (Resource Finder); optionally rerank Tutor chunks | small | Next.js BFF |

Served through vLLM's OpenAI-compatible endpoint (`/v1/chat/completions`, `/v1/embeddings`). One base URL, model chosen per request. Quantised (AWQ/GPTQ or GGUF via an alternative runtime) to fit whatever GPU the team ends up with — **the exact model, size and quantisation is an open decision to settle in D1 against real hardware** (§12).

### 6.2 Prompt discipline (applies to every call)

- **Every prompt is a fixed template** with typed slots. No free-form "you are a helpful tutor." Templates are version-controlled; a hash of the rendered system prompt goes into `provenance_entry.generated_by`.
- **Structured inputs only.** The model receives misconception *codes*, option *values*, construct *names*, retrieved *chunks* — not student names, not raw PII beyond what the task needs. (`llm_call_log` records what was sent.)
- **Structured outputs where possible.** Generation, mapping, and scoring calls request JSON (vLLM guided decoding / a schema). Parsing failure → the call is logged `outcome=blocked` and the pipeline round records a miss.
- **Grounding is passed explicitly and logged.** `grounding_ref` on every RAG call names the chunk / item / URL ids used.
- **Fallbacks are defined per feature** (§11.3). No feature hard-fails because the model server is unreachable.

---

## 7. Retrieval — where RAG earns its place, and where it does not

The honest answer to *"what RAG will we use from the database?"* is: **one embedding model and four small `pgvector` indexes, used in exactly four places, none of them anywhere near a diagnosis.** There is no separate vector database — the corpora are hundreds to low-thousands of vectors, and Postgres + `pgvector` with an HNSW index handles that with millisecond latency.

### 7.1 Where there is NO retrieval (and why)

| Feature | Why it is not RAG |
|---|---|
| **Diagnostic engine (1–5)** | Closed-form Bayes over `q_matrix_entry` rows. The "context" is a joined query result, not a document search. (ConceptBridge §6.1 Q7 stands.) |
| **AI Consultant — pace insights (8)** | Operates over the *student's own* `session_step` / `verification_check` / `diagnosis` history. The retrieval is `SELECT … WHERE student_id = …` — aggregation SQL. An LLM then phrases the observation *with the rows it rests on attached as evidence*. Retrieving similar documents would add nothing; the data is the student's structured record. |
| **AI Consultant — escalation support (10)** | Same: it reads the escalated session's steps + the class's aggregate patterns (SQL), and proposes explanations for the teacher. Grounded in structured rows, not a corpus. |
| **Parent Summary (11)** | A bounded rewrite of one `diagnosis` row + its `intervention`. Nothing to retrieve. |
| **Gap Detection (13)** | Pure Q-matrix graph analysis (§8.7). Deterministic. |

### 7.2 Where retrieval IS used

| # | Consumer | Index | Corpus size | Flow |
|---|---|---|---|---|
| 1 | **Concept Tutor chat (8c)** | `concept_doc_chunk.embedding` | a few hundred short first-party docs | Filter by the misconception the student is viewing (`metadata` filter) → semantic search within → top-k chunks → optional rerank → LLM answers **using only those chunks**, and says so if they don't cover the question. Answer + `grounding_ref` logged. |
| 2 | **Question / Distractor / Misconception engines (14–16)** | `item_embedding` | the validated item bank (hundreds → low thousands) | Retrieve the most similar *already-approved* items for the same construct / misconception and pass them as **few-shot exemplars** to the drafter. Improves format and difficulty consistency. "RAG for exemplar selection" — a legitimate, bounded use. |
| 3 | **Near-duplicate guard (16a, 17)** | `item_embedding` | same | Before a `generated_item` is offered to a teacher, embed its stem and reject if cosine similarity to any live item exceeds a threshold. Deterministic gate, no LLM. |
| 4 | **AI Resource Finder (8b)** | ephemeral (query-time only) + reranker | the open web | Next.js server calls the search endpoint → fetches candidate pages → embeds each → cross-encoder reranks against the misconception `description` → top 3–4 → LLM writes a one-line rationale per pick → **teacher approves before any student sees them** → approved rows become `resource`. Nothing is indexed permanently; provenance records the URLs. |

### 7.3 Indexing

The batch runner (re)embeds `concept_doc_chunk` and `item_embedding` on content change (a Postgres trigger enqueues a job, or a nightly full pass — pilot scale makes either fine). Embedding model and dimension are fixed once and recorded; changing the embedding model means a full re-index and is a versioned event.

---

## 8. The AI product surface — feature by feature

### 8.1 Study Notes (Feature 6)

Tier-1 misconceptions get **authored** notes (teacher-written, `origin=authored`). For long-tail / newly-generated misconceptions, the drafter LLM produces a `study_note` draft from `misconception.description` + one worked example, which **a teacher approves** before it is shown. `llm_call_id` + `provenance_entry` on every generated note.

### 8.2 YouTube Video Links (Feature 7) + AI Resource Finder (Feature 8b)

Feature 7 is the curated case: a teacher/admin attaches a known good video to a misconception (`resource`, `origin=curated`). Feature 8b is the automated case (§7.2 #4): search → rerank → rationale → **teacher approval** → `resource(origin=found)`. Students only ever see approved resources. The Learning Hub (Feature 8a) is a read view over `misconception` + `study_note` + approved `resource` + `concept_doc`, keyed by the catalogue — no new backend, just a query.

### 8.3 AI Consultant (Features 8 + 10) — one component, two roles

**Not a chatbot with a corpus.** A pattern-observation service over structured history.

```
Teacher/student asks a scoped question (or opens the panel)
      │
      ▼
Next.js BFF builds a STRUCTURED context by SQL:
  • pace role: this student's diagnoses, time-to-resolve per misconception,
    verification results, class medians for comparison
  • escalation role: the escalated session's steps + posteriors, plus
    which classmates show the same answer pattern
      │
      ▼
One bounded LLM call: "given these rows, state at most N observations,
each as {claim, evidence: [row refs], confidence}". Template-fixed.
      │
      ▼
Response rendered with every claim's evidence rows shown beneath it.
For the teacher: proposals go into the review queue as labelled
suggestions (escalation.ai_suggestion_id) — never a diagnosis.
      │
      ▼
llm_call_log + provenance_entry(artefact_type=consultant_suggestion)
```

Guardrails: the model is told it may only reference the supplied rows; any claim without an evidence ref is dropped before render; it cannot write to `diagnosis` or `teacher_review`. The suggested-prompt chips in the PoC map to fixed SQL context builders; free-text questions that don't match a builder get a "I can only speak to what the session/class history shows" response (matching the PoC's fallback).

### 8.4 Concept Tutor Chat (Feature 8c)

RAG over `concept_doc_chunk`, scoped to one misconception (§7.2 #1). Persistent affordances ("explain it simpler", "harder example") are fixed retrieval+prompt presets. Every answer: retrieve → ground → answer-or-abstain → log. It is explicitly *not* the Consultant (no access to the student's session history) and *not* a general chatbot (no answer without supporting chunks). Threads stored in `tutor_thread` / `tutor_message`.

### 8.5 AI Consultant escalation suggestions → the review queue (Feature 10)

When a session escalates, the batch/consultant path writes an `escalation` with an `ai_suggestion_id` pointing at a logged suggestion. The teacher's review screen shows it labelled "AI Consultant suggestion — an idea to weigh, not a diagnosis," alongside the full evidence trace. The teacher's decision (`teacher_review`) is what counts.

### 8.6 Parent Summary rewrite (Feature 11)

`diagnosis` + `intervention` → one bounded LLM rewrite into three plain-language fields → **embedding-similarity check** between the rewrite and the structured source (must exceed a floor) → store `parent_summary` with `similarity_ok`. If the check fails or the model is unreachable: show the structured diagnosis directly (`llm_call_log.outcome=fallback`). Parents never see anything until `teacher_review.decision ∈ {approved, corrected}` (visibility gate already modelled in the PoC's `PARENT_SUMMARIES`).

### 8.7 Self-Improving Question Bank (Features 12–17, 16a)

```
NIGHTLY (batch runner, deterministic):
  Gap scan over the Q-matrix
    • separator gaps: for every construct, find misconception pairs that
      predict the SAME option on some item AND have NO item where they
      predict DIFFERENT options → coverage_gap(kind=separator)
    • thin-coverage gaps: misconceptions with < K items targeting them
      → coverage_gap(kind=thin_coverage)
    (also raised live by the engine on escalation — §5.3)
      │
      ▼
PER OPEN GAP (generation_run):
  ┌─ round loop ─────────────────────────────────────────────────────┐
  │ 1. Drafter LLM: draft M candidate stems for this gap, given          │
  │    - the misconception description(s)                                │
  │    - few-shot exemplars retrieved from item_embedding (§7.2 #2)      │
  │    - subject template (maths: numeric params; phys/chem: hand rules) │
  │ 2. Distractor Engine:                                               │
  │    - MATHS: compute the 4 options from numeric_params by applying    │
  │      each misconception's error rule → options are provably correct  │
  │    - PHYS/CHEM: LLM proposes options, then rule/consistency checks   │
  │ 3. Misconception Engine: LLM proposes option→misconception mapping,  │
  │    THEN the deterministic engine verifies the target pair now        │
  │    predicts DIFFERENT options (the whole point) → mapping_source=    │
  │    engine_verified or rejected                                      │
  │ 4. Near-duplicate guard (§7.2 #3) → reject if too close to a live item│
  │ 5. QUALITY SCORER (Feature 16a):                                   │
  │      NOW  → LLM-judge against a fixed rubric, returns               │
  │             {overall, clarity, difficulty_fit, distractor_plausibility,│
  │              targets_misconception, unambiguous, reason}            │
  │      LATER→ a trained classifier (sentence-embedding features +      │
  │             gradient boosting) once generation_review has enough     │
  │             approve/reject labels; LLM-judge stays as the cold-start │
  │             and as a feature input. Migration is a versioned swap;   │
  │             scorer_model is recorded per run.                       │
  │    score < pass_mark → generated_item.status=rejected + reason      │
  │    score ≥ pass_mark → status=kept                                 │
  └────── repeat until kept count ∈ [target_min, target_max] or         │
         max rounds ─────────────────────────────────────────────────┘
      │
      ▼
Batch of kept items → generation_review (Feature 17):
  • separator item: two reviewers, agreement/adjudication
  • thin-coverage batch: per-item Approve / Edit / Reject, then commit
      │
      ▼
Approved → materialise as item + item_option + q_matrix_entry rows under a
new content_version; coverage_gap.status=closed; provenance_entry written.
```

**Why the ML scorer is honestly "a model":** the LLM-judge is a scoring model in the sense that matters — it produces a calibrated numeric score from a rubric and drives an automated accept/reject loop with no human in it until the batch is done. The trained-classifier migration makes it "ML" in the narrower sense once labels exist, and the report can show both the rubric definition and (later) the classifier's validation curve. This also gives the Content member a genuine psychometrics artefact: the rubric, its inter-rater agreement against teacher decisions, and the classifier's learning curve.

### 8.8 Classes, enrolment, messaging (Features 11a–11d)

Straight CRUD over §4.3. `class.join_code` for Feature 11b; a student joining is an `enrolment` insert. Announcements are `announcement` rows, read-only for students. DMs are `dm_thread` + `dm_message`; the teacher inbox unions `teacher_student` and `teacher_parent` threads with a label. Realtime: polling for the pilot; SSE later (§12). No AI anywhere in this cluster — deliberately (Feature 11d note: "the people talking, not the model").

---

## 9. Trust & Accountability (Features 18–20)

| Feature | Mechanism |
|---|---|
| **18 Full Evidence Trail** | `session_step` is append-only; every posterior, every item, every `selection_reason` is stored. The teacher evidence panel is a straight render of `GET /engine/sessions/{id}/trace`. No summarisation, no deletion. |
| **19 Generation Provenance Log** | Exactly one `provenance_entry` per AI artefact (question, distractor set, study note, resource, consultant suggestion, generation run), carrying model+version+prompt-hash, grounding refs, validators, status. Plus `llm_call_log` for every individual call. The admin "Provenance" screen is a query over these. |
| **20 Performance Reporting** | The evaluation harness (§10) — not a screen with a made-up accuracy number. Sir Ali's note ("remove Accuracy from admin, define each metric mathematically") is honoured: the admin surface shows *study results with their definitions*, computed offline, not a live gauge. |

---

## 10. Evaluation harness (Feature 20 / ConceptBridge V1–V3) — define every metric mathematically

Runs offline against the engine service in a test configuration. Produces the report's charts. **Each metric is defined here so the admin/report surface can cite the definition, not a bare number.**

| Metric | Definition | Used in |
|---|---|---|
| **Items-to-diagnosis** | For a session that reaches `diagnosed`: the number of answered `session_step` rows. Reported as a distribution (median, IQR), per selection policy. | V1 |
| **Misdiagnosis rate** | On synthetic students with a known true misconception `m*`: `P(diagnosis.misconception ≠ m* \| outcome = diagnosed)`. | V1 |
| **Expected information gain (per item)** | `EIG = H(p) − Σ_o P(o)·H(p\|o)` (§5.2), `H` = Shannon entropy in bits. Logged on every step (`session_step.expected_ig`); the mean over a session is the "question efficiency" figure. | V1, live |
| **Escalation precision / recall** | Precision = `P(the case was genuinely undiagnosable \| engine escalated)`; recall = `P(engine escalated \| genuinely undiagnosable)`. "Genuinely undiagnosable" = no item sequence separates the true candidates given the Q-matrix (checkable in simulation) or teacher judgement (pilot). | V1, V4, ConceptBridge C2 |
| **Accuracy vs catalogue size** | Diagnosis accuracy `P(correct \| diagnosed)` as a function of the number of candidate misconceptions (10 / 50 / 150), for three arms: one-shot LLM classification, retrieve-and-rerank, ConceptBridge sequential. | **V2 — the headline chart** |
| **Resolution rate** | `P(verification_check(immediate).result = resolved \| intervention delivered)`. | V4 |
| **Durability rate** | `P(verification_check(delayed).result = resolved \| immediate result = resolved)`. Requires the delayed check to have fired — hence the fixed pilot-launch gate. | V4, ConceptBridge E7 |
| **Calibration error (slip/guess)** | For calibrated `slip_h`, `guess_h`: the gap between predicted and empirical option frequencies on held-out responses, plus a sensitivity sweep (`±20%` on each parameter → change in misdiagnosis rate). | V1, ConceptBridge E5 |
| **Offline match rate** | Agreement between the engine's diagnosis and Eedi ground-truth misconception labels on held-out Eedi items. | V3 |
| **Generation yield** | Per `generation_run`: `kept / drafted`, and `approved / kept` (teacher acceptance of the scorer's output). Calibrates the rubric / classifier. | pipeline, report |

Arms for V2 (all implemented by the team, run offline, no school needed — the de-risking result):
- **A1** one-shot open-LLM classification from the full response set;
- **A2** retrieve-and-rerank (embed the response, retrieve nearest labelled examples, LLM picks);
- **A3** the ConceptBridge sequential engine.

---

## 11. Cross-cutting concerns

### 11.1 Auth & RBAC

Four roles. Every query is scoped: a student sees their own sessions/classes; a parent sees only linked children's *approved* summaries and their own DM thread; a teacher sees their classes' students, sessions, and the review/escalation queues; admin sees the catalogue, provenance, and evaluation results. Enforced at the BFF (row filters) and re-checked in the engine service (it trusts a signed caller identity from Next, not the browser).

### 11.2 Service-to-service contract

Next ⟷ engine and Next ⟷ model are internal REST/JSON over a private network, authenticated with a shared secret or mTLS. The engine ⟷ model calls (few-shot, judge) go direct. No service is internet-exposed except Next.js. The web search endpoint is called only from the Next.js server.

### 11.3 Degradation (a testable NFR — ConceptBridge §5.2)

| If down… | Effect |
|---|---|
| **Model service** | Diagnosis, verification, review, messaging, classes — all unaffected. Parent summary → structured fallback. Tutor / Consultant / Resource Finder → "temporarily unavailable." Generation runs → paused, resume when back. |
| **Engine service** | No new diagnostic sessions; existing data, review, chats, messaging still work. |
| **Postgres** | Hard down (as any system). |
| **Internet** | Only the Resource Finder degrades. The whole diagnostic + remediation + verification loop runs in a disconnected lab — a direct consequence of self-hosting the models. Worth stating in the ethics application. |

### 11.4 Privacy / ethics

- Student answers and diagnoses never leave the deployment — self-hosted models, no third-party API. This removes a whole class of ethics-review objections.
- `llm_call_log` records exactly what each prompt contained; the templates send codes and values, not names, by construction.
- Pilot data governed by the ethics approval; role-scoped access; append-only audit; export/delete tooling for participant withdrawal.

### 11.5 Observability

Structured logs per service; `llm_call_log` doubles as the AI cost/usage ledger (tokens, latency, fallback rate) for the report; engine timing metrics (target: sub-second selection — ConceptBridge NFR); a nightly job-health summary (calibration ran, gap scan ran, N generation runs, N items pending review).

---

## 12. Open decisions register

| # | Decision | Options | Recommendation | Settle by |
|---|---|---|---|---|
| D-1 | Generation model (exact) + quantisation | 7–14B vs 32B; AWQ/GPTQ vs GGUF; which family | Smallest model that passes a held-out generation+judge quality bar on the real GPU; keep a 32B option for the drafter only if it fits | D1 (needs the GPU) |
| D-2 | Embedding + reranker model | `bge` / `e5` / `gte` / `nomic` families | Pick one embedding model, freeze the dimension, record it; `bge-reranker` class for the reranker | D1 |
| D-3 | GPU / hosting | university GPU, cheap cloud GPU (spot), or CPU-only (small model, slow) | One GPU box for model service + batch runner; app box separate | D1 |
| D-4 | Migration ownership across the shared DB | see §4.7 | Product tables → Next (Prisma/Drizzle); engine tables → Python (Alembic); one agreed ordering | D1 |
| D-5 | Realtime transport for messaging | polling / SSE / WebSockets | Polling for the pilot; SSE if it feels slow | D2 |
| D-6 | Web search source for the Resource Finder | self-hosted SearXNG / Brave API / SerpAPI / Bing | SearXNG self-hosted (no key, no cost, no data leaving); an API as fallback | D2/D3 |
| D-7 | Trained item-scorer: when to switch from the LLM-judge | at N labelled decisions (e.g. ≥ 300) with acceptable validation AUC | Ship the LLM-judge; switch only when the classifier beats it on held-out teacher decisions | D3/D4 |
| D-8 | `posterior` storage shape | JSON column vs narrow table | Choose from query and audit needs; revisit after V1. | Iteration 2 |
| D-9 | Job queue vs cron | `pg-boss` / Celery-RQ / plain cron | cron for the pilot; a queue only if runs need retries/visibility | D2 |
| D-10 | Isomorphic post-test items for Physics/Chemistry | generator (not feasible) vs hand-authored pools | hand-authored pools, 3 per Tier-1 misconception — a stated scaling limitation (ConceptBridge) | D3 |

---

## 13. Implementation sequence

The four-iteration sequence, initial repository boundary, work packages, and evaluation gates are defined in [ROADMAP.md](ROADMAP.md). This design specifies the target components and contracts; the roadmap determines when each component is built and evidenced. Keep the diagnostic core independently testable from the AI product surface throughout the build.

---

## Appendix A — feature → architecture index

| Feature | Where in this doc |
|---|---|
| 1 Adaptive Misconception Diagnosis | §5.1 |
| 2 Smart Follow-Up Questions | §5.2 |
| 3 Honest "Not Sure Yet" | §5.3 |
| 4 Fresh-Question Verification | §5.4, §4.2 (`verification_check`) |
| 5 One Engine, Three Subjects | §5.5 |
| 6 Study Notes | §8.1, §4.5 (`study_note`) |
| 7 YouTube Video Links | §8.2, §4.5 (`resource`) |
| 8 AI Consultant — Pace Insights | §8.3, §7.1 |
| 8a Learning Hub | §8.2 (read view) |
| 8b AI Resource Finder | §7.2 #4, §8.2 |
| 8c Concept Tutor Chat | §8.4, §7.2 #1 |
| 9 Teacher Review & Approval | §4.4 (`teacher_review`), §11.1 |
| 10 AI Consultant — Escalation Support | §8.3, §8.5 |
| 11 Parent Summary | §8.6, §4.4 (`parent_summary`) |
| 11a Classes | §8.8, §4.3 (`class`) |
| 11b Create / Join a Class | §8.8 (`join_code`, `enrolment`) |
| 11c Class Announcement Stream | §8.8, §4.3 (`announcement`) |
| 11d Direct Messaging | §8.8, §4.3 (`dm_thread`, `dm_message`) |
| 12 No Dead Ends | §8.7 (loop guarantee) |
| 13 Gap Detection | §8.7 (nightly scan), §4.6 (`coverage_gap`) |
| 14 Question Generator | §8.7 step 1, §7.2 #2 |
| 15 Distractor Engine | §8.7 step 2 |
| 16 Misconception Engine | §8.7 step 3 |
| 16a Automated Quality Scoring Loop | §8.7 step 5, §12 D-7 |
| 17 Teacher Validation Queue | §8.7 (review), §4.6 (`generation_review`) |
| 18 Full Evidence Trail | §9, §4.2 (`session_step` append-only) |
| 19 Generation Provenance Log | §9, §4.6 (`provenance_entry`, `llm_call_log`) |
| 20 Performance Reporting | §9, §10 (evaluation harness + metric definitions) |

---

## Appendix B — the one invariant, restated

**No LLM output is authoritative, and no LLM call is on the critical path of a diagnosis.**

- The engine diagnoses. It is closed-form and has no model dependency.
- The LLM drafts, rewrites, retrieves, and suggests.
- A teacher approves generated questions and diagnosis-derived content before release; direct concept chat is bounded and logged under its own policy.
- Every AI artefact has provenance; every AI call is logged.

If the model service is unavailable, the deterministic engine still diagnoses and verifies misconceptions. V1 and the engine side of V3 can run without it; V2's LLM comparator and the optional AI product features require the model service. This boundary keeps the diagnostic decision independent of generative output.
