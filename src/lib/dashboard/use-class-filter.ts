"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { GENERAL_BATCH_KEY } from "./group-by-class";

/**
 * Reads the ?owner=&batch= filter a "View notes"/"View assignments" link
 * from My Classes (classes-tab.tsx) lands with, matching groupByClass's own
 * key format. "Show all classes" clears it locally without touching the
 * URL — clearing shouldn't need another full navigation.
 */
export function useClassFilter() {
  const searchParams = useSearchParams();
  const owner = searchParams.get("owner");
  const batch = searchParams.get("batch") ?? GENERAL_BATCH_KEY;
  const [cleared, setCleared] = useState(false);

  const filterKey = !cleared && owner ? `${owner}::${batch}` : null;
  return { filterKey, clearFilter: () => setCleared(true) };
}
