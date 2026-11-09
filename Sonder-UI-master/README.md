# Sonder proposal-defence PoC

This is the Sonder proposal-defence UI with Neon Managed Auth wired for real email accounts, email verification, password reset, onboarding, and server-enforced application roles. Diagnostic steps, AI-like replies, classes, messaging, and reports are still driven by fixtures; this is not the production FYP engine or backend.

## Run

Requires Node.js and npm. In this folder:

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. Create an account or sign in; workspace access comes from the database, not a client-side role selector.

## Authentication setup

Authentication is branch-scoped in Neon. For local development, use a dedicated development branch with Neon Managed Auth enabled; do not point this build at production while testing.

Set these values in the ignored `Sonder-UI-master/.env.local` file or the deployment secret store:

- `NEON_AUTH_BASE_URL`: the HTTPS Neon Auth endpoint for the selected Neon branch.
- `NEON_AUTH_COOKIE_SECRET`: a private random value of at least 32 characters.
- `DATABASE_URL`: the PostgreSQL connection string for that same branch.

The application does not print these values. The SQL migration at `db/001-auth-rbac.sql` expects the existing `sonder.app_user` table and adds the Auth identity link, onboarding flag, role requests, and role-change audit records. Apply it once to the development database after selecting the correct branch. It does not import, update, or link a user by matching email.

Enable email/password sign-in and require email verification in Neon Managed Auth. Its managed auth service handles password hashing, session cookies, password reset, and endpoint rate limits; do not create a second password store in the application. The current development branch uses email one-time codes for verification. Reset links expire after 15 minutes, and sessions are revoked after a reset.

The app's origin must be trusted by the selected Neon Auth branch. Neon permits `localhost` while localhost access is enabled, but a numeric loopback URL such as `http://127.0.0.1:3000` must be added explicitly under Auth domains (or with `neon neon-auth domain add http://127.0.0.1:3000 --project-id <project-id> --branch <development-branch>`). An origin mismatch makes Neon Auth reject sign-up and sign-in with `INVALID_ORIGIN`.

Google is configured for the development branch. Apple and GitHub need the project owner's OAuth credentials configured securely in Neon before those buttons can succeed. Managed Auth does not currently expose passkeys; no passkey flow is advertised. Production also needs its own trusted app domain, OAuth credentials, HTTPS, and a production-ready email provider.

Choose student, teacher, or parent during registration. Student accounts can access their workspace after onboarding; teacher and parent registrations remain blocked from all workspaces until an administrator approves them. Denied requests remain blocked and direct users to contact their administrator. Public signup cannot create administrators. To bootstrap the first administrator, first create and verify an account and complete onboarding, then run `scripts/provision-role.mjs` from this folder with `SONDER_ALLOW_ROLE_PROVISIONING=true`, the verified account email, the intended role, and `--confirm`. The script loads the ignored `.env.local`, only changes an already linked, active account, and records a role audit. Never put credentials in the command line, repository, or chat.

If a legacy application account uses an email that already exists in `sonder.app_user`, signup will not link it automatically. An operator must verify the identity through the trusted Auth console and explicitly link the Auth user ID to the existing application user; email equality alone is not proof of identity.

Checks:

```bash
npm test
npm run lint
npm run build
```

## What to keep

The runnable source is in `app/`, `components/`, `fixtures/`, `lib/`, and `public/`. The package manifests and root configuration files are required to install, test, and build it. `SONDER.png` is the original logo artwork; the app displays the processed mark in `public/brand/sonder-mark.png`. The soundtrack used by the app is `public/audio/background.mp3`.

## Asset provenance

The landing design was adapted from `brain-extract-anatomy`, which drew from `github.com/thebuggeddev/anatomy`. The upstream project did not provide a license file. The `brain.glb` model appears to contain Tripo AI material. Check rights for those assets before public or commercial reuse. The app uses GSAP, three.js, and Lenis; their applicable licenses should be checked for any later deployment.
