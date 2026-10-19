"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageVisit } from "@/lib/analytics/track";

/**
 * Records one page visit per route (and per dashboard tab) for Admin ->
 * Traffic. Renders nothing. Mounted once in the root layout inside a
 * Suspense boundary, since useSearchParams needs one.
 */
export function VisitTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    trackPageVisit(pathname, search);
  }, [pathname, search]);

  return null;
}
