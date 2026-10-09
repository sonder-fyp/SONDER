# Iteration 1 and Mid-1: team work division

This is a **proposed assignment checklist**, derived task by task from [ITERATION_1_MID_EVALUATION_CHECKLIST.md](ITERATION_1_MID_EVALUATION_CHECKLIST.md) and aligned with [ROADMAP.md](docs/ROADMAP.md). It assigns preparation, implementation, review, and evidence work for Mid-1. All boxes start unchecked; no item is claimed as complete. Enter actual dates, issue links, commits, results, and any agreed reassignment in the team board and supervisor worksheet.

**Names:** this plan treats "Laiq" as **Ahmed (Laiq)**, the third member named in the request. If those names refer to different people, correct the label before adopting the assignments. The registered roster and repository identities must come from the official project record.

**How an assignment works:** the **lead** produces the task's artefact and evidence. The **reviewer** independently checks it against the acceptance condition, reproduces relevant calculations/tests, identifies limitations or defects, and records a review or issue. For a defect, the reviewer proposes or contributes a fix with the lead; the lead reruns validation and both record the result. Review is technical work, not a ceremonial approval. For worksheet rows that say "each member," the listed lead coordinates the group record, while **all three still write and confirm their own evidence**.

| Member | Lead tasks | Independent review tasks | Main hands-on work |
| --- | ---: | ---: | --- |
| Ashher | 43 | 43 | Physics drafts; Math dataset review and correction; Bayesian assumptions/posterior and engine tests; dashboard/evidence flow; behavior/interface design; requirements and report sections. |
| Harris | 43 | 43 | Mathematics dataset and validation; entropy/information-gain selection and evidence trace; schema/data-flow design; testing and report sections; Chemistry review. |
| Ahmed (Laiq) | 43 | 43 | Chemistry drafts; engine module/integration and stopping/refusal; PoC connection and class slice; architecture design; failure testing and evaluation package; Physics review. |

**Task counts are a starting balance, not an hours estimate.** Harris's Math work is large, so Ashher's independent Math review includes active issue finding and agreed fixes; Ahmed checks the Math pack through the live integration. Estimate effort and rebalance dates or peripheral tasks if one person's workload is materially higher. Preserve named authors, reviewers, and actual contributions in Git and the worksheet.

| Lead-task area | Ashher | Harris | Ahmed (Laiq) |
| --- | ---: | ---: | ---: |
| Requirements and design | 5 | 6 | 5 |
| Dataset, engine, UI, and testing | 12 | 13 | 14 |
| Presentation and report | 6 | 7 | 7 |
| Planning, repository, worksheet, risk, and submission | 20 | 17 | 17 |

## High-impact technical handoffs

| Component | Build/prepare | Independent review and correction | Additional integration check |
| --- | --- | --- | --- |
| Math dataset, Q-matrix, provenance, validator | Harris | Ashher checks ambiguity, mapping quality, sources, invalid cases, and fixes issues with Harris | Ahmed confirms the reviewed version is the one loaded by the live engine |
| Physics draft | Ashher | Ahmed challenges mappings, source/review labels, and engine-readiness claims; fixes with Ashher | Harris checks shared data-contract compatibility |
| Chemistry draft | Ahmed (Laiq) | Harris challenges mappings, source/review labels, and engine-readiness claims; fixes with Ahmed | Ashher checks shared data-contract compatibility |
| Engine module and session wiring | Ahmed (Laiq) | Harris runs contract/session checks and files defects | Ashher checks use of Math content and assumptions |
| Priors, likelihoods, Bayesian posterior, core unit checks | Ashher | Ahmed recomputes examples, numeric edge cases, and unit results; fixes with Ashher | Harris checks compatibility with Q-matrix and selection |
| Entropy and expected-information-gain selection | Harris | Ashher independently calculates examples, ties, and weak separators; fixes with Harris | Ahmed checks end-to-end next-question output |
| Stopping, question budget, refusal, and AI boundary | Ahmed (Laiq) | Harris tests no-separator/budget/invalid conditions; fixes with Ahmed | Ashher checks safe wording and posterior assumptions |
| Evidence trail | Harris | Ashher checks content version, step sequence, posterior, and selection reasons; fixes with Harris | Ahmed checks display/API integration |
| PoC answer-to-engine connection and basic classes | Ahmed (Laiq) | Harris tests real versus fixture data and class actions; fixes with Ahmed | Ashher owns an independent answer-flow integration test |
| Initial dashboard functions | Ashher | Ahmed verifies data source and role behavior; fixes with Ashher | Harris checks Math result consistency |

## Balanced design, evidence, and presentation handoff

- **Requirements:** Harris drafts problem/success measures and NFR/traceability material; Ashher drafts live-flow interactions and functional requirements; Ahmed drafts iteration boundary and acceptance criteria. Each is independently reviewed in the task list below.
- **Design:** Ahmed owns the architecture and artefact inventory; Ashher owns the engine interface and behavior diagram; Harris owns data/schema and process-flow diagrams. Each artefact must link to the actual code and tests.
- **Report:** the Form 3 chapters are split in Section 11 below. Each author supplies their own sources, diagrams, technical evidence, and corrections; Ahmed coordinates final consistency, while all three review the full report.
- **Presentation:** each member prepares the slides for their technical work and speaks to that work. Harris assembles the deck and six-step script; Ashher explains Bayes/posterior and the evidence/diagnostic flow; Ahmed runs the integrated build and explains refusal, classes, and boundaries. Final speaking times and step presenters are agreed during rehearsal.
- **Worksheet:** assigned leads assemble the shared tables; each member fills and signs their personal Section 11. The completed editable worksheet and prescribed mid report are due **at least 48 hours before evaluation**. Slides are prepared for Form 2; submit a slide file only if official instructions request it.

| Final artefact | Assembly coordinator | Required contributions from others |
| --- | --- | --- |
| Completed editable worksheet | Ahmed (Laiq) | Each member supplies evidence, fills personal Section 11, checks assigned tables, and confirms the final version. |
| Prescribed mid report | Ahmed (Laiq) for final consistency | The chapter leads in Section 11 write their sections; all three verify claims and citations. |
| Presentation deck and six-step script | Harris | Ashher and Ahmed provide their technical slides and present/defend their work. |
| Runnable PoC-connected build | Ahmed (Laiq) for integration | Ashher supplies and tests Bayes/posterior behavior; Harris supplies Math content, selection, and trace. |
| Reviewed Math demo pack | Harris | Ashher independently reviews, finds/fixes issues with Harris; Ahmed tests the exact version in the live build. |
| Physics and Chemistry drafts | Ashher for Physics; Ahmed (Laiq) for Chemistry | Ahmed reviews Physics; Harris reviews Chemistry; each records provenance and remaining validation. |
| Requirements/design/evidence bundle | Harris maintains traceability and evidence links | Ashher and Ahmed deliver their assigned requirements, diagrams, tests, and review records. |

## Full task-by-task checklist

Each row mirrors a checkbox in the master checklist. Section 5 splits three combined Physics/Chemistry rows into separate Physics and Chemistry rows, giving **129 assignable rows for the master's 126 checkboxes**. Task IDs retain the source section number so the two files can be checked against each other.

## 0. Dates, owners, and evaluation boundary

- [ ] **T00.01 - Lead: Ashher; review: Ahmed (Laiq).** Record the registered project title and ID, panel number if assigned, supervisor, three members and registration numbers, GitHub identities, and scheduled evaluation date/time. Use the approved title, not an assumed one.
- [ ] **T00.02 - Lead: Ashher; review: Ahmed (Laiq).** Get the department's **prescribed FYP-1 mid-report template/format** and any official evaluation notice or submission instructions. The worksheet does not contain the report template or meeting date.
- [ ] **T00.03 - Lead: Ahmed (Laiq); review: Harris.** Calculate the submission deadline: **at least 48 hours before the evaluation meeting** for the completed editable worksheet **together with** the prescribed mid report. Confirm the submission channel with the supervisor or department.
- [ ] **T00.04 - Lead: Ashher; review: Ahmed (Laiq).** Convert roadmap months M1–M2 and the draft Gantt into real dates. Show the Mid-1 gate, dataset review, engine integration, tests, evidence freeze, report review, and submission deadline.
- [ ] **T00.05 - Lead: Harris; review: Ashher.** Decide named owners, reviewers, and dates for I1-01 through I1-08; enter these in issues/tasks and the worksheet. The roadmap's Product, Content, and Engine labels are roles, not assignments to named members.
- [ ] **T00.06 - Lead: Ahmed (Laiq); review: Harris.** Agree the **Mid-1 implementation boundary**: which Math topic/version powers the live demo, which PoC screens are adapted, what initial dashboards/class actions work, and which views remain fixture-driven. Record later features as later work rather than removing them from approved scope.
- [ ] **T00.07 - Lead: Ashher; review: Ahmed (Laiq).** Agree the exact demo machine/environment, required dependencies, account/fixture data, network needs, and a fallback route if an external service is unavailable. The core calculation must remain runnable and explainable.

## 1. Proposal decision and action register — I1-01/I1-02; worksheet §2

- [ ] **T01.01 - Lead: Harris; review: Ashher.** Obtain the exact proposal-panel decision and **every** panel comment or required modification. Include comments that remain open.
- [ ] **T01.02 - Lead: Ahmed (Laiq); review: Harris.** For each comment, record its exact wording; accepted/adapted/not-adopted decision; reason; named owner; status; evidence link; and next action with date.
- [ ] **T01.03 - Lead: Ashher; review: Ahmed (Laiq).** Summarize completed and open actions, with evidence for each claimed completion.
- [ ] **T01.04 - Lead: Harris; review: Ashher.** State whether the approved scope is unchanged, clarified, or formally reduced. Record supervisor approval for any exception or scope change.
- [ ] **T01.05 - Lead: Ahmed (Laiq); review: Harris.** Connect proposal changes to the revised roadmap, requirements, designs, code, and report. Be ready to explain design evolution during the presentation.

## 2. Work plan, repository, and team process — I1-01; worksheet §§3, 7, 11

- [ ] **T02.01 - Lead: Ahmed (Laiq); review: Harris.** Confirm the repository URL, `main` branch, and supervisor/team access. Verify access rather than relying on an invitation being sent.
- [ ] **T02.02 - Lead: Harris; review: Ashher.** Set up issues/tasks for I1-01 through I1-08 with owner, reviewer, planned date, acceptance condition, dependency, and evidence link.
- [ ] **T02.03 - Lead: Ashher; review: Ahmed (Laiq).** Assign meaningful work to **each** member across design, content, implementation, tests, review, or integration. Keep a task and decision log; commit count alone is not contribution evidence.
- [ ] **T02.04 - Lead: Ahmed (Laiq); review: Harris.** Define how code/content is reviewed and merged, who integrates the engine and UI, and how test failures or conflicts are recorded and resolved.
- [ ] **T02.05 - Lead: Harris; review: Ashher.** Record planned versus actual milestone state, evidence, variance, blocker, revised date, and a specific recovery action for every Iteration 1 package. Do not write only “work harder.”
- [ ] **T02.06 - Lead: Ashher; review: Ahmed (Laiq).** State the Iteration 1 objective, whether it was met at evaluation time, the critical blocker if any, and the demonstrable Iteration 2/Final-1 outcome.
- [ ] **T02.07 - Lead: Ahmed (Laiq); review: Harris.** Keep files required to reproduce the work in Git. Exclude secrets, `node_modules`, `.next`, caches, and unreviewed bulk material. Add the **reviewed Math demo subset** with its provenance and version before freezing the evaluation commit.
- [ ] **T02.08 - Lead: Harris; review: Ashher.** Preserve a way to identify the original proposal-defence PoC in Git history. Identify later adapted screens and remaining scripted views accurately.

## 3. Scope, requirements, acceptance, and traceability — I1-02; worksheet §5

- [ ] **T03.01 - Lead: Harris; review: Ashher.** Write a concise problem statement, primary users, approved product vision, module list, feasibility assumptions, and measurable overall success criteria.
- [ ] **T03.02 - Lead: Ahmed (Laiq); review: Harris.** State what Iteration 1 commits to: reviewed Math demo content; real Bayes/entropy diagnostic core; connection to adapted PoC screens; initial dashboards/classes; early tests. State explicitly that Physics/Chemistry content is draft for now and messaging is later.
- [ ] **T03.03 - Lead: Ashher; review: Ahmed (Laiq).** Describe the user interactions for the live flow: enter an answer, update beliefs, select a follow-up or refuse, display evidence, and show relevant dashboard/class actions.
- [ ] **T03.04 - Lead: Ashher; review: Ahmed (Laiq).** Give each functional requirement an ID, clear behavior, inputs/outputs, boundary conditions, and an observable acceptance check.
- [ ] **T03.05 - Lead: Harris; review: Ashher.** Give each nonfunctional requirement an ID and measurable method where applicable: reproducibility, response time, correctness, auditability, access/privacy, and safe handling of invalid data. Do not invent achieved numbers.
- [ ] **T03.06 - Lead: Ahmed (Laiq); review: Harris.** Define acceptance criteria for the Math content pack, engine, PoC connection, dashboard/class flows, and tests. Identify which requirements are met, partial, deferred, or not met **from actual evidence near evaluation**.
- [ ] **T03.07 - Lead: Harris; review: Ashher.** Maintain a traceability table: **requirement → design element → implementation path/function → test/result → demo step → owner**. Give every implemented Iteration 1 requirement a complete chain.
- [ ] **T03.08 - Lead: Ahmed (Laiq); review: Harris.** Separate verified claims from planned research claims; label simulated cases as simulations, not classroom or student results.

## 4. Design artefacts and decisions — I1-02; worksheet §6

- [ ] **T04.01 - Lead: Ahmed (Laiq); review: Harris.** Draw and explain an architecture showing adapted PoC frontend, real diagnostic engine, Math content source, storage/state if used, and interfaces. Identify fixture-only and live paths.
- [ ] **T04.02 - Lead: Ashher; review: Ahmed (Laiq).** Define the API/function contract for starting a Math diagnostic run, submitting an answer, returning posterior/next item or refusal, and obtaining the evidence trail. Include validation and error behavior.
- [ ] **T04.03 - Lead: Harris; review: Ashher.** Prepare a data/schema or ERD artefact for the actual Iteration 1 content and run state: Math topic, misconception, item/options, Q-matrix mapping, version/review status, session, answer/step, posterior, and outcome as applicable.
- [ ] **T04.04 - Lead: Harris; review: Ashher.** Prepare a process/data-flow artefact showing how a reviewed question becomes a live input and how an answer produces a calculated result.
- [ ] **T04.05 - Lead: Ashher; review: Ahmed (Laiq).** Prepare a behavior artefact (activity, sequence, or state diagram) for normal progression, follow-up, diagnosis/refusal, and failure handling. Show the real implemented boundary.
- [ ] **T04.06 - Lead: Ahmed (Laiq); review: Harris.** Explain each artefact's purpose, version/date, link to code, and any change since the proposal. Record why the change was made.
- [ ] **T04.07 - Lead: Ashher; review: Ahmed (Laiq).** Record key architecture/interface decisions, alternatives considered, chosen option, trade-off, and supporting evidence. Resolve the minimum decisions needed to implement and reproduce the slice; mark later decisions as open.
- [ ] **T04.08 - Lead: Harris; review: Ashher.** Keep design, requirements, code, test names, demo, and report consistent when implementation changes.

## 5. Mathematics content and Physics/Chemistry drafts — I1-03

- [ ] **T05.01 - Lead: Harris; review: Ashher.** Choose the Math topic(s) and define the planned coverage so “most Math material” can be measured. Treat broad coverage as a target; **only reviewed portions are finalized**.
- [ ] **T05.02 - Lead: Harris; review: Ashher.** List the competing misconceptions and any `NONE`/unknown/unmodelled state used by the engine; define each clearly enough to distinguish it from the others.
- [ ] **T05.03 - Lead: Harris; review: Ashher.** Formulate or curate questions, answer options, correct answers, and misconception-to-option/item mappings (Q-matrix). Include questions capable of separating ambiguous hypotheses.
- [ ] **T05.04 - Lead: Harris; review: Ashher.** Record source, permission/licence, author or generator, reviewer, review date, review decision, and content version for the live subset. Disclose material tool/LLM assistance and human checks.
- [ ] **T05.05 - Lead: Harris; review: Ashher.** Validate required fields, identifiers, option references, duplicate/conflicting mappings, and invalid or unusable questions. Record rejected items and corrections.
- [ ] **T05.06 - Lead: Harris; review: Ashher.** Review the subset with the agreed content reviewer; distinguish draft, reviewed, and approved-for-demo items. Do not feed unreviewed Physics/Chemistry drafts into the Mid-1 engine.
- [ ] **T05.07 - Lead: Harris; review: Ashher.** Commit the approved, versioned Math demo subset and its validation procedure/results. Ensure a clean checkout can run the same questions and reproduce the demo.
- [ ] **T05.08 - Lead: Harris; review: Ashher.** Record Math coverage and remaining gaps honestly at Mid-1; full Math dataset completion is not a prerequisite claimed by this plan.
- [ ] **T05.09-P - Lead: Ashher; review: Ahmed (Laiq).** Formulate a Physics draft with topics, candidate misconceptions, questions/options, and proposed mappings.
- [ ] **T05.10-P - Lead: Ashher; review: Ahmed (Laiq).** Record Physics sources, permissions/licences, and draft/review status; keep this pack separate from approved Math demo input.
- [ ] **T05.11-P - Lead: Ashher; review: Ahmed (Laiq).** Identify the review and validation work required before the Physics pack can be used by the engine in a later iteration.
- [ ] **T05.09-C - Lead: Ahmed (Laiq); review: Harris.** Formulate a Chemistry draft with topics, candidate misconceptions, questions/options, and proposed mappings.
- [ ] **T05.10-C - Lead: Ahmed (Laiq); review: Harris.** Record Chemistry sources, permissions/licences, and draft/review status; keep this pack separate from approved Math demo input.
- [ ] **T05.11-C - Lead: Ahmed (Laiq); review: Harris.** Identify the review and validation work required before the Chemistry pack can be used by the engine in a later iteration.

## 6. Real diagnostic engine — I1-04

- [ ] **T06.01 - Lead: Ahmed (Laiq); review: Harris.** Implement a deterministic Math diagnostic module/service separate from fixture-scripted PoC outputs. Document dependency and configuration versions.
- [ ] **T06.02 - Lead: Ashher; review: Ahmed (Laiq).** Define prior probabilities, the answer-likelihood/slip/guess assumptions used, the update equation, numeric normalization, and behavior for zero/invalid probabilities. Make assumptions reviewable rather than presenting them as learned facts.
- [ ] **T06.03 - Lead: Ashher; review: Ahmed (Laiq).** On each answer, compute and record the posterior over competing misconceptions. Make the calculation and inputs reproducible.
- [ ] **T06.04 - Lead: Harris; review: Ashher.** Compute entropy and **expected information gain** for eligible unused questions; select a discriminating next item using the implemented rule and document deterministic tie handling.
- [ ] **T06.05 - Lead: Ahmed (Laiq); review: Harris.** Define stopping, question budget, no-separator, invalid-answer/content, and insufficient-evidence outcomes. Return an explicit refusal/escalation state when a supported diagnosis cannot be made.
- [ ] **T06.06 - Lead: Harris; review: Ashher.** Emit an evidence trail containing the content version, item/answer sequence, posterior values, selection reason or information gain, and final outcome. Show how the trace is inspected in the demo.
- [ ] **T06.07 - Lead: Ahmed (Laiq); review: Harris.** Keep generative AI outside the authoritative diagnostic calculation. Label any optional AI-derived content or display separately.
- [ ] **T06.08 - Lead: Ashher; review: Ahmed (Laiq).** Write unit tests with hand-checkable expected posterior and information-gain values, plus tie/no-separator/budget and invalid-input cases.
- [ ] **T06.09 - Lead: Ahmed (Laiq); review: Harris.** Document the entry point, main files/functions, configuration, input/output examples, setup commands, and current limitations for the report and live questioning.

## 7. Adapted PoC, dashboards, and classes — I1-05/I1-06

- [ ] **T07.01 - Lead: Ahmed (Laiq); review: Harris.** Select the proposal PoC screens to reuse for the live Math diagnostic flow and record the changes needed. Keep the original proposal version identifiable through the initial Git commit.
- [ ] **T07.02 - Lead: Ahmed (Laiq); review: Harris.** Connect answer submission to the real engine and reviewed Math content. Confirm that displayed posterior, next question, and outcome come from the live calculation; label any remaining scripted examples.
- [ ] **T07.03 - Lead: Ashher; review: Ahmed (Laiq).** Show a coherent input → processing → output sequence, including a normal path and a refusal/error path. Provide a readable evidence view or log for technical explanation.
- [ ] **T07.04 - Lead: Ashher; review: Ahmed (Laiq).** Define the **specific initial dashboard functions** due by Mid-1, their user role, data source, and acceptance checks before implementation. Build and exercise those functions; distinguish live run data from PoC fixtures.
- [ ] **T07.05 - Lead: Ahmed (Laiq); review: Harris.** Define the **specific basic class actions** due by Mid-1, their user role, data source, and acceptance checks before implementation. Build and exercise a class flow; document any fixture-driven parts.
- [ ] **T07.06 - Lead: Ashher; review: Ahmed (Laiq).** Keep announcements and direct messaging out of the Iteration 1 implementation commitment.
- [ ] **T07.07 - Lead: Ashher; review: Ahmed (Laiq).** Write an integration check that submits a Math answer through the chosen screen/interface and verifies a real engine response. Check the class flow and relevant dashboard data source.
- [ ] **T07.08 - Lead: Harris; review: Ashher.** Provide clean run instructions, dependencies, versions, configuration example without secrets, test/build commands, and fixture/demo-account instructions. Test them from a clean checkout.

## 8. Testing and early validation — I1-07; worksheet §8

- [ ] **T08.01 - Lead: Ahmed (Laiq); review: Harris.** Make a test/validation table with ID, requirement/module, method and dataset, expected result, actual result/metric, evidence link, and owner.
- [ ] **T08.02 - Lead: Ashher; review: Ahmed (Laiq).** Run and record a **normal case**: valid reviewed Math content, answer, posterior update, discriminating next item or justified diagnosis, and visible trace.
- [ ] **T08.03 - Lead: Harris; review: Ashher.** Run and record an **edge/ambiguous case**: two plausible misconceptions, tie or weak separator, question-budget limit, or insufficient evidence; show the implemented safe outcome.
- [ ] **T08.04 - Lead: Ahmed (Laiq); review: Harris.** Run and record a **failure case**: invalid answer, invalid Q-matrix/content, unavailable dependency, or other reproducible fault; show rejection or recovery without a fabricated diagnosis.
- [ ] **T08.05 - Lead: Ahmed (Laiq); review: Harris.** Test the Math content validator, engine unit calculations, PoC-to-engine integration, dashboard/class flow, and clean setup/build. Record commands, data/version, environment, and outputs.
- [ ] **T08.06 - Lead: Ashher; review: Ahmed (Laiq).** Select at least one failure or edge case for discussion: condition, why it matters, observed behavior/log, what the result proves and does not prove, corrective action/owner/date if needed.
- [ ] **T08.07 - Lead: Harris; review: Ashher.** Summarize current evidence, limitation, and next validation action for functional correctness, performance/resources, algorithm quality, user/field validation, and security/privacy. Write “not applicable yet” where justified.
- [ ] **T08.08 - Lead: Ahmed (Laiq); review: Harris.** Distinguish synthetic/offline validation from tests with real students or teachers. Record ethics/permission requirements before any field activity.

## 9. Live demonstration and presentation — I1-05/I1-08; worksheet §4 and Form 2

- [ ] **T09.01 - Lead: Ashher; review: Ahmed (Laiq).** Name the **core module** precisely and explain why the real Math diagnostic engine is central to Sonder's approved problem.
- [ ] **T09.02 - Lead: Ashher; review: Ahmed (Laiq).** Write the demo's input type/source/validation, actual processing rule, observable output, dependencies, known limitations, and current technical boundary.
- [ ] **T09.03 - Lead: Ahmed (Laiq); review: Harris.** Complete the implementation-boundary table for **client/interface, backend/service, core algorithm/model, and data/external dependency**: implemented/integrated, mocked/substituted, evidence, and plan to remove substitutes.
- [ ] **T09.04 - Lead: Harris; review: Ashher.** Fill all **six** worksheet demo rows with action, expected result, visible evidence, and presenter. Include a normal case, an ambiguous/edge or failure case, and an explanation of the real calculation.
- [ ] **T09.05 - Lead: Ahmed (Laiq); review: Harris.** Prepare and rehearse a live build from the evaluation commit/tag. Verify that the app launches, the content loads, answers reach the engine, and outputs/traces appear. Screenshots or video alone do not satisfy the live-core criterion.
- [ ] **T09.06 - Lead: Harris; review: Ashher.** Prepare a slide deck for the presentation: approved problem and proposal response; updated Gantt and ownership; scope/requirements; architecture and data flow; Math content and engine method; live demo route; test results/limitations; member contributions; next iteration. Use readable diagrams and cite sources.
- [ ] **T09.07 - Lead: Ashher; review: Ahmed (Laiq).** Assign who presents each section and each demo step. Rehearse transitions, timings, likely technical questions, and a clean restart after a demo interruption.
- [ ] **T09.08 - Lead: Ahmed (Laiq); review: Harris.** Keep a fallback build/environment and a written runbook for a network or machine issue. If a fallback is used, disclose what actually ran; preserve the real core calculation.
- [ ] **T09.09 - Lead: Harris; review: Ashher.** Prepare concise answers each member can defend: their code/data/design, a test and failure, one design trade-off, material tool use and validation, and their next task.

## 10. Repository, evaluation version, and individual evidence — I1-08; worksheet §§7, 11

- [ ] **T10.01 - Lead: Ashher; review: Ahmed (Laiq).** Before the evidence freeze, review the integrated change, run required checks, verify the reviewed Math pack is included, and fix or document known defects.
- [ ] **T10.02 - Lead: Ahmed (Laiq); review: Harris.** Create a **stable full commit SHA or release tag** only after integration and checks. Use that same identifier in the worksheet, report, slides/demo notes, and runnable artefact. Do not substitute a future branch head for the evaluated version.
- [ ] **T10.03 - Lead: Harris; review: Ashher.** Prepare a repository evidence table linking each work item to owner, issue/task, commit/PR/tag, files/artefact, review/test evidence, and state.
- [ ] **T10.04 - Lead: Harris; review: Ashher.** Record the task-tracking method, review practice, integration responsibility, team coordination decisions, and explanation of any large or late commits.
- [ ] **T10.05 - Lead: Ahmed (Laiq); review: Harris.** For **each of the three members**, fill name/registration number, repository identity, primary technical ownership, most substantial contribution, a problem personally resolved, material tool-assisted work and validation, and a specific next task/date.
- [ ] **T10.06 - Lead: Ashher; review: Ahmed (Laiq).** For each member, link multiple concrete contributions to artefact, commit/issue/version, test/result, and role (designed, implemented, tested, reviewed, or integrated). Obtain that member's declaration and dated confirmation.
- [ ] **T10.07 - Lead: Ashher; review: Ahmed (Laiq).** Check that each member can locate, explain, test, and if asked modify the work attributed to them; explain their relevant architecture/data flow and a design alternative.

## 11. Prescribed FYP-1 mid report — I1-08; worksheet §9 and Form 3

- [ ] **T11.01 - Lead: Ahmed (Laiq); review: Harris.** Follow the prescribed template: required title/front matter, headings, figures, tables, citations, references, appendices/annexes, and any department-specific formatting or submission rules.
- [ ] **T11.02 - Lead: Harris; review: Ashher.** **Problem formulation, R&D, existing solutions (15 marks):** give stakeholder/literature/data evidence, relevant products/methods/prior FYPs, the remaining gap, Sonder's complex computing challenge, investigative method, findings to date, and claims still unproven.
- [ ] **T11.03 - Lead: Ahmed (Laiq); review: Harris.** **Vision, scope, modules, success (10):** state approved users, module boundaries, current Iteration 1 slice, later modules, feasibility, and measurable success criteria.
- [ ] **T11.04 - Lead: Ashher; review: Ahmed (Laiq).** **Requirements and acceptance (15):** describe user interactions, precise FRs/NFRs, measurable checks, and traceability to design, code, tests, and demo.
- [ ] **T11.05 - Lead: Ashher; review: Ahmed (Laiq).** **Architecture/components/interfaces (15):** show chosen architecture, major components, data/service dependencies, interface contracts, alternatives, rationale, and changes from proposal.
- [ ] **T11.06 - Lead: Harris; review: Ashher.** **Data/process/behavior design (10):** explain appropriate schema/ERD, data flow, activity, sequence or state artefacts and how they match the actual Math engine and adapted PoC implementation.
- [ ] **T11.07 - Lead: Ashher; review: Ahmed (Laiq).** **Completed-module implementation (15):** document the exact evaluation commit/tag; clean setup/execution; dependency versions; main files/classes/functions; data/configuration; algorithm and inputs/outputs; integration; technical decisions; known limitations and failure behavior. Another person should be able to reproduce it.
- [ ] **T11.08 - Lead: Ahmed (Laiq); review: Harris.** **Testing/validation, tools, risk (15):** present test methods/data and early actual results, edge/failure analysis, future validation plan, external tools/dependencies, security/privacy, licensing, risks, and limitations.
- [ ] **T11.09 - Lead: Harris; review: Ashher.** **Report format and artefacts (5):** verify all required prescribed sections, citations, figures/tables, and annexes are present and legible.
- [ ] **T11.10 - Lead: Harris; review: Ashher.** Cite the source of every external fact, figure, dataset, code/asset, and method used in the report. Distinguish proposed outcomes, simulations, and observed results.
- [ ] **T11.11 - Lead: Ahmed (Laiq); review: Harris.** Review the report against the frozen build, dataset version, test outputs, worksheet, and slides; correct conflicting claims and page references.

## 12. Complete the supervisor's editable worksheet — I1-08; worksheet §§1–12

- [ ] **T12.01 - Lead: Ahmed (Laiq); review: Harris.** Fill project identification, roster, repository URL, full evaluation SHA/tag, and runnable artefact.
- [ ] **T12.02 - Lead: Harris; review: Ashher.** Fill both official evaluation maps and the proposal action register, including open actions and scope consequences.
- [ ] **T12.03 - Lead: Ashher; review: Ahmed (Laiq).** Fill the Iteration 1 plan/progress table, objective status, blocker/recovery fields, and next-iteration outcome from actual evidence.
- [ ] **T12.04 - Lead: Ashher; review: Ahmed (Laiq).** Fill core-module input, processing, output, dependency, limitation, implementation-boundary, six-step demo, and normal/edge/failure tables.
- [ ] **T12.05 - Lead: Ahmed (Laiq); review: Harris.** Fill scope, explicit exclusions, measurable success criteria, FR/NFR and acceptance table, and the requirement traceability table.
- [ ] **T12.06 - Lead: Harris; review: Ashher.** Fill design-artefact and architecture-decision tables, with versions, implementation links, evolution, alternatives, and trade-offs.
- [ ] **T12.07 - Lead: Ahmed (Laiq); review: Harris.** Fill repository work-item table, evaluation version, task tracking, reviews, integration, coordination, and any unusual commit history.
- [ ] **T12.08 - Lead: Harris; review: Ashher.** Fill test/validation table, selected edge/failure discussion, and validation-quality table with current evidence and next steps.
- [ ] **T12.09 - Lead: Ashher; review: Ahmed (Laiq).** Fill the report-preparation table with a **section/page and primary artefact for every Form 3 criterion**; complete the R&D, claims-unproven, and reproducible-implementation prompts.
- [ ] **T12.10 - Lead: Ahmed (Laiq); review: Harris.** Fill the tool/dependency/risk disclosure tables, including sensitive-data handling, security controls, licensing/attribution, external availability, and responsible LLM use.
- [ ] **T12.11 - Lead: Harris; review: Ashher.** Have **each member complete and confirm** their individual evidence section and declaration.
- [ ] **T12.12 - Lead: Ashher; review: Ahmed (Laiq).** Fill the **Form 2 and Form 3 evidence indexes**: criterion, worksheet/report location, primary evidence, and owner. Complete the group final check and dated confirmations.
- [ ] **T12.13 - Lead: Ahmed (Laiq); review: Harris.** Keep the worksheet editable for submission; check links and page numbers after the final report export. Do not self-award official marks or fill “ready” fields without evidence.

## 13. Tool, data, asset, security, and ethics record — worksheet §10

- [ ] **T13.01 - Lead: Ashher; review: Ahmed (Laiq).** List every material tool, LLM, model, service, library, dataset, or hardware dependency used: purpose, output incorporated, validation, limitation/risk, and owner. Keep evidence of corrections or rejected outputs.
- [ ] **T13.02 - Lead: Harris; review: Ashher.** Record Math/Physics/Chemistry content sources, permissions/licences, provenance, review decisions, and which packs are allowed in the live build.
- [ ] **T13.03 - Lead: Ahmed (Laiq); review: Harris.** Review PoC asset provenance and permitted reuse, especially third-party visuals/audio/model assets, before any public deployment or claim of original ownership.
- [ ] **T13.04 - Lead: Ahmed (Laiq); review: Harris.** State whether any real student data is collected. If so, document consent/approval, access, storage, retention/deletion, and privacy controls; if none, state that clearly.
- [ ] **T13.05 - Lead: Harris; review: Ashher.** Document role/access controls relevant to implemented screens, secret handling, dependency/security checks, and failure behavior. Do not put credentials or private data in Git, slides, logs, or the demo.
- [ ] **T13.06 - Lead: Ashher; review: Ahmed (Laiq).** State what happens if an external API, service, model, dataset, or network connection fails. Disclose any mocked fallback.
- [ ] **T13.07 - Lead: Harris; review: Ashher.** Keep planned pilot/field validation subject to ethics and access approval; do not describe it as completed Mid-1 evidence unless it actually occurred.

## 14. Final 48-hour submission and evaluation-day check — I1-08

- [ ] **T14.01 - Lead: Harris; review: Ashher.** Confirm the evaluation date, time, location/meeting link, presentation length, submission channel, required file formats, and recipient from the official notice/supervisor.
- [ ] **T14.02 - Lead: Harris; review: Ashher.** Freeze the evaluated commit/tag, Math content version, test outputs, and runnable build. Verify a clean checkout and fresh setup one final time.
- [ ] **T14.03 - Lead: Ashher; review: Ahmed (Laiq).** Verify supervisor repository access and that the submitted URL, full SHA/tag, run instructions, dataset version, report, worksheet, and slides all describe the same build.
- [ ] **T14.04 - Lead: Ashher; review: Ahmed (Laiq).** Review the completed worksheet and prescribed report as a group. Check every table, signature/confirmation, external link, report page, citation, and evidence index.
- [ ] **T14.05 - Lead: Ahmed (Laiq); review: Harris.** Submit the **editable completed worksheet and prescribed mid report at least 48 hours before** the meeting; retain submission proof. Submit slides or other files separately if the official instructions request them.
- [ ] **T14.06 - Lead: Ashher; review: Ahmed (Laiq).** Rehearse the live demo on the actual presentation machine with the frozen build, normal/edge/failure inputs, presenter assignments, restart procedure, and fallback environment.
- [ ] **T14.07 - Lead: Ashher; review: Ahmed (Laiq).** On evaluation day, have the repository, evaluation version, code, diagrams, tests, content provenance, action register, and report available for questions. Each member should be ready to explain and demonstrate their own contribution.

## Completion and handoff rules

- [ ] Every task has a named issue or task-board entry, planned date, evidence link, and recorded reviewer outcome. Each lead updates actual state and any variance/recovery action in the supervisor worksheet near evaluation.
- [ ] For each dataset or engine defect found in review, record the failing example, affected content/code version, fix owner, corrective change, and rerun result. The reviewer verifies the fix.
- [ ] For shared diagrams, requirements, slides, report, and worksheet, the lead assembles the artefact while all three verify claims about their own work. Each member can explain an alternative, a test, and a limitation.
- [ ] Freeze a single reviewed commit/tag after integration; use its full identifier throughout the report, worksheet, slides/demo notes, and live build. Record any post-freeze change and repeat affected checks.
- [ ] Confirm the report and editable worksheet are submitted at least 48 hours before the meeting, with submission proof. Keep the runnable demo, test output, content provenance, and member evidence available for questions.
