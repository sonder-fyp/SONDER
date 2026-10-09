# GitHub Repo Code Push Standards

## Branches

- `main`: always demo-ready. Evaluation tags come from here. No direct pushes. EVER.
- `dev`: integration branch. No direct pushes. Only PRs opened from feature branches may merge into `dev`.
- Feature branches: one per task, named `<your-name>/<short-feature-description>`, for example `harris/q-matrix-import`.
- Learn what "base" and "compare" mean in a PR. This is important. "Base" is the branch your changes merge INTO and "compare" is the branch that holds your changes. A feature PR is base `dev`, compare `<your-name>/<feature>`. A release PR is base `main`, compare `dev`. GitHub defaults base to `main`, so always check that base is `dev` before creating a feature PR.

## How a change goes in

1. Branch off `dev`, work, push your feature branch.
2. Open a PR into `dev`. CI runs automatically (install, lint, tests, build for the UI).
3. Fix anything CI flags by pushing to the same branch.
4. One teammate reviews and approves. Not the author. This matches the lead/reviewer pairing in the work division.
5. Squash merge into `dev`.
6. When `dev` is stable, open a PR from `dev` into `main` with the same CI and one approval, and merge with a regular merge commit. Do not squash, otherwise `dev` and `main` drift apart.
7. Ahmed tags the evaluation commit on `main`.

## Rules

- No direct pushes to `main` or `dev`.
- No secrets in Git. Neon PostgreSQL connection strings go in GitHub secrets or local `.env` files only.
- Fill in the PR template.
- Commit counts are not contribution evidence, so keep PRs tied to a task. This makes feature commits easy to track.

## Setup in progress

- A GitHub Actions workflow for the UI only. An engine workflow job (YAML) will be added once the Python package exists.
- A PR template.
- Branch protection on `main` and `dev`, once the workflow has run once.
