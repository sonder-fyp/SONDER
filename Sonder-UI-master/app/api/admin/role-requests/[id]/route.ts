import { NextResponse } from "next/server";
import { AccessError, requireApiRole } from "@/lib/auth/access";
import { database } from "@/lib/auth/database";
import { isSameOrigin } from "@/lib/auth/origin";

const responseHeaders = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: responseHeaders });
  }

  try {
    const { user } = await requireApiRole(["admin"]);
    const { id } = await context.params;
    if (!UUID.test(id)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 422, headers: responseHeaders });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        !("decision" in body) || (body.decision !== "approve" && body.decision !== "deny")) {
      return NextResponse.json({ error: "Choose approve or deny." }, { status: 422, headers: responseHeaders });
    }

    const decision = body.decision;
    const rows = await database()`
      WITH reviewer AS (
        SELECT id FROM sonder.app_user
        WHERE auth_user_id = ${user.id} AND role = 'admin' AND status = 'active'
      ),
      pending AS MATERIALIZED (
        SELECT r.id AS request_id, r.app_user_id, r.requested_role, u.role AS previous_role
        FROM sonder.auth_role_request r
        JOIN sonder.app_user u ON u.id = r.app_user_id
        WHERE r.id = ${id}::uuid AND r.status = 'pending'
        FOR UPDATE OF r, u
      ),
      reviewed AS (
        UPDATE sonder.auth_role_request r
        SET status = CASE WHEN ${decision} = 'approve' THEN 'approved' ELSE 'denied' END,
            reviewed_at = now(),
            reviewed_by = reviewer.id
        FROM pending, reviewer
        WHERE r.id = pending.request_id
        RETURNING r.id, pending.app_user_id, pending.requested_role, pending.previous_role
      ),
      changed AS (
        UPDATE sonder.app_user u
        SET role = CASE WHEN ${decision} = 'approve' THEN reviewed.requested_role ELSE u.role END
        FROM reviewed
        WHERE u.id = reviewed.app_user_id
        RETURNING u.id, u.role AS new_role, reviewed.previous_role
      ),
      audit AS (
        INSERT INTO sonder.auth_role_audit (
          app_user_id, actor_user_id, previous_role, new_role, change_source
        )
        SELECT changed.id, reviewer.id, changed.previous_role, changed.new_role, 'admin_approval'
        FROM changed CROSS JOIN reviewer
        WHERE changed.previous_role <> changed.new_role
        RETURNING id
      )
      SELECT changed.id::text, changed.new_role
      FROM changed
    `;
    if (!rows.length) {
      return NextResponse.json({ error: "That request was already reviewed or is unavailable." }, { status: 409, headers: responseHeaders });
    }
    return NextResponse.json({ account: rows[0] }, { headers: responseHeaders });
  } catch (error) {
    if (error instanceof AccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: responseHeaders });
    }
    console.error("Could not review the role request.", error);
    return NextResponse.json({ error: "Access review is temporarily unavailable." }, { status: 503, headers: responseHeaders });
  }
}
