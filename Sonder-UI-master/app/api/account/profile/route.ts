import { NextResponse } from "next/server";
import { getAppAccount } from "@/lib/auth/access";
import { database } from "@/lib/auth/database";
import { isSameOrigin } from "@/lib/auth/origin";
import { getSignedInUser } from "@/lib/auth/server";
import { normalizeEmail, validateOnboarding } from "@/lib/auth/validation";

const responseHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const user = await getSignedInUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: responseHeaders });
    if (!user.emailVerified) return NextResponse.json({ error: "Verify your email first." }, { status: 403, headers: responseHeaders });
    const account = await getAppAccount(user.id);
    return NextResponse.json({ account }, { headers: responseHeaders });
  } catch (error) {
    console.error("Could not load the signed-in account.", error);
    return NextResponse.json({ error: "Account service is temporarily unavailable." }, { status: 503, headers: responseHeaders });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: responseHeaders });
  }

  try {
    const user = await getSignedInUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: responseHeaders });
    if (!user.emailVerified) return NextResponse.json({ error: "Verify your email first." }, { status: 403, headers: responseHeaders });

    const existing = await getAppAccount(user.id);
    if (existing?.status === "deactivated") {
      return NextResponse.json({ error: "This account cannot be updated." }, { status: 403, headers: responseHeaders });
    }
    if (existing?.onboarding_complete || existing?.role_request_status) {
      return NextResponse.json({ error: "Registration has already been completed." }, { status: 409, headers: responseHeaders });
    }

    const rawBody = await request.text();
    if (rawBody.length > 4096) {
      return NextResponse.json({ error: "Invalid profile details." }, { status: 422, headers: responseHeaders });
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }
    const input = validateOnboarding(parsedBody);
    const email = normalizeEmail(user.email);
    if (!input || !email) {
      return NextResponse.json({ error: "Enter a valid name and role." }, { status: 422, headers: responseHeaders });
    }

    const rows = await database()`
      WITH account AS (
        INSERT INTO sonder.app_user (
          email, role, display_name, status, auth_user_id, auth_onboarding_complete
        )
        VALUES (${email}, 'student', ${input.displayName}, 'active', ${user.id}, true)
        ON CONFLICT (auth_user_id) DO UPDATE
          SET display_name = EXCLUDED.display_name,
              auth_onboarding_complete = true
        RETURNING id, id::text AS account_id, email, display_name, role, status,
                  auth_onboarding_complete AS onboarding_complete
      ),
      requested AS (
        INSERT INTO sonder.auth_role_request (app_user_id, requested_role)
        SELECT a.id, ${input.requestedRole}
        FROM account a
        WHERE ${input.requestedRole} <> 'student'
        ON CONFLICT (app_user_id) WHERE status = 'pending'
        DO UPDATE SET requested_role = EXCLUDED.requested_role,
                      requested_at = now()
        RETURNING app_user_id
      )
      SELECT account_id AS id, email, display_name, role, status, onboarding_complete
      FROM account
    `;
    const account = rows[0];
    if (!account) throw new Error("Account was not persisted.");

    return NextResponse.json({ account }, { headers: responseHeaders });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json(
        { error: "This email is already linked to an account. Contact an administrator for help." },
        { status: 409, headers: responseHeaders },
      );
    }
    console.error("Could not save onboarding details.", error);
    return NextResponse.json({ error: "Account service is temporarily unavailable." }, { status: 503, headers: responseHeaders });
  }
}
