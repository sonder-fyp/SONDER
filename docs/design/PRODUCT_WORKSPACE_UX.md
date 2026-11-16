# Product workspace UX — 17 November 2026

Sonder now has separate public, account-entry and working experiences. The public site explains the product and offers one account entrance. The application uses the authenticated account's role and name. The palette, typography, logo, brain, wordmark, illustrations and landing animation remain in place.

## Available journeys

| Journey | Behaviour |
| --- | --- |
| Public website | How it works, For educators, login and registration. Returning accounts get Open dashboard. No role entrances or internal route names. |
| Accounts | Email registration, verification, onboarding, login and recovery. Teacher/parent requests require existing administrator approval. Admin is not a registration option. |
| Student | Personal welcome, service-provided Mathematics topic list, persistent diagnostic start/resume, saved-answer feedback and neutral completion. |
| Administrator | Account overview and real access-request list. Decisions require an inline confirmation and acknowledge the persisted outcome. |
| Preferences | Light/dark appearance and optional music, saved on this browser. Account identity is read-only. Motion respects device preferences. |
| Other workspaces | Teacher and parent overviews describe availability without example identities, counts or records. |

Primary navigation includes operational destinations only. Preferences are available within each role's layout. Product branding returns to the person's dashboard; the account disclosure also links to the public website. Mobile navigation uses a native modal dialog for focus containment and Escape handling.

Email is the displayed sign-in method. The previous unconditional Google, Apple and GitHub buttons are removed because provider availability is not declared by this application. This changes presentation, not Neon Auth configuration. Add a provider only with a configured, verified flow.

## Pending feature integration

The following URLs retain clear unavailable states and a route back to the workspace. They do not display fixture records or simulate successful operations.

| Area | Routes | Integration dependency |
| --- | --- | --- |
| Classes | Student/teacher class list and detail | Harris: class, roster, enrolment and assignment services (I2-H09–H13). |
| Activity and teacher review | Student insights; teacher follow-up, evidence, review and student activity | Ashher: dashboards, history, evidence and persistent review (I2-A11–A19). |
| Learning | Student library, concept, study-note and follow-up routes | Real resources, permitted record associations and follow-up workflow. |
| Parent | Child summaries and messages | Authorised child linkage and permitted summary publication. |
| Communication | Student, teacher and parent messages; consultants | Real delivery/assistant service with account-scoped records. |
| Content administration | Catalogue, coverage, performance, provenance and teacher content-review routes | Persisted content, review and report services with source/version identity. |
| Legacy diagnostics | `/student/session/[scenario]/[mode]` | Replaced in normal navigation by `/student/diagnostic/[unitId]`. The old link explains recovery without substituting a different attempt. |

To activate an area, its feature owner replaces the relevant unavailable page with the real implementation, handles loading/empty/error/access states, then adds its destination to `lib/nav.tsx`. Do not re-enable fixture imports or browser-local mutations as fallbacks. Do not equate teacher review with approval to release a diagnosis. Do not derive grades or learning improvement from diagnostic confidence.

The component gallery is development-only and is absent from public navigation. Legacy fixture files and unused showcase components remain as design references, but ordinary route pages no longer import fixtures. The teacher layout no longer polls the demo latest-result notice.

## Verification and review

Automated coverage exercises public/account-aware navigation, mobile dialog open/close, identifier-free breadcrumbs, registration and safe login return paths, catalogue loading/failure/expiry/empty states, persistent diagnostic feedback, truthful role overviews, and access-request confirmation and failed-save recovery. Existing persistence and authorization checks remain applicable.

Before release, visually inspect the landing, account journey, each role overview, preferences, topic list and diagnostic at 320, 768 and 1440 pixels in both themes. Check keyboard traversal, mobile Escape/focus return, reduced motion, and saved-answer recovery on a real signed-in student account. Browser-driven verification and the live persistent-flow harness are separate checks; unit tests and HTTP responses do not establish that they passed.

## Scope

This is a presentation and navigation change on top of Ahmed's Iteration 2 stack. It adds no class, assignment, dashboard/history, review, parent-linking, messaging, importer or engine backend. Pending service work retains its team ownership. No database schema or diagnostic engine change is included. Development seed content remains a development candidate.
