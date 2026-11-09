import { AuthEntry } from "@/components/auth/AuthEntry";

type Props = {
  searchParams: Promise<{ next?: string | string[]; verified?: string }>;
};

export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams;
  const nextPath = Array.isArray(params.next) ? params.next[0] ?? "/auth/continue" : params.next ?? "/auth/continue";
  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[1080px] gap-12 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)] md:items-center md:gap-20">
      <AuthEntry mode="sign-in" nextPath={nextPath} verified={params.verified === "1"} />
      <aside className="hidden border-l border-border pl-10 md:block">
        <p className="label text-accent">A clearer way to learn</p>
        <p className="mt-6 max-w-[18ch] text-3xl font-medium leading-tight">
          Find the idea behind the answer.
        </p>
        <p className="mt-5 max-w-[34ch] text-base leading-relaxed text-muted-foreground">
          Your workspace is based on your account and assigned access, not a role switcher.
        </p>
      </aside>
    </div>
  );
}
