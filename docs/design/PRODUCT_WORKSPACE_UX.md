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

## Live class features

Classes, join codes, rosters and assignments are connected to real records (I2-H09–H13, taken over by Ashher from Harris; [contract](../api/CLASS_ASSIGNMENT_CONTRACT.md)): `/teacher/classes`, `/teacher/classes/[classId]` (join code, students, assignments, archive) and `/student/classes` (class list and join). "Classes" is in both navigations. Starting a diagnostic from an assignment works through `/student/diagnostic/[unitId]?assignment=<id>`; the student dashboard that lists assignments is I2-A16.

## Live teacher and student features

Connected to stored records (I2-A11–A19, Ashher; [requirements](I2_TEACHER_STUDENT_REQUIREMENTS.md), [checks](../testing/PRODUCT_PATH_CHECKS.md)):
- **Teacher:**
  - the class Activity dashboard on `/teacher/classes/[classId]` (counts, filters, table)
  - the evidence page `/teacher/sessions/[sessionId]`, with question-by-question evidence and the review panel
- **Student:**
  - "Your assignments" with Start / Resume / Done on `/student`
  - "Past checks" on `/student/history`, which is in the student navigation

## Pending feature integration

The following URLs retain clear unavailable states and a route back to the workspace. They do not display fixture records or simulate successful operations.

| Area | Routes | Integration dependency |
| --- | --- | --- |
| Student class detail | `/student/classes/[classId]` | Assignments with Start/Resume are on the student home (I2-A16–A17); the class list and joining are live. |
| Older teacher and student pages | Student insights; teacher escalations, the scenario evidence route `/teacher/session/[scenario]` and per-student insights | Replaced on the live path by the routes below; kept as design references. |
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

## Browser layout review — 17 November 2026

A local Microsoft Playwright MCP server was connected to Chrome for visual inspection. The working-screen type scale is now scoped separately from the landing display scale: body copy is 16px, supporting text 15px, and labels are compact. Font families, palettes and the landing graphics are retained. Background graphics are quieter behind account and working screens. The diagnostic task layout uses less vertical spacing so the current question and options are visible sooner on phones.

The mobile drawer uses the working-screen scale. While it is open, the fixed header's named view-transition layer is disabled; Chromium otherwise paints that layer above the modal. Escape closes the drawer and restores focus to its trigger. Public account entry remains actionable with a Continue link while the client refreshes its session.

The five public account forms were exercised in the real app at 320, 768 and 1440 CSS pixels: login, registration, email verification, forgotten password and reset password. All 15 route/width combinations had 16px body copy and no horizontal overflow. Drawer title/close-button separation and Escape/focus return were checked in the browser. Light and dark screenshots were inspected.

The four role overviews, preferences, unavailable-feature state and diagnostic question were inspected at the same three widths using isolated, read-only component previews with synthetic identities. All 21 layout combinations fit the viewport. These previews exercise the actual components and styles; they do not authenticate a user or verify server data. Mathematical characters were checked with UTF-8 preview documents. The real signed-in student flow and persistent-flow harness remain separate, pending checks.
