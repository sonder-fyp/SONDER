"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/lib/session";
import { MusicProvider } from "@/lib/music";
import { BackgroundMatter } from "@/components/app/BackgroundMatter";

/**
 * Theme lives in lib/theme.tsx — a module-level store, not a provider — so
 * nothing needs to be added here. globals.css holds both palettes and
 * app/layout.tsx applies the stored one before first paint.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <MusicProvider>
        <BackgroundMatter />
        <TooltipProvider delay={200}>{children}</TooltipProvider>
        <Toaster />
      </MusicProvider>
    </SessionProvider>
  );
}
