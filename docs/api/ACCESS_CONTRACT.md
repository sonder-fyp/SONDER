# Identity and access contract

## Identity source

Neon Managed Auth's session cookie is checked by `getSignedInUser()` on the server. The authenticated user ID resolves a `sonder.app_user` row by `auth_user_id`; `AppAccount` role, status, onboarding and pending or denied requests come from the database, never the request.

Neon Managed Auth is the account system (PR #45): it provides password hashing, sessions and logout. The Iteration 1 `password_credential` and `auth_session` tables are unused; a second credential store would be a separate authentication redesign.

## Helpers

| Helper | Behaviour |
| --- | --- |
| `requirePageRole(role, returnTo)` | Checks signed-in account and role; redirects to sign-in, onboarding, access status or the correct role home. |
| `requireApiRole(roles)` | Returns authenticated `user` and `account`; throws `AccessError` with 401 or 403. |
| `requireAccess(roles)` | Returns `appUserId`, database `role`, `authUserId` and `account`; checks the account ID. |
| `withAccess(roles, handler, { mutation? })` | Authenticates, checks roles and mutation origin, supplies access context and returns safe errors. |
| `isSameOrigin(request)` | Checks the request origin against its forwarded or direct host and protocol. |

Errors are `authentication_required` (401), `role_required` (403), and `invalid_origin` (403). Unexpected failures are `service_unavailable` (503).

## Integration examples

Harris's class command can use the account ID, and must enforce class ownership and membership in its own queries:

```ts
export const POST = withAccess(["teacher"], async ({ appUserId }, request) => {
  // Validate request and insert the class and class_teacher.teacher_id = appUserId.
  return createClass(request, appUserId);
}, { mutation: true });
```

Ashher's teacher evidence route can use `withAccess(["teacher"], …)` and must scope queries through `class_teacher.teacher_id = appUserId` and active class/membership status. A student page can use `<RoleGate role="student" returnTo="/student">`.

## Python service boundary

Only the BFF sends the shared service token and `X-Sonder-Actor` application account ID to the loopback Python service; the browser cannot select the actor. See the [session contract](SESSION_CONTRACT.md#51-parties-and-trust).

## Sessions, logout and expiry

`authClient.signOut()` in `lib/session.tsx` ends the Neon session; subsequent API requests receive 401. Session lifetime and revocation are configured in Neon Auth; not stated here.

## Public assets

Static brand images, models, audio and site icons are public assets and bypass the authentication proxy. Application pages and API routes retain their existing server-side access checks.

## Mutation protection

Every mutation checks same origin and validates JSON bodies. Diagnostic mutations use `SONDER_UI_ORIGIN`.

## Demo accounts

0. First administrator: sign up and onboard an account as a student, then from `Sonder-UI-master/` with `.env.local` loaded run `SONDER_ALLOW_ROLE_PROVISIONING=true node scripts/provision-role.mjs <email> admin --confirm` (Node 20 or newer). Provisioning also withdraws the account's pending access request. (A request already `denied` is not changed.)
1. Sign up through `/auth/sign-up` using an address you control, verify it and complete student onboarding.
2. For a teacher, request teacher access at signup and approve it as an admin at `/admin/access`, or load `.env.local` and run `SONDER_ALLOW_ROLE_PROVISIONING=true node scripts/provision-role.mjs <email> teacher --confirm` from `Sonder-UI-master/`.
3. Enrol a student in the development class with `SONDER_ALLOW_DEV_SEED=true python -m sonder_api.devseed --enrol-email <email>`.

Never commit actual emails, passwords or `.env.local`, and do not put them in PR text. The development seed is a development candidate.

## Negative tests

- `lib/auth/access.test.ts`: anonymous, incomplete, paused, pending, denied, wrong and forged roles, invalid account shape, and logout/expiry.
- `lib/auth/guard.test.ts`: origin, 401/403, unexpected failures and allowed access.
- `app/api/account/profile/route.test.ts`: privileged role requests, duplicate onboarding, origin and email verification.
