# Proposal-defence PoC

`Sonder-UI-master/` is the finalized interactive PoC prepared for the proposal defence. It is a **reference demonstration** for the approved FYP concept, not the production implementation to be assessed as a live diagnostic core at FYP‑1 Mid‑1. Keep it in the new repository under the same folder name so links from these documents remain valid.

## What it shows

The Next.js application has student, teacher, parent, and admin routes. It demonstrates diagnostic sessions, evidence and posterior views, teacher review and escalation, remediation and verification screens, learning resources and consultant conversations, content review, classes and messaging, parent summaries, and admin reporting. Its landing page combines the product with animated visual material.

The demo uses fixture files in `fixtures/` and playback helpers in `lib/`. The answer sequence, posterior values, chosen questions, consultant responses, and outcomes are prepared values. The UI does not calculate Bayesian updates, run a live AI model, authenticate real users, or store production data. When the FYP implementation begins, the team may reuse interface components as a design reference, but must distinguish any reused UI from newly implemented engine, service, data, and test work.

## How to run and inspect it

See the PoC's [README](../Sonder-UI-master/README.md) for installation and run commands. The important source areas are:

| Path | Purpose |
| --- | --- |
| `Sonder-UI-master/app/` | Routes and page composition. |
| `Sonder-UI-master/components/` | Shared product and landing components. |
| `Sonder-UI-master/fixtures/` | Scripted scenarios, content, and conversations. |
| `Sonder-UI-master/lib/` | Playback, local state, and helper logic. |
| `Sonder-UI-master/public/` | Images, model, and soundtrack used by the app. |

The PoC is useful for explaining the intended user journey and collecting design feedback. It cannot be used as evidence that the FYP's live diagnostic algorithm, database, security, or experimental evaluation has been implemented. The first live core slice is defined in [ROADMAP.md](ROADMAP.md).

## Reuse and asset boundary

The landing design includes material adapted from an upstream anatomy-themed project; the PoC README records its provenance and licensing questions. Review rights for third-party visual/model assets before public deployment or copying them into a production build. Keep the PoC source and asset provenance together in the repository, but do not include dependency folders or generated build output.
