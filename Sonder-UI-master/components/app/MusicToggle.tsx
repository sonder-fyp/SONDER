"use client";

import { Volume2, VolumeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMusic } from "@/lib/music";

export function MusicToggle({ className }: { className?: string }) {
  const { playing, toggle } = useMusic();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={playing}
      aria-label={playing ? "Mute background music" : "Play background music"}
      className={cn(
        "grid size-11 shrink-0 place-items-center transition-colors duration-150",
        playing
          ? "text-accent"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {playing ? (
        <Volume2 className="size-5" strokeWidth={1.5} aria-hidden />
      ) : (
        <VolumeOff className="size-5" strokeWidth={1.5} aria-hidden />
      )}
    </button>
  );
}
