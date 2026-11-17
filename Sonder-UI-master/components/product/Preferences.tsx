"use client";
import { Container, PageMasthead } from "@/components/layout";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { MusicToggle } from "@/components/app/MusicToggle";
import { useSession } from "@/lib/session";

export function Preferences() {
  const { account, email } = useSession();
  return (
    <Container className="pb-20">
      <PageMasthead
        label="Your account"
        title="Preferences"
        lede="Make Sonder feel comfortable to use. Appearance and sound preferences are saved on this browser."
      />
      <section className="max-w-2xl py-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Appearance and sound
        </h2>
        <div className="mt-6 divide-y divide-border border-y border-border">
          <div className="flex items-center justify-between gap-6 py-6">
            <div>
              <h3 className="font-medium">Colour theme</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose the light or dark appearance.
              </p>
            </div>
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-between gap-6 py-6">
            <div>
              <h3 className="font-medium">Background music</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional audio while you use Sonder.
              </p>
            </div>
            <MusicToggle />
          </div>
        </div>
        <h2 className="mt-12 text-2xl font-semibold tracking-tight">
          Account details
        </h2>
        <dl className="mt-6 divide-y divide-border">
          {[
            ["Name", account?.display_name],
            ["Email", email],
            ["Account type", account?.role],
          ].map(([label, value]) => (
            <div
              key={label}
              className="grid gap-2 py-4 sm:grid-cols-[140px_1fr]"
            >
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="break-words text-sm">{value ?? "Loading…"}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
          Motion follows your device’s reduced-motion setting. Account access is
          managed by your administrator.
        </p>
      </section>
    </Container>
  );
}
