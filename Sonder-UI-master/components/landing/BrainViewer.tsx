"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { brain } from "@/lib/landing/anatomy/brain-data";
import type { AnatomyViewer } from "@/lib/landing/three/viewer";
import "./styles/brain-viewer.css";

export type BrainViewerHandle = {
  setEntryProgress: (p: number) => void;
};

type BrainViewerProps = {
  className?: string;
  entryAnimation?: boolean;
  autoRotate?: boolean;
  showLoader?: boolean;
  showTip?: boolean;
  showCaption?: boolean;
  showToolRail?: boolean;
  showAutoRotateToggle?: boolean;
  onViewerReady?: (api: BrainViewerHandle | null) => void;
};

/**
 * React mount for AnatomyViewer. three.js is dynamically imported so it never
 * lands in the first chunk. Chrome flags exist for the original atelier UI;
 * the landing hero turns them all off.
 */
export function BrainViewer({
  className,
  entryAnimation = false,
  autoRotate = true,
  showLoader = true,
  showCaption = true,
  onViewerReady,
}: BrainViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AnatomyViewer | null>(null);
  const readyRef = useRef(onViewerReady);
  useEffect(() => {
    readyRef.current = onViewerReady;
  }, [onViewerReady]);

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let cancelled = false;
    let viewer: AnatomyViewer | null = null;

    void import("@/lib/landing/three/viewer").then(({ AnatomyViewer: Viewer }) => {
      if (cancelled || !mountRef.current) return;
      viewer = new Viewer(mountRef.current, {
        onLoading: (isLoading, p) => {
          setLoading(isLoading);
          setProgress(p);
        },
        entryAnimation,
      });
      viewerRef.current = viewer;
      viewer.setAutoRotate(autoRotate);
      const handle: BrainViewerHandle = {
        setEntryProgress: (p) => viewerRef.current?.setEntryProgress(p),
      };
      void viewer.setOrgan(brain.model, brain.accent).then(() => {
        if (cancelled) return;
        readyRef.current?.(handle);
      });
    });

    return () => {
      cancelled = true;
      readyRef.current?.(null);
      viewer?.dispose();
      viewerRef.current = null;
    };
  }, [entryAnimation, autoRotate]);

  return (
    <div
      className={cn("brain-viewer", className)}
      style={{ ["--bv-organ-accent" as string]: brain.accent }}
    >
      <div className="viewer-glow" aria-hidden />
      <div ref={mountRef} className="three-mount" />
      {showLoader && loading ? (
        <div className="viewer-loader" role="status">
          <span className="sr-only">Loading the brain model</span>
          <div className="rule-sweep w-24" aria-hidden />
          <p className="label mt-4 text-muted-foreground">
            {Math.round(progress * 100)}%
          </p>
        </div>
      ) : null}
      {showCaption ? (
        <p className="viewer-caption label text-muted-foreground">
          {brain.name} · {brain.scientificName}
        </p>
      ) : null}
    </div>
  );
}
