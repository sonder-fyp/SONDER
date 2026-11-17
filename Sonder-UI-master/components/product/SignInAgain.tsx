import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Shown when an API call reports that the session has ended. */
export function SignInAgain({ returnTo }: { returnTo: string }) {
  return (
    <section role="alert" className="my-10 border-l-2 border-attention py-3 pl-6">
      <h2 className="text-xl font-semibold">Please sign in again</h2>
      <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">Your session has ended.</p>
      <Link className={`${buttonVariants()} mt-6`} href={`/auth/sign-in?next=${encodeURIComponent(returnTo)}`}>
        Log in
      </Link>
    </section>
  );
}
