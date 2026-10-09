# Sonder — project scope and research plan

Sonder is a teacher-supervised platform for diagnosing specific misconceptions in Grade 8 **Mathematics, Physics, and Chemistry**. The project was originally called ConceptBridge; older source material may use that name. This document states the intended product and research scope. [ENGINEERING.md](ENGINEERING.md) describes the proposed system, [ROADMAP.md](ROADMAP.md) sequences the work, and [POC.md](POC.md) identifies the separate proposal-defence demonstration.

## Problem and contribution

A wrong multiple-choice answer can be consistent with more than one misconception. Assigning one label immediately can direct a student toward the wrong intervention. Sonder maintains a probability distribution over candidate misconceptions, chooses a follow-up question intended to separate the candidates, and escalates to a teacher when the evidence is insufficient. A teacher reviews the outcome before it becomes a student or parent summary. The product then checks whether the correction held using a fresh question, including a delayed check.

**Complex computing problem:** given ambiguous response evidence and a limited question budget, select the next item that maximizes expected reduction in uncertainty without issuing a false-confidence diagnosis. The algorithm must work from the same content interface across all three subjects and leave an auditable explanation of each decision.

Bayesian updating and entropy-based item selection are established methods. Sonder's proposed contribution is to implement and evaluate sequential discrimination, explicit refusal, teacher oversight, and remediate/verify behavior together. The evaluation must compare against simpler baselines; a polished UI alone is not the research result. SDG 4 is motivation, not a substitute for the computing contribution.

## Users and main workflow

| User | Intended interaction |
| --- | --- |
| Student | Answers diagnostic questions, receives teacher-approved remediation, uses a learning hub, and takes verification checks. |
| Teacher | Sees question-by-question evidence, approves/corrects/rejects a diagnosis, resolves escalations, reviews generated content, and communicates with a class or parent. |
| Parent | Receives a plain-language summary only after teacher approval and may communicate with the teacher. |
| Admin/content reviewer | Maintains catalogues and coverage, checks generation provenance, and views aggregate performance evidence. |

Planned path: **answer → update hypotheses → choose discriminating item or refuse → teacher review → intervention → immediate and delayed verification → evidence and reporting**. Student and parent views receive an appropriate explanation, not raw hypothesis probabilities.

## Feature register

These are the intended product features. The [roadmap](ROADMAP.md) assigns them to iterations; being scheduled later does not remove a feature from scope.

| ID | Feature | Intended behavior |
| --- | --- | --- |
| 1 | Adaptive misconception diagnosis | Maintain evidence over named misconceptions rather than grade only right/wrong. |
| 2 | Smart follow-up questions | Select a question to distinguish competing explanations. |
| 3 | Honest “not sure yet” | Refuse a diagnosis and escalate when the evidence does not support one. |
| 4 | Fresh-question verification | Recheck a corrected misconception with a different item immediately and after 14–21 days. |
| 5 | One engine, three subjects | Use the same diagnostic algorithm across Maths, Physics, and Chemistry; subject differences live in content. |
| 6 | Study notes | Explain the diagnosed misconception and correct reasoning to the student. |
| 7 | Video links | Provide a vetted resource relevant to the intervention. |
| 8 | AI Consultant: learning pace | Suggest study focus from a student's history with visible evidence and teacher oversight. |
| 8a | Learning Hub | Let students browse concept explanations and worked examples without a diagnosis. |
| 8b | AI Resource Finder | Rank a small set of external resources and explain each choice. |
| 8c | Concept Tutor Chat | Answer questions about one concept using a bounded, grounded source corpus. |
| 9 | Teacher review | Require approve, correct, or reject action with evidence before a diagnosis is released. |
| 10 | AI Consultant: escalation | Suggest possible explanations to the teacher; never diagnose autonomously. |
| 11 | Parent summary | Show only a teacher-approved, plain-language outcome. |
| 11a | Classes | Give teachers a class roster, activity, and review/escalation view. |
| 11b | Create/join class | Use join codes and allow appropriate student enrollment. |
| 11c | Announcements | Teacher-to-class announcement stream. |
| 11d | Direct messaging | Separate teacher–student and teacher–parent threads. |
| 12 | No dead ends | Detect diagnostic coverage that cannot resolve a pair or topic. |
| 13 | Gap detection | Scan the content bank for indistinguishable misconception pairs. |
| 14 | Question generation | Draft questions intended to close a detected gap. |
| 15 | Distractor engine | Produce plausible answer options; compute mathematically checkable Maths distractors from the item values. |
| 16 | Misconception engine | Map wrong options to plausible misconceptions and check that target candidates separate. |
| 16a | Quality scoring loop | Filter weak drafts against a fixed rubric before teacher review. |
| 17 | Teacher validation queue | Admit generated items only after human review and approval. |
| 18 | Evidence trail | Record questions, answers, posterior updates, selection reasons, and human decisions. |
| 19 | Generation provenance | Record model, source context, time, validation, and version for AI-generated artefacts. |
| 20 | Performance reporting | Report accuracy, refusal, question efficiency, calibration, and baseline comparisons with explicit definitions. |

## Technical and AI boundary

The diagnostic decision path is **deterministic and auditable**: a versioned item bank and Q-matrix, calibrated response model, posterior update, expected-information-gain selection, stopping/refusal policy, and evidence trail. No LLM or retrieval result may determine the live diagnosis. AI may draft, rewrite, retrieve, score, or suggest within bounded interfaces. Generated content cannot enter the live bank without human validation; AI explanations cannot overwrite the engine's evidence. See [ENGINEERING.md](ENGINEERING.md) for components and data contracts.

The proposal-defence [PoC](POC.md) demonstrates screens and flows with fixtures. It is not the FYP production implementation and must be labelled accordingly when shown.

## Dataset and content plan

For each subject, the team will maintain a misconception catalogue, questions and options, predicted misconception-to-option mapping (Q-matrix), confusability groups, source/provenance records, review decisions, and content versions. Mathematics draws on the Eedi misconception source and team-authored diagnostic items. Physics and Chemistry require literature-backed misconception sourcing and team-authored items. Content can be included in the diagnostic engine only after scope, licensing, mapping, and reviewer checks are recorded.

The local `Data_Maths-Phy-Chem/` directory is **working material** and is deliberately outside the initial documents-plus-PoC repository package. Iteration 1 defines the first bounded, reviewed content pack and its import/validation contract. The dataset will be added to the new repository separately when the team chooses the version to publish. Draft batches and review decisions must not be presented as approved live content.

## Requirements and success measures

| Requirement | Planned acceptance evidence |
| --- | --- |
| FR-01: adaptive selection | The next item is selected from a computed posterior and expected information gain; test cases show the selected item and alternatives. |
| FR-02: insufficient evidence | A distinct refusal state is produced under specified conditions and reaches the teacher with the full trace. |
| FR-03: subject-independent engine | The same engine API and rules run on three versioned subject packs without subject-specific branches. |
| FR-04: teacher gate | A student or parent cannot receive a diagnosis until the authorized teacher action is recorded. |
| FR-05: communication | Class announcements and direct threads respect role and class/parent access rules. |
| NFR: latency | Measure posterior update plus selection against the planned **under 300 ms** target on the chosen hardware. |
| NFR: low bandwidth | Demonstrate a usable flow around **2 Mbps**, with session recovery after interruption. |
| NFR: refusal calibration | Evaluate confident-misdiagnosis and coverage **together**; planned targets are at most **5%** confident misdiagnosis and at least **70%** coverage on a specified held-out set. |
| NFR: privacy/audit | Use pseudonymous study identifiers, role-scoped access, and an append-only audit of content and review actions. |

Acceptance criteria must name their dataset, denominator, threshold, environment, and test method in the SRS; a simulated PoC display does not satisfy a production requirement.

## Evaluation plan

| Study | Question |
| --- | --- |
| V1: simulation | Does entropy selection improve items-to-diagnosis and error/refusal behavior versus fixed or random selection under known synthetic truth and noise? |
| V2: baseline comparison | How does sequential diagnosis compare with one-shot LLM classification and retrieval/reranking on the same labelled examples as catalogue size changes? |
| V3: offline matching | How often does the engine's diagnosis agree with held-out Eedi labels, with disagreements analyzed? |
| V4: classroom pilot | Can a teacher-led diagnose → intervene → immediate verify → delayed verify cycle run with consent, and what outcomes and limitations are observed? |
| V5: contextual validity | Do teachers judge the catalogue entries and wording suitable for the intended Grade 8 context, with reviewer agreement recorded? |
| V6: pre-pilot item check | Do student answer choices on drafted items match the Q-matrix's predicted distractor behavior? |

Report outcomes by subject and failure category, not only one aggregate accuracy. Include items-to-diagnosis, misdiagnosis conditional on diagnosis, escalation precision/recall, coverage, calibration (for example Brier score and reliability), immediate resolution, and delayed durability where the evidence supports them. Negative results are reportable results, not grounds to hide a study.

## Exclusions and boundaries

The project does not claim to diagnose every misconception, prove general effectiveness from a small pilot, perform clinical or psychological assessment, generate an entire curriculum automatically, or learn directly from live minors' data without a reviewed process. A tutor or consultant may explain or suggest, but it cannot bypass the diagnostic engine or teacher gate. A pilot involving minors requires the institution's approvals, consent, privacy controls, and an agreed withdrawal process before participation.

## Team workstreams

The plan divides technical work into **Engine & Evaluation**, **Content & Psychometrics**, and **Product, Security & Deployment**. Every work package also needs an integration and review owner. The final Gantt and task board will attach the team's names and dates to those roles; the role split here defines responsibility without assuming a specific person from a draft screenshot.
