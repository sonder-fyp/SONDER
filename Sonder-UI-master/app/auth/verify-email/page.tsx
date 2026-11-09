import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";

type Props = { searchParams: Promise<{ email?: string | string[]; requestedRole?: string | string[] }> };

export default async function VerifyEmailPage({ searchParams }: Props) {
  const params = await searchParams;
  const email = Array.isArray(params.email) ? params.email[0] ?? "" : params.email ?? "";
  const role = Array.isArray(params.requestedRole) ? params.requestedRole[0] : params.requestedRole;
  const requestedRole = role === "teacher" || role === "parent" ? role : "student";
  return <div className="mx-auto max-w-[1080px]"><VerifyEmailForm initialEmail={email} requestedRole={requestedRole} /></div>;
}
