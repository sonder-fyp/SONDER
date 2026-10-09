# SONDER

Sonder is a teacher-supervised final-year project for diagnosing specific misconceptions in Grade 8 Mathematics, Physics, and Chemistry. It is designed to distinguish competing explanations for an answer, choose useful follow-up questions, withhold an unsupported diagnosis, and let a teacher review the evidence before an intervention or parent summary is released.

The project was previously called **ConceptBridge**. Some proposal material may still use that name.

## Start here

| Path | Purpose |
| --- | --- |
| [Project scope](docs/PROJECT.md) | Problem, users, feature scope, requirements, data plan, and evaluation questions. |
| [Engineering design](docs/ENGINEERING.md) | Proposed architecture, diagnostic method, data contracts, interfaces, and technical decisions. |
| [Roadmap](docs/ROADMAP.md) | Four-iteration plan, work packages, milestones, and intended repository layout. |
| [Mid-evaluation guide](docs/MID_EVALUATION.md) | Evidence needed for the FYP-1 mid presentation, live demo, worksheet, and report. |
| [Proposal PoC notes](docs/POC.md) | What the proposal-defence demonstration represents and how to use it. |
| [Supervisor worksheet](docs/reference/FYP1_Mid_Student_Evidence_Worksheet.docx) | Editable worksheet supplied for FYP-1 mid-evaluation preparation. |
| [FAST selection guide](docs/reference/FAST_FYP_Student_Idea_Selection_Guide_School_of_Computing.pdf) | Academic reference supplied with the project material. |

## Repository layout

```text
docs/                       Project, engineering, roadmap, and evaluation references
Sonder-UI-master/            Proposal-defence PoC and its required assets
```

The PoC is a runnable, fixture-driven illustration of the product. Its diagnostic outputs, classes, messages, and reports are scripted; it is **not** the live diagnostic engine planned for the FYP. New implementation work belongs in separate paths as described in the [roadmap](docs/ROADMAP.md).

The local `Data_Maths-Phy-Chem/` working folder is excluded from this initial repository. Iteration 1 includes curating and validating reviewed content, then adding a versioned dataset through a later change with source and review information.

## Run the proposal PoC

With Node.js and npm installed:

```bash
cd Sonder-UI-master
npm ci
npm run dev
```

Open <http://localhost:3000>. See the [PoC README](Sonder-UI-master/README.md) for available checks and asset provenance.

## Working on the FYP

Use the [roadmap](docs/ROADMAP.md) for iteration boundaries and work packages. Keep new code, reviewed content, tests, and results traceable to requirements and named commits. For the mid evaluation, use the [evidence guide](docs/MID_EVALUATION.md) alongside the supervisor's editable worksheet and the department's prescribed report format. The worksheet distinguishes the presentation and live demonstration from the written mid report.
