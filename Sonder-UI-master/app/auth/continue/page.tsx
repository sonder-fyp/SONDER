import { redirect } from "next/navigation";
import { getAppAccount } from "@/lib/auth/access";
import { getSignedInUser } from "@/lib/auth/server";
import { ROLE_HOME } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ requestedRole?: string | string[] }> };

export default async function ContinuePage({ searchParams }: Props) {
  const user = await getSignedInUser();
  if (!user) redirect("/auth/sign-in");
  if (!user.emailVerified) redirect(`/auth/verify-email?email=${encodeURIComponent(user.email)}`);

  const account = await getAppAccount(user.id);
  if (!account?.onboarding_complete) {
    const params = await searchParams;
    const role = Array.isArray(params.requestedRole) ? params.requestedRole[0] : params.requestedRole;
    const requestedRole = role === "teacher" || role === "parent" ? role : "student";
    redirect(`/auth/onboarding?requestedRole=${requestedRole}`);
  }
  if (account.status !== "active") redirect("/auth/access-paused");
  if (account.role_request_status === "pending" || account.role_request_status === "denied") {
    redirect("/auth/access-pending");
  }
  redirect(ROLE_HOME[account.role]);
}
