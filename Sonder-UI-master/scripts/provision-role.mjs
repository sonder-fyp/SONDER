import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";

loadEnvConfig(process.cwd());

const [emailArgument, roleArgument, confirmation] = process.argv.slice(2);
const email = emailArgument?.trim().toLowerCase();
const roles = new Set(["student", "teacher", "parent", "admin"]);

if (process.env.SONDER_ALLOW_ROLE_PROVISIONING !== "true" || confirmation !== "--confirm") {
  throw new Error("Set SONDER_ALLOW_ROLE_PROVISIONING=true and pass --confirm to provision roles.");
}
if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !roles.has(roleArgument)) {
  throw new Error("Usage: node scripts/provision-role.mjs <email> <student|teacher|parent|admin> --confirm");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  WITH target AS MATERIALIZED (
    SELECT id, role AS previous_role
    FROM sonder.app_user
    WHERE email = ${email} AND auth_user_id IS NOT NULL AND status = 'active'
    FOR UPDATE
  ),
  changed AS (
    UPDATE sonder.app_user u
    SET role = ${roleArgument}
    FROM target
    WHERE u.id = target.id
    RETURNING u.id, u.role AS new_role, target.previous_role
  ),
  audit AS (
    INSERT INTO sonder.auth_role_audit (
      app_user_id, previous_role, new_role, change_source
    )
    SELECT id, previous_role, new_role, 'operator_provisioning'
    FROM changed
    WHERE previous_role <> new_role
    RETURNING id
  )
  SELECT id::text, new_role FROM changed
`;
if (!rows.length) throw new Error("No active, already-onboarded account matched that email.");
console.log(`Assigned ${rows[0].new_role} role to the requested account.`);
