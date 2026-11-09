import { redirect } from "next/navigation";
import { getAppAccount } from "@/lib/auth/access";
import { getSignedInUser } from "@/lib/auth/server";
import { ROLE_HOME } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

export default async function AccessPendingPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/auth/sign-in");
  if (!user.emailVerified) redirect(`/auth/verify-email?email=${encodeURIComponent(user.email)}`);

  const account = await getAppAccount(user.id);
  if (!account?.onboarding_complete) redirect("/auth/onboarding");
  if (account.status !== "active") redirect("/auth/access-paused");
  if (account.role_request_status !== "pending" && account.role_request_status !== "denied") {
    redirect(ROLE_HOME[account.role]);
  }

  const denied = account.role_request_status === "denied";
  return (
    <section className="mx-auto w-full max-w-[520px]">
      <p className="label text-accent">Registration review</p>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight">
        {denied ? "Your request was not approved." : "Your account is awaiting approval."}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        {denied
          ? `Your ${account.requested_role ?? "account"} registration was not approved. Contact your administrator if you believe this is a mistake.`
          : `Your ${account.requested_role ?? "account"} registration is complete. An administrator must approve it before you can access a workspace.`}
      </p>
    </section>
  );
}
