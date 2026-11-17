export default function Loading() {
  return (
    <div role="status" className="mx-auto max-w-[1200px] px-6 py-12 md:px-12">
      <p className="label text-muted-foreground">Loading your page…</p>
      <div
        aria-hidden
        className="mt-8 max-w-2xl space-y-6 motion-safe:animate-pulse"
      >
        <div className="h-10 w-2/3 bg-muted" />
        <div className="h-px bg-border" />
        <div className="h-24 bg-muted/40" />
      </div>
    </div>
  );
}
