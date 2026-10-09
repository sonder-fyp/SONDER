/// <reference types="react/canary" />

import * as React from "react";

type ViewTransitionComponent = React.ExoticComponent<{
  default?: string;
  children?: React.ReactNode;
}>;

const ViewTransition = (React as typeof React & {
  ViewTransition?: ViewTransitionComponent;
}).ViewTransition;

/**
 * Templates remount on navigation, which is when ViewTransition enter/exit run.
 * Persistent chrome lives in AppShell. If this React build has no ViewTransition
 * export, fall back to the existing page-enter fade (template remount replays it).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  if (ViewTransition) {
    return <ViewTransition default="page-swap">{children}</ViewTransition>;
  }
  return <div className="page-enter">{children}</div>;
}
