import { PasswordRecoveryForm } from "@/components/auth/PasswordRecoveryForm";

type Props = { searchParams: Promise<{ token?: string | string[] }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  return <div className="mx-auto max-w-[1080px]"><PasswordRecoveryForm reset token={token} /></div>;
}
