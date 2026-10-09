# FYP‑1 Mid‑1 evaluation evidence guide

The supervisor's [editable student evidence worksheet](reference/FYP1_Mid_Student_Evidence_Worksheet.docx) is a preparation and submission instrument. It supports two separately marked handbook assessments: **Form 2, presentation and live demonstration (100 marks)**, and **Form 3, FYP‑1 mid report (100 marks)**. The worksheet does not replace the prescribed report or the supervisor's official forms. This guide records what the team plans to prepare; it is not a progress or scoring sheet.

## Submission package

The worksheet calls for an editable completed copy and the FYP‑1 mid report in the **department's prescribed format**, submitted **at least 48 hours before the evaluation meeting**. The evaluation package also needs the proposal-panel comments and action register, supervisor repository access, a stable full commit SHA or release tag, a runnable live build, design artefacts tied to implementation, test/validation output, member task and ownership evidence, and external-tool/dependency disclosures.

The worksheet does not include the prescribed report template or a scheduled evaluation date. Use the department/supervisor's report format and the official meeting notice for those details. Prepare a slide deck and rehearsed live demo for the presentation; the worksheet evaluates the presentation but does not itself define a separate slide-file submission rule.

## Form 2: presentation and live demo

| Criterion | Marks | Evidence to prepare |
| --- | ---: | --- |
| Proposal actions | 10 | Every exact panel comment, response, owner, rationale, and evidence or next action. |
| Iteration plan and work breakdown | 10 | Approved Gantt, dated work packages, owners, milestone evidence, and variance/recovery explanation. |
| Live prototype with core module | 25 | A real meaningful module running live, with input → processing → observable output; label any mocked parts. Include a normal and edge/failure path. |
| Requirements and acceptance | 10 | User interactions, precise FRs/NFRs, measurable criteria, and links to test/demo evidence. |
| Design and evolution | 15 | Architecture plus data/process/behavior artefacts connected to the implemented module and justified changes from proposal. |
| Repository and member evidence | 10 | Stable SHA/tag, task history, each person's design/code/test/review/integration contribution; more than commit counts. |
| Testing and early validation | 10 | Reproducible checks for the current module and interpretation of at least one failure/edge case. |
| Team and tool ownership | 10 | Coordination, technical ownership, material tool/LLM use, validation, and corrections each member can defend. |

The proposal-defence [PoC](POC.md) is a scripted demonstration. For the **core-module** criterion, the [Iteration 1 plan](ROADMAP.md#iteration-1-work-packages-and-completion-evidence) specifies a newly implemented diagnostic calculation and a thin live interface or API. Show the evaluation build from the frozen commit, not only slides or a video.

## Form 3: prescribed FYP‑1 mid report

| Criterion | Marks | Report content |
| --- | ---: | --- |
| Prescribed format and artefacts | 5 | Required headings, figures, tables, citations, and annexes in the institution's format. |
| Problem, R&D, and existing solutions | 15 | Problem evidence, literature/products/prior FYPs, exact gap, complex computing challenge, and investigative method. |
| Vision, scope, modules, success criteria | 10 | Approved product boundary, module responsibilities, feasibility, and measurable goals. |
| Requirements and acceptance | 15 | User interactions, FRs/NFRs, criteria and traceability. |
| Architecture/components/interfaces | 15 | Chosen architecture, alternatives, module boundaries, APIs, dependencies, and rationale. |
| Data/process/behavior design | 10 | Appropriate ERD/schema, data flow, activity, sequence or state diagrams explained in relation to the actual design. |
| Completed-module implementation | 15 | Reproducible setup, exact evaluation version, main files/functions, inputs, algorithm, configuration, technical choices, and limitations. |
| Testing, validation, tools and risk | 15 | Test method and early results, failure analysis, security/privacy, licensing, external dependency and responsible tool use. |

This is a **mid-stage technical progress report** about the approved problem and the module built for Mid‑1. It is not the final FYP thesis, the old proposal, or a pasted copy of the worksheet. The report should distinguish plan, implementation, and evidence in each chapter.

## Worksheet sections to populate for the evaluation

1. **Identification and roster:** registered title/ID, panel, supervisor, date, repository URL, full SHA/tag, runnable artefact, and each member's repository identity and technical workstream.
2. **Proposal response:** exact panel decision/comments, accepted or adapted actions, ownership, rationale, evidence, and planned follow-up.
3. **Iteration progress:** each planned work package's owner/date, actual result, evidence, variance and recovery plan, plus the next iteration outcome.
4. **Core module and demo:** technical input, actual processing, output, dependencies, known limitations, implemented-versus-mocked table, six-step demo, and normal/edge/failure cases.
5. **Requirements:** scope, exclusions, measurable success criteria, FR/NFR table and requirement → design → implementation → test → demo → owner traceability.
6. **Design:** architecture, schema/ERD, data/process and state/sequence artefacts, evolution since proposal, choices and trade-offs.
7. **Repository and team:** task/issue-to-commit and test links, review and integration practice, stable evaluation version, coordination evidence.
8. **Testing:** test IDs, method/data, expected and actual results, failure-case interpretation, and future validation method.
9. **Report preparation:** map every Form 3 criterion to a report section/page and primary evidence; document setup and reproducibility.
10. **Tools and risk:** material LLM/tool output and validation, libraries/datasets/licences, secrets and sensitive-data handling, service fallbacks, limitations.
11. **Individual evidence:** each member's substantial contribution, personally solved problem, tool use, linked artefacts/tests, next work, declaration and confirmation.
12. **Final evidence indexes:** map every Form 2 and Form 3 criterion to worksheet/report location, artefact, and responsible member.

The worksheet's “ready”, status, marks, and confirmation fields are filled from the frozen evaluation version and real evidence near submission time. This guide does not pre-judge those fields.
