"use client";

import { useSyncExternalStore } from "react";

/**
 * SSR-safe media-query hook. Reports `false` until mounted (matches
 * `useIsMobile`), then tracks the given query. Used by the dashboard header
 * to collapse search before it can collide with "New trip" (ODY-092).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
