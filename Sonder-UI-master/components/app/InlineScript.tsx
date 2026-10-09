/**
 * A script that must run synchronously while the browser parses the HTML,
 * before first paint. Straight from the Next.js guide:
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 *
 * `type` is text/javascript on the server (so it executes during parsing) and
 * text/plain on the client (so React never re-executes it on a soft
 * navigation). suppressHydrationWarning absorbs that deliberate mismatch.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
