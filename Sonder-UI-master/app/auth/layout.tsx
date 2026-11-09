export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-20 sm:px-10">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent/70" />
      <div className="w-full max-w-[1080px] border-y border-border py-12 sm:py-16">
        {children}
      </div>
    </main>
  );
}
