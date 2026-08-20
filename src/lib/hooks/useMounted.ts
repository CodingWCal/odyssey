"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * SSR-safe "have we hydrated yet" flag. Returns `false` during SSR and the
 * hydration pass (matching the server), then `true` on the client — via
 * useSyncExternalStore so React reconciles it without a hydration mismatch and
 * without a setState-in-effect. Use to defer client-only widgets (e.g. Clerk's
 * <UserButton>, which renders differently server vs client) behind a stable
 * placeholder.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false
  );
}
