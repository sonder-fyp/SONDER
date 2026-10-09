# Sonder FYP execution plan

This is the execution plan for the FYP phase after proposal approval. Month labels are relative (`M1`–`M8`); the calendar Gantt will use the registered project and evaluation dates. Workstream labels identify responsibilities rather than assign unconfirmed member names.

## Scope boundary

- **Proposal-defence evidence:** `Sonder-UI-master/` is the finalized, fixture-driven PoC at the repository's initial commit. Reuse and adapt its relevant screens for the FYP live demonstration as needed; the proposal version remains identifiable in Git history. Scripted outputs do not count as a live diagnostic algorithm.
- **New FYP implementation:** build a real diagnostic engine that accepts answers from reviewed Mathematics content, updates competing misconception probabilities, selects a discriminating item or refuses, and exposes an evidence trail. Connect it to adapted PoC screens so the Mid‑1 demonstration shows input, actual calculation, and observable output.
- **Dataset:** the local `Data_Maths-Phy-Chem/` folder was excluded from the initial repository push. In Iteration 1, prioritize formulating, reviewing, and validating Mathematics content; aim to cover most planned Math material and finalize reviewed portions, especially the subset needed for the working engine, without promising the entire Math dataset. Formulate draft Physics and Chemistry content in parallel, but do not depend on it for the Iteration 1 engine or demo. Commit the reviewed Math demo subset with its version, provenance, and review status before the evaluation; distinguish other drafts from approved live content.
- **Approved product scope:** see the [feature register](PROJECT.md#feature-register). Sequencing a feature later does not silently remove it from the approved scope. Any formal scope change needs a recorded decision with the supervisor.

## Repository baseline

Create one new FYP repository with the supervisor and all three members granted access. The initial commit should contain:

```text
README.md                 project entry point and document map
docs/                     approved scope, technical design, roadmap, mid-evaluation plan, official references
Sonder-UI-master/          finalized proposal-defence PoC (source and required assets only)
.gitignore                exclude dependencies, builds, secrets, and generated files
```

Keep the new diagnostic engine in a separate `engine/` or `services/` path so reviewers can distinguish its implementation from the proposal PoC. The team may adapt the existing PoC frontend and connect it to that engine; identify the initial commit as the proposal-defence snapshot and label any remaining fixture-driven views. Do not copy `node_modules`, `.next`, credentials, or unreviewed dataset files into Git. Add a dataset path later with a clear version, source/licence record, and review state.

The planned repository can grow into this layout without mixing the demo and implementation:

```text
Sonder-UI-master/          proposal-defence frontend reused/adapted for the live slice
apps/web/                  optional later application structure if the UI is moved out
services/engine/           diagnostic API and deterministic algorithms
services/model/            bounded model serving and generation interfaces
data/                      reviewed, versioned subject packs (added later)
experiments/               V1–V3 scripts, configurations, and reproducible outputs
tests/                     cross-service and acceptance checks
infra/                     deployment and environment templates
docs/                      scope, design, roadmap, and evaluation references
```

Only create directories when their first owned work package begins. If the team chooses a smaller single-service design, record the reason and update [ENGINEERING.md](ENGINEERING.md) and the traceability matrix together.

Use issues or a task board for work packages; connect each member's design, code, tests, review, and integration work to issues and commits. A stable evaluation commit or tag is created **after integration and checks**, then used by the report, worksheet, and live demo.

## Revised eight-month Gantt baseline

`█` means the workstream is planned in that month. The FAST gates are assessment points; the four iterations are the team's build cycles. Transfer these relative months to the calendar chart once the dates and names are available.

| Workstream | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | Lead role |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | --- |
| Repository, approved baseline, SRS/SDS, traceability | █ | █ |  |  |  |  |  |  | Product + all |
| Diagnostic engine: posterior, selection, refusal, audit | █ | █ | █ |  |  |  |  |  | Engine |
| Mathematics content: formulate, review, validate; extend coverage | █ | █ | █ | █ |  |  |  |  | Content |
| Physics/Chemistry content: draft, then review and validate | █ | █ | █ | █ | █ | █ |  |  | Content |
| Connect real engine to adapted PoC diagnostic screens and test |  | █ | █ |  |  |  |  |  | Engine + Product |
| Initial dashboards and class flows (no messaging) | █ | █ | █ |  |  |  |  |  | Product |
| Teacher approval, escalation, student intervention |  |  | █ | █ |  |  |  |  | Product + Engine |
| Verification loop and delayed check |  |  |  | █ | █ | █ |  |  | Engine + Product |
| Engine evaluation: V1, V2, V3 |  |  | █ | █ | █ | █ |  |  | Engine |
| Question-bank gap scan, generation, scoring, teacher queue |  |  |  | █ | █ | █ |  |  | Engine + Content |
| Learning Hub, bounded AI assistance, parent/admin views |  |  |  |  | █ | █ |  |  | Product + Content |
| Extend dashboards/classes; announcements and direct messaging |  |  |  |  | █ | █ |  |  | Product |
| Integration, system tests, NFR measurement, deployment rehearsal |  |  |  | █ | █ | █ | █ |  | All |
| Ethics/access, pilot preparation, V5/V6 | █ | █ | █ | █ | █ | █ |  |  | Product + Content |
| Production deployment, pilot/V4, durability, final audit/report |  |  |  |  |  |  | █ | █ | All |

| Assessment point | Target month | Required evidence |
| --- | --- | --- |
| Gate 1 — proposal defence | M1 | Reference the approved proposal, panel decision, and action register. |
| Gates 2&3 — FYP‑1 Mid‑1 | M2 | Approved requirements/design baseline, real core-module demo, early tests, member/repository evidence, prescribed mid report and supervisor worksheet. |
| Exit Gate — FYP‑1 Final‑1 | M4 | End-to-end core flow, baseline result, selected deployment target and first attempt, traceability and test/deployment plan. |
| Gate 4 — Mid‑2 | M6 | Integrated committed scope, system test report and defect list, measured NFRs, evaluation against baselines, rehearsed rollback. |
| Gate 5 — Final‑2 | M8 | External operation or justified substitute, pilot/acceptance evidence, limitations, final report and handover. |

This keeps the screenshot's Iteration 1 starts for the diagnostic engine, data work, dashboards, and classes. Iteration 1 includes initial usable dashboard and class flows, while announcements and direct messaging wait until Iteration 3. The Mid‑1 diagnostic demo uses Mathematics content and connects the real engine to adapted PoC screens. Update the presentation Gantt to distinguish those boundaries and to show deployment preparation before Iteration 4.

## Iteration 1: work packages and completion evidence

The Mid‑1 target is a working core with measurable acceptance evidence. A percentage alone does not define that target; the work packages below specify what reviewers should be able to run, inspect, and explain.

| ID | Package | Acceptance condition | Lead role | Evidence to prepare |
| --- | --- | --- | --- | --- |
| I1-01 | Repository and ownership | New repo accessible to supervisor and all members; work packages assigned; commit/review method in use | Product + all | Access check, task board, first commits |
| I1-02 | Requirements and design baseline | Approved problem/scope; precise FRs/NFRs and acceptance checks; architecture, data/process and behavior diagrams tied to intended modules | All | SRS/SDS draft or prescribed artefacts, traceability table, design decisions |
| I1-03 | Mathematics-first dataset; Physics/Chemistry drafts | Formulate, review, and validate Math content, aiming to cover most planned material while finalizing only reviewed portions. At minimum, approve a versioned Math topic with misconceptions, items/options, Q-matrix, provenance, and invalid-mapping checks for the live engine. Formulate Physics/Chemistry drafts separately; they are not Mid‑1 engine inputs. | Content | Reviewed Math demo subset committed with the engine, validation output, provenance and review states; identifiable Physics/Chemistry drafts |
| I1-04 | Real Math diagnostic calculation | Answer input from the reviewed Math subset changes posterior according to the implemented rule; next item uses computed information gain; tie/no-separator/budget states are handled explicitly | Engine | Executable module, unit tests, run logs, explanation of assumptions |
| I1-05 | PoC-connected live diagnostic flow | Adapt relevant `Sonder-UI-master/` screens so a reviewer can submit a Math answer and observe the real engine's result and evidence trail; identify any scripted or mocked view | Engine + Product | Run instructions, six-step live demo, interface/engine integration test, implementation-boundary table |
| I1-06 | Initial dashboards and classes | Build and exercise the dashboard and basic class flows planned for Iteration 1; show real data where integrated and label remaining fixtures. Announcements and direct messaging are excluded from this iteration. | Product | Runnable screens, documented data source, class-flow checks, demo steps or screenshots linked to the build |
| I1-07 | Early validation | Normal, ambiguous/edge, and failure cases run with expected and actual results; invalid content and safe error/refusal behavior checked; one defect or limitation discussed honestly | Engine + all | Test output, requirement-to-test links, and failure-case record |
| I1-08 | Mid-evaluation package | Stable SHA/tag; reproducible build; proposal-action register; member evidence; report, worksheet, and presentation agree with the code and are submitted on time | All | [MID_EVALUATION.md](MID_EVALUATION.md) guide and the worksheet-mapped evidence below |

During implementation, the team will attach issue, design, code, review, and test links to these packages. The supervisor worksheet supplies the separate progress and variance fields for the Mid‑1 evaluation.

### Mid‑1 readiness mapped to the supervisor worksheet

The [FYP‑1 Mid Student Evidence Worksheet](reference/FYP1_Mid_Student_Evidence_Worksheet.docx) evaluates a **presentation/live demo (Form 2)** and a **prescribed mid report (Form 3)** separately. It does not set a required dataset percentage or demand the full approved feature set at Mid‑1. The team should prepare the following during Iteration 1, then fill status and evidence fields from the actual evaluation version:

1. **Identity and plan:** registered project details, supervisor and member repository identities, named owners and dates for each work package, updated Gantt, objective status, variance and recovery dates, and the next-iteration outcome.
2. **Proposal response:** every exact panel comment, action decision, owner, status, evidence link, and any approved exception or scope consequence.
3. **Live technical evidence:** a runnable Math diagnostic flow on the evaluation commit, documented inputs, actual Bayes/entropy processing, outputs and dependencies, a clear implemented-versus-mocked table, a six-step presenter-led demo, and normal, edge, and failure paths. Show how the adapted PoC screens reach the real engine.
4. **Requirements and design:** user interactions, precise FRs/NFRs and measurable acceptance criteria; requirement → design → code → test → demo → owner links; architecture, interface, data/schema, process, and behavior artefacts; decisions and justified changes since the proposal.
5. **Validation and repository evidence:** reproducible tests with expected and actual results, one analyzed failure or limitation, dataset review/validation evidence, task-to-commit/review/test links, a stable full SHA or tag, clean setup instructions, and each member's substantial technical contribution beyond commit counts.
6. **Report and presentation:** a slide deck and rehearsed live demo; the FYP‑1 mid report in the department's prescribed format covering problem evidence and existing solutions, scope/success criteria, requirements, architecture/design, completed-module implementation, testing, tools, risks, and limitations. Map each Form 2 and Form 3 criterion to its report/worksheet section and primary evidence.
7. **Disclosures and submission:** record material LLM/tool use and how outputs were checked, dependencies and dataset/asset licensing, sensitive-data and security handling, fallback/availability risks, and individual member declarations. Submit the completed editable worksheet **with the prescribed mid report at least 48 hours before the evaluation meeting**; ensure supervisor repository access and that the report, worksheet, presentation, and runnable build refer to the same evaluation version.

## Later iteration outcomes

- **Iteration 2, M3–M4:** continue reviewing Math and develop Physics/Chemistry drafts toward reviewed engine-ready packs; extend the core across subjects when those packs pass review; wire teacher approval, escalation, and student intervention; run V1; make the first deployment attempt; deliver an end-to-end core flow for Final‑1.
- **Iteration 3, M5–M6:** complete validation and verification, question-bank loop, AI product surface, expanded class/dashboard flows and messaging; run V2/V3/V5/V6; test the integrated system and measure NFRs before Mid‑2.
- **Iteration 4, M7–M8:** freeze and audit the reviewed datasets, deploy and harden, run a permitted classroom pilot with delayed follow-up, analyze outcomes and limitations, and hand over the final system.

## Calendar Gantt inputs

1. Registered FYP title, project ID, actual start date, and scheduled Mid‑1 date.
2. Named member-to-role assignments and a reviewer/approver for each work package. The screenshot's colors are a draft allocation, not a confirmed ownership record.
3. The reviewed Mathematics subset for the live Mid‑1 demonstration, with its source, review status, and acceptance rule; distinguish Physics/Chemistry drafts.
4. The adapted PoC screens, engine interface, and exact evaluation environment for the live demonstration.
5. Proposal-panel actions and approved scope changes, if any.
6. Ethics, data access, and licensing requirements for any student participation or dataset publication.

The relative plan above stays aligned with the presentation Gantt by mapping its months, member colors, and gate dates to these workstreams.
