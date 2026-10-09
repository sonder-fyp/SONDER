"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * useLayoutEffect warns when React renders on the server. Every landing component that
 * measures the DOM needs layout-effect timing in the browser and effect timing (which
 * never actually runs) on the server.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
