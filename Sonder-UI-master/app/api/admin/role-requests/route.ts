import { NextResponse } from "next/server";
import { AccessError, requireApiRole } from "@/lib/auth/access";
import { database } from "@/lib/auth/database";

const responseHeaders = { "Cache-Control": "no-store" };

function accessResponse(error: unknown) {
  if (error instanceof AccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: responseHeaders });
  }
  console.error("Could not load role requests.", error);
  return NextResponse.json({ error: "Access review is temporarily unavailable." }, { status: 503, headers: responseHeaders });
}

export async function GET() {
  try {
    await requireApiRole(["admin"]);
    const requests = await database()`
      SELECT r.id::text, r.requested_role, r.requested_at,
             u.email, u.display_name
      FROM sonder.auth_role_request r
      JOIN sonder.app_user u ON u.id = r.app_user_id
      WHERE r.status = 'pending'
      ORDER BY r.requested_at, r.id
      LIMIT 100
    `;
    return NextResponse.json({ requests }, { headers: responseHeaders });
  } catch (error) {
    return accessResponse(error);
  }
}
