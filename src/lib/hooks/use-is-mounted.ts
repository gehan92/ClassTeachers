"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * True only after the client has hydrated — for code that needs `document`
 * (e.g. createPortal) and would otherwise throw during the server render
 * pass. useSyncExternalStore rather than a mounted useState+useEffect pair:
 * setState directly in an effect body trips React's cascading-render lint
 * rule (see the identical note in use-dashboard-refresh.ts).
 */
export function useIsMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
