"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const STUCK_AFTER_MS = 6000;

/**
 * Wraps router.refresh() with visible pending/stuck state. A create/edit/
 * delete action already awaits its Server Action before calling this — this
 * only covers the refetch-and-rerender step after that, which previously had
 * no feedback (see the "why doesn't it update instantly" conversation this
 * was built for).
 */
export function useDashboardRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stuckFlag, setStuckFlag] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isPending) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    timeoutRef.current = setTimeout(() => setStuckFlag(true), STUCK_AFTER_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isPending]);

  function refresh() {
    // Reset here (an event handler, not the effect body) rather than
    // whenever isPending flips back to false — setState directly in an
    // effect body triggers React's cascading-render lint rule.
    setStuckFlag(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return { refresh, isRefreshing: isPending, refreshStuck: stuckFlag && isPending };
}
