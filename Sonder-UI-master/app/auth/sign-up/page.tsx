import { AuthEntry } from "@/components/auth/AuthEntry";

export default function SignUpPage() {
  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[1080px] gap-12 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)] md:items-center md:gap-20">
      <AuthEntry mode="sign-up" nextPath="/auth/onboarding" />
      <aside className="hidden border-l border-border pl-10 md:block">
        <p className="label text-accent">Start with the essentials</p>
        <p className="mt-6 max-w-[18ch] text-3xl font-medium leading-tight">
          A few details. A clearer starting point.
        </p>
        <p className="mt-5 max-w-[34ch] text-base leading-relaxed text-muted-foreground">
          Verify your email, tell us your name, and find your next step. Teacher
          and parent registrations are reviewed before access is granted.
        </p>
      </aside>
    </div>
  );
}
