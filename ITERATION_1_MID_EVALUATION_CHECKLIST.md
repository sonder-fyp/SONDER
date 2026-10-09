# Iteration 1 and FYP-1 Mid-1: master work checklist

Use this file to plan and track the work due **before the Mid-1 evaluation**. It combines the team's [Iteration 1 roadmap](docs/ROADMAP.md), the supervisor's [FYP-1 Mid Student Evidence Worksheet](docs/reference/FYP1_Mid_Student_Evidence_Worksheet.docx), and the [mid-evaluation guide](docs/MID_EVALUATION.md). The approved scope and technical design remain in [PROJECT.md](docs/PROJECT.md) and [ENGINEERING.md](docs/ENGINEERING.md).

**How to use it:** assign each item an owner and due date in the team's task board; link its issue, commit, file, test, or report page when evidence exists; then tick it. Do not mark a planned feature as implemented or a draft dataset as reviewed. The worksheet has separate fields for actual status, variance, and recovery. Keep those accurate at evaluation time.

**Two kinds of work are listed here:** the Math-first engine, adapted PoC, initial dashboards/classes, and subject-content drafts are the **team's Iteration 1 commitment**. The worksheet's evidence, report, and submission items are **Mid-1 preparation requirements**. The worksheet does not specify a completion percentage, a number of screens, or a full three-subject dataset for Mid-1.

## Files and artefacts to prepare

These are deliverable types, not mandatory filenames or a prescribed folder structure. Confirm exact filenames and formats against the department instructions.

| Artefact | What it must contain or show | Submission status |
| --- | --- | --- |
| Completed **editable supervisor worksheet** | All applicable tables, individual sections, evidence indexes, and confirmations | Submit with mid report at least 48 hours before evaluation |
| **FYP-1 mid report** | The department's prescribed format and all Form 3 evidence | Submit with worksheet at least 48 hours before evaluation |
| **Presentation slides** | Form 2 narrative, updated Gantt, diagrams, demo route, tests, member evidence | Prepare for presentation; submit a slide file only if officially requested |
| **Runnable evaluation build and source** | Adapted PoC screens connected to the real Math engine, initial dashboards/classes, and clean setup instructions | Make available for live demo and supervisor inspection |
| **Reviewed Math demo content and validator** | Versioned approved subset, Q-matrix, provenance, review record, validation output | Commit with the evaluated build |
| **Physics/Chemistry draft content** | Formulated material clearly marked as draft and separate from the live engine | Track as Iteration 1 work; commit only material suitable for repository review |
| **Requirements and design artefacts** | SRS/SDS drafts or prescribed equivalents, traceability table, architecture, data/process/behavior diagrams, decisions | Reference in report, worksheet, and repository |
| **Proposal action register, Gantt, task log** | Exact panel comments, owners/dates, milestone progress, issue/commit/review links | Reference in presentation, report, and worksheet |
| **Tests and validation record** | Commands, data/version, expected and actual results, normal/edge/failure evidence, limitation analysis | Reference in report, worksheet, and live discussion |
| **Demo runbook and six-step script** | Start/restart commands, inputs, expected results, visible evidence, presenters, fallback | Rehearse and keep available at evaluation |
| **Tool, dataset, asset, risk, and member evidence** | Material assistance and validation, licensing/privacy, each member's linked contribution | Reference in worksheet and report |

## 0. Dates, owners, and evaluation boundary

- [ ] Record the registered project title and ID, panel number if assigned, supervisor, three members and registration numbers, GitHub identities, and scheduled evaluation date/time. Use the approved title, not an assumed one.
- [ ] Get the department's **prescribed FYP-1 mid-report template/format** and any official evaluation notice or submission instructions. The worksheet does not contain the report template or meeting date.
- [ ] Calculate the submission deadline: **at least 48 hours before the evaluation meeting** for the completed editable worksheet **together with** the prescribed mid report. Confirm the submission channel with the supervisor or department.
- [ ] Convert roadmap months M1–M2 and the draft Gantt into real dates. Show the Mid-1 gate, dataset review, engine integration, tests, evidence freeze, report review, and submission deadline.
- [ ] Decide named owners, reviewers, and dates for I1-01 through I1-08; enter these in issues/tasks and the worksheet. The roadmap's Product, Content, and Engine labels are roles, not assignments to named members.
- [ ] Agree the **Mid-1 implementation boundary**: which Math topic/version powers the live demo, which PoC screens are adapted, what initial dashboards/class actions work, and which views remain fixture-driven. Record later features as later work rather than removing them from approved scope.
- [ ] Agree the exact demo machine/environment, required dependencies, account/fixture data, network needs, and a fallback route if an external service is unavailable. The core calculation must remain runnable and explainable.

## 1. Proposal decision and action register — I1-01/I1-02; worksheet §2

- [ ] Obtain the exact proposal-panel decision and **every** panel comment or required modification. Include comments that remain open.
- [ ] For each comment, record its exact wording; accepted/adapted/not-adopted decision; reason; named owner; status; evidence link; and next action with date.
- [ ] Summarize completed and open actions, with evidence for each claimed completion.
- [ ] State whether the approved scope is unchanged, clarified, or formally reduced. Record supervisor approval for any exception or scope change.
- [ ] Connect proposal changes to the revised roadmap, requirements, designs, code, and report. Be ready to explain design evolution during the presentation.

## 2. Work plan, repository, and team process — I1-01; worksheet §§3, 7, 11

- [ ] Confirm the repository URL, `main` branch, and supervisor/team access. Verify access rather than relying on an invitation being sent.
- [ ] Set up issues/tasks for I1-01 through I1-08 with owner, reviewer, planned date, acceptance condition, dependency, and evidence link.
- [ ] Assign meaningful work to **each** member across design, content, implementation, tests, review, or integration. Keep a task and decision log; commit count alone is not contribution evidence.
- [ ] Define how code/content is reviewed and merged, who integrates the engine and UI, and how test failures or conflicts are recorded and resolved.
- [ ] Record planned versus actual milestone state, evidence, variance, blocker, revised date, and a specific recovery action for every Iteration 1 package. Do not write only “work harder.”
- [ ] State the Iteration 1 objective, whether it was met at evaluation time, the critical blocker if any, and the demonstrable Iteration 2/Final-1 outcome.
- [ ] Keep files required to reproduce the work in Git. Exclude secrets, `node_modules`, `.next`, caches, and unreviewed bulk material. Add the **reviewed Math demo subset** with its provenance and version before freezing the evaluation commit.
- [ ] Preserve a way to identify the original proposal-defence PoC in Git history. Identify later adapted screens and remaining scripted views accurately.

## 3. Scope, requirements, acceptance, and traceability — I1-02; worksheet §5

- [ ] Write a concise problem statement, primary users, approved product vision, module list, feasibility assumptions, and measurable overall success criteria.
- [ ] State what Iteration 1 commits to: reviewed Math demo content; real Bayes/entropy diagnostic core; connection to adapted PoC screens; initial dashboards/classes; early tests. State explicitly that Physics/Chemistry content is draft for now and messaging is later.
- [ ] Describe the user interactions for the live flow: enter an answer, update beliefs, select a follow-up or refuse, display evidence, and show relevant dashboard/class actions.
- [ ] Give each functional requirement an ID, clear behavior, inputs/outputs, boundary conditions, and an observable acceptance check.
- [ ] Give each nonfunctional requirement an ID and measurable method where applicable: reproducibility, response time, correctness, auditability, access/privacy, and safe handling of invalid data. Do not invent achieved numbers.
- [ ] Define acceptance criteria for the Math content pack, engine, PoC connection, dashboard/class flows, and tests. Identify which requirements are met, partial, deferred, or not met **from actual evidence near evaluation**.
- [ ] Maintain a traceability table: **requirement → design element → implementation path/function → test/result → demo step → owner**. Give every implemented Iteration 1 requirement a complete chain.
- [ ] Separate verified claims from planned research claims; label simulated cases as simulations, not classroom or student results.

## 4. Design artefacts and decisions — I1-02; worksheet §6

- [ ] Draw and explain an architecture showing adapted PoC frontend, real diagnostic engine, Math content source, storage/state if used, and interfaces. Identify fixture-only and live paths.
- [ ] Define the API/function contract for starting a Math diagnostic run, submitting an answer, returning posterior/next item or refusal, and obtaining the evidence trail. Include validation and error behavior.
- [ ] Prepare a data/schema or ERD artefact for the actual Iteration 1 content and run state: Math topic, misconception, item/options, Q-matrix mapping, version/review status, session, answer/step, posterior, and outcome as applicable.
- [ ] Prepare a process/data-flow artefact showing how a reviewed question becomes a live input and how an answer produces a calculated result.
- [ ] Prepare a behavior artefact (activity, sequence, or state diagram) for normal progression, follow-up, diagnosis/refusal, and failure handling. Show the real implemented boundary.
- [ ] Explain each artefact's purpose, version/date, link to code, and any change since the proposal. Record why the change was made.
- [ ] Record key architecture/interface decisions, alternatives considered, chosen option, trade-off, and supporting evidence. Resolve the minimum decisions needed to implement and reproduce the slice; mark later decisions as open.
- [ ] Keep design, requirements, code, test names, demo, and report consistent when implementation changes.

## 5. Mathematics content and Physics/Chemistry drafts — I1-03

### Math content used by the live engine

- [ ] Choose the Math topic(s) and define the planned coverage so “most Math material” can be measured. Treat broad coverage as a target; **only reviewed portions are finalized**.
- [ ] List the competing misconceptions and any `NONE`/unknown/unmodelled state used by the engine; define each clearly enough to distinguish it from the others.
- [ ] Formulate or curate questions, answer options, correct answers, and misconception-to-option/item mappings (Q-matrix). Include questions capable of separating ambiguous hypotheses.
- [ ] Record source, permission/licence, author or generator, reviewer, review date, review decision, and content version for the live subset. Disclose material tool/LLM assistance and human checks.
- [ ] Validate required fields, identifiers, option references, duplicate/conflicting mappings, and invalid or unusable questions. Record rejected items and corrections.
- [ ] Review the subset with the agreed content reviewer; distinguish draft, reviewed, and approved-for-demo items. Do not feed unreviewed Physics/Chemistry drafts into the Mid-1 engine.
- [ ] Commit the approved, versioned Math demo subset and its validation procedure/results. Ensure a clean checkout can run the same questions and reproduce the demo.
- [ ] Record Math coverage and remaining gaps honestly at Mid-1; full Math dataset completion is not a prerequisite claimed by this plan.

### Physics and Chemistry

- [ ] Formulate separate draft topics, candidate misconceptions, questions/options, and proposed mappings for Physics and Chemistry.
- [ ] Record their sources and draft/review status; keep them separate from the approved Math demo input.
- [ ] Identify the review and validation work needed before these packs can be used by the engine in a later iteration.

## 6. Real diagnostic engine — I1-04

- [ ] Implement a deterministic Math diagnostic module/service separate from fixture-scripted PoC outputs. Document dependency and configuration versions.
- [ ] Define prior probabilities, the answer-likelihood/slip/guess assumptions used, the update equation, numeric normalization, and behavior for zero/invalid probabilities. Make assumptions reviewable rather than presenting them as learned facts.
- [ ] On each answer, compute and record the posterior over competing misconceptions. Make the calculation and inputs reproducible.
- [ ] Compute entropy and **expected information gain** for eligible unused questions; select a discriminating next item using the implemented rule and document deterministic tie handling.
- [ ] Define stopping, question budget, no-separator, invalid-answer/content, and insufficient-evidence outcomes. Return an explicit refusal/escalation state when a supported diagnosis cannot be made.
- [ ] Emit an evidence trail containing the content version, item/answer sequence, posterior values, selection reason or information gain, and final outcome. Show how the trace is inspected in the demo.
- [ ] Keep generative AI outside the authoritative diagnostic calculation. Label any optional AI-derived content or display separately.
- [ ] Write unit tests with hand-checkable expected posterior and information-gain values, plus tie/no-separator/budget and invalid-input cases.
- [ ] Document the entry point, main files/functions, configuration, input/output examples, setup commands, and current limitations for the report and live questioning.

## 7. Adapted PoC, dashboards, and classes — I1-05/I1-06

- [ ] Select the proposal PoC screens to reuse for the live Math diagnostic flow and record the changes needed. Keep the original proposal version identifiable through the initial Git commit.
- [ ] Connect answer submission to the real engine and reviewed Math content. Confirm that displayed posterior, next question, and outcome come from the live calculation; label any remaining scripted examples.
- [ ] Show a coherent input → processing → output sequence, including a normal path and a refusal/error path. Provide a readable evidence view or log for technical explanation.
- [ ] Define the **specific initial dashboard functions** due by Mid-1, their user role, data source, and acceptance checks before implementation. Build and exercise those functions; distinguish live run data from PoC fixtures.
- [ ] Define the **specific basic class actions** due by Mid-1, their user role, data source, and acceptance checks before implementation. Build and exercise a class flow; document any fixture-driven parts.
- [ ] Keep announcements and direct messaging out of the Iteration 1 implementation commitment.
- [ ] Write an integration check that submits a Math answer through the chosen screen/interface and verifies a real engine response. Check the class flow and relevant dashboard data source.
- [ ] Provide clean run instructions, dependencies, versions, configuration example without secrets, test/build commands, and fixture/demo-account instructions. Test them from a clean checkout.

## 8. Testing and early validation — I1-07; worksheet §8

- [ ] Make a test/validation table with ID, requirement/module, method and dataset, expected result, actual result/metric, evidence link, and owner.
- [ ] Run and record a **normal case**: valid reviewed Math content, answer, posterior update, discriminating next item or justified diagnosis, and visible trace.
- [ ] Run and record an **edge/ambiguous case**: two plausible misconceptions, tie or weak separator, question-budget limit, or insufficient evidence; show the implemented safe outcome.
- [ ] Run and record a **failure case**: invalid answer, invalid Q-matrix/content, unavailable dependency, or other reproducible fault; show rejection or recovery without a fabricated diagnosis.
- [ ] Test the Math content validator, engine unit calculations, PoC-to-engine integration, dashboard/class flow, and clean setup/build. Record commands, data/version, environment, and outputs.
- [ ] Select at least one failure or edge case for discussion: condition, why it matters, observed behavior/log, what the result proves and does not prove, corrective action/owner/date if needed.
- [ ] Summarize current evidence, limitation, and next validation action for functional correctness, performance/resources, algorithm quality, user/field validation, and security/privacy. Write “not applicable yet” where justified.
- [ ] Distinguish synthetic/offline validation from tests with real students or teachers. Record ethics/permission requirements before any field activity.

## 9. Live demonstration and presentation — I1-05/I1-08; worksheet §4 and Form 2

- [ ] Name the **core module** precisely and explain why the real Math diagnostic engine is central to Sonder's approved problem.
- [ ] Write the demo's input type/source/validation, actual processing rule, observable output, dependencies, known limitations, and current technical boundary.
- [ ] Complete the implementation-boundary table for **client/interface, backend/service, core algorithm/model, and data/external dependency**: implemented/integrated, mocked/substituted, evidence, and plan to remove substitutes.
- [ ] Fill all **six** worksheet demo rows with action, expected result, visible evidence, and presenter. Include a normal case, an ambiguous/edge or failure case, and an explanation of the real calculation.
- [ ] Prepare and rehearse a live build from the evaluation commit/tag. Verify that the app launches, the content loads, answers reach the engine, and outputs/traces appear. Screenshots or video alone do not satisfy the live-core criterion.
- [ ] Prepare a slide deck for the presentation: approved problem and proposal response; updated Gantt and ownership; scope/requirements; architecture and data flow; Math content and engine method; live demo route; test results/limitations; member contributions; next iteration. Use readable diagrams and cite sources.
- [ ] Assign who presents each section and each demo step. Rehearse transitions, timings, likely technical questions, and a clean restart after a demo interruption.
- [ ] Keep a fallback build/environment and a written runbook for a network or machine issue. If a fallback is used, disclose what actually ran; preserve the real core calculation.
- [ ] Prepare concise answers each member can defend: their code/data/design, a test and failure, one design trade-off, material tool use and validation, and their next task.

## 10. Repository, evaluation version, and individual evidence — I1-08; worksheet §§7, 11

- [ ] Before the evidence freeze, review the integrated change, run required checks, verify the reviewed Math pack is included, and fix or document known defects.
- [ ] Create a **stable full commit SHA or release tag** only after integration and checks. Use that same identifier in the worksheet, report, slides/demo notes, and runnable artefact. Do not substitute a future branch head for the evaluated version.
- [ ] Prepare a repository evidence table linking each work item to owner, issue/task, commit/PR/tag, files/artefact, review/test evidence, and state.
- [ ] Record the task-tracking method, review practice, integration responsibility, team coordination decisions, and explanation of any large or late commits.
- [ ] For **each of the three members**, fill name/registration number, repository identity, primary technical ownership, most substantial contribution, a problem personally resolved, material tool-assisted work and validation, and a specific next task/date.
- [ ] For each member, link multiple concrete contributions to artefact, commit/issue/version, test/result, and role (designed, implemented, tested, reviewed, or integrated). Obtain that member's declaration and dated confirmation.
- [ ] Check that each member can locate, explain, test, and if asked modify the work attributed to them; explain their relevant architecture/data flow and a design alternative.

## 11. Prescribed FYP-1 mid report — I1-08; worksheet §9 and Form 3

The required report is a **mid-stage technical progress report in the department's prescribed format**. The worksheet is submitted alongside it; it is not the report template. Map all eight Form 3 criteria to actual report sections/pages and primary evidence.

- [ ] Follow the prescribed template: required title/front matter, headings, figures, tables, citations, references, appendices/annexes, and any department-specific formatting or submission rules.
- [ ] **Problem formulation, R&D, existing solutions (15 marks):** give stakeholder/literature/data evidence, relevant products/methods/prior FYPs, the remaining gap, Sonder's complex computing challenge, investigative method, findings to date, and claims still unproven.
- [ ] **Vision, scope, modules, success (10):** state approved users, module boundaries, current Iteration 1 slice, later modules, feasibility, and measurable success criteria.
- [ ] **Requirements and acceptance (15):** describe user interactions, precise FRs/NFRs, measurable checks, and traceability to design, code, tests, and demo.
- [ ] **Architecture/components/interfaces (15):** show chosen architecture, major components, data/service dependencies, interface contracts, alternatives, rationale, and changes from proposal.
- [ ] **Data/process/behavior design (10):** explain appropriate schema/ERD, data flow, activity, sequence or state artefacts and how they match the actual Math engine and adapted PoC implementation.
- [ ] **Completed-module implementation (15):** document the exact evaluation commit/tag; clean setup/execution; dependency versions; main files/classes/functions; data/configuration; algorithm and inputs/outputs; integration; technical decisions; known limitations and failure behavior. Another person should be able to reproduce it.
- [ ] **Testing/validation, tools, risk (15):** present test methods/data and early actual results, edge/failure analysis, future validation plan, external tools/dependencies, security/privacy, licensing, risks, and limitations.
- [ ] **Report format and artefacts (5):** verify all required prescribed sections, citations, figures/tables, and annexes are present and legible.
- [ ] Cite the source of every external fact, figure, dataset, code/asset, and method used in the report. Distinguish proposed outcomes, simulations, and observed results.
- [ ] Review the report against the frozen build, dataset version, test outputs, worksheet, and slides; correct conflicting claims and page references.

## 12. Complete the supervisor's editable worksheet — I1-08; worksheet §§1–12

- [ ] Fill project identification, roster, repository URL, full evaluation SHA/tag, and runnable artefact.
- [ ] Fill both official evaluation maps and the proposal action register, including open actions and scope consequences.
- [ ] Fill the Iteration 1 plan/progress table, objective status, blocker/recovery fields, and next-iteration outcome from actual evidence.
- [ ] Fill core-module input, processing, output, dependency, limitation, implementation-boundary, six-step demo, and normal/edge/failure tables.
- [ ] Fill scope, explicit exclusions, measurable success criteria, FR/NFR and acceptance table, and the requirement traceability table.
- [ ] Fill design-artefact and architecture-decision tables, with versions, implementation links, evolution, alternatives, and trade-offs.
- [ ] Fill repository work-item table, evaluation version, task tracking, reviews, integration, coordination, and any unusual commit history.
- [ ] Fill test/validation table, selected edge/failure discussion, and validation-quality table with current evidence and next steps.
- [ ] Fill the report-preparation table with a **section/page and primary artefact for every Form 3 criterion**; complete the R&D, claims-unproven, and reproducible-implementation prompts.
- [ ] Fill the tool/dependency/risk disclosure tables, including sensitive-data handling, security controls, licensing/attribution, external availability, and responsible LLM use.
- [ ] Have **each member complete and confirm** their individual evidence section and declaration.
- [ ] Fill the **Form 2 and Form 3 evidence indexes**: criterion, worksheet/report location, primary evidence, and owner. Complete the group final check and dated confirmations.
- [ ] Keep the worksheet editable for submission; check links and page numbers after the final report export. Do not self-award official marks or fill “ready” fields without evidence.

## 13. Tool, data, asset, security, and ethics record — worksheet §10

- [ ] List every material tool, LLM, model, service, library, dataset, or hardware dependency used: purpose, output incorporated, validation, limitation/risk, and owner. Keep evidence of corrections or rejected outputs.
- [ ] Record Math/Physics/Chemistry content sources, permissions/licences, provenance, review decisions, and which packs are allowed in the live build.
- [ ] Review PoC asset provenance and permitted reuse, especially third-party visuals/audio/model assets, before any public deployment or claim of original ownership.
- [ ] State whether any real student data is collected. If so, document consent/approval, access, storage, retention/deletion, and privacy controls; if none, state that clearly.
- [ ] Document role/access controls relevant to implemented screens, secret handling, dependency/security checks, and failure behavior. Do not put credentials or private data in Git, slides, logs, or the demo.
- [ ] State what happens if an external API, service, model, dataset, or network connection fails. Disclose any mocked fallback.
- [ ] Keep planned pilot/field validation subject to ethics and access approval; do not describe it as completed Mid-1 evidence unless it actually occurred.

## 14. Final 48-hour submission and evaluation-day check — I1-08

- [ ] Confirm the evaluation date, time, location/meeting link, presentation length, submission channel, required file formats, and recipient from the official notice/supervisor.
- [ ] Freeze the evaluated commit/tag, Math content version, test outputs, and runnable build. Verify a clean checkout and fresh setup one final time.
- [ ] Verify supervisor repository access and that the submitted URL, full SHA/tag, run instructions, dataset version, report, worksheet, and slides all describe the same build.
- [ ] Review the completed worksheet and prescribed report as a group. Check every table, signature/confirmation, external link, report page, citation, and evidence index.
- [ ] Submit the **editable completed worksheet and prescribed mid report at least 48 hours before** the meeting; retain submission proof. Submit slides or other files separately if the official instructions request them.
- [ ] Rehearse the live demo on the actual presentation machine with the frozen build, normal/edge/failure inputs, presenter assignments, restart procedure, and fallback environment.
- [ ] On evaluation day, have the repository, evaluation version, code, diagrams, tests, content provenance, action register, and report available for questions. Each member should be ready to explain and demonstrate their own contribution.

## Worksheet coverage cross-check

| Worksheet area | Main checklist sections |
| --- | --- |
| Submission package and project identification | 0, 2, 10, 14 |
| Form 2 presentation/live demo | 1–3, 6–10, 12, 14 |
| Form 3 mid report | 3–8, 11–14 |
| §2 Proposal action register | 1 |
| §3 Iteration progress | 0, 2, 12 |
| §4 Core module and live demo | 5–9, 12 |
| §5 Requirements and traceability | 3, 12 |
| §6 Design and evolution | 4, 12 |
| §7 Repository/team evidence | 2, 10, 12 |
| §8 Testing and validation | 8, 12 |
| §9 Mid report preparation | 11, 12 |
| §10 Tools/dependencies/risks | 13, 12 |
| §11 Individual evidence | 10, 12 |
| §12 Evidence indexes/final check | 12, 14 |

**Iteration 1 is ready for Mid‑1 when the evaluated Math core works live through the adapted interface, its reviewed data and tests are reproducible, the team's promised dashboard/class slice is evidenced, and every applicable worksheet and prescribed-report criterion has an honest, traceable answer.**
