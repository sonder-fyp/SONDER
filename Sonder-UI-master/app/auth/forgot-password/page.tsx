import { PasswordRecoveryForm } from "@/components/auth/PasswordRecoveryForm";

export default function ForgotPasswordPage() {
  return <div className="mx-auto max-w-[1080px]"><PasswordRecoveryForm reset={false} /></div>;
}
