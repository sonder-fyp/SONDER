import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { getAppAccount } from "@/lib/auth/access";
import { getSignedInUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ requestedRole?: string | string[] }> };

export default async function OnboardingPage({ searchParams }: Props) {
  const user = await getSignedInUser();
  if (!user) redirect("/auth/sign-in");
  if (!user.emailVerified) redirect(`/auth/verify-email?email=${encodeURIComponent(user.email)}`);
  const account = await getAppAccount(user.id);
  if (account?.onboarding_complete) redirect("/auth/continue");
  const params = await searchParams;
  const role = Array.isArray(params.requestedRole) ? params.requestedRole[0] : params.requestedRole;
  const requestedRole = role === "teacher" || role === "parent" ? role : "student";
  return <div className="mx-auto max-w-[1080px]"><OnboardingForm requestedRole={requestedRole} /></div>;
}
