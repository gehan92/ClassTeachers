"use client";

import { useState } from "react";

/**
 * Shared client-side pagination — the same PAGE_SIZE=10 + clamp-at-render
 * shape hand-copied into the teacher dashboard's Notes/Exams/Assignments
 * tabs and the institute Classes&Batches tab (see
 * classportals-list-filter-pagination-pattern). Extracted once this needed
 * to spread to a dozen more lists instead of being copied a 4th+ time.
 *
 * currentPage is clamped from `totalItems`/`pageSize` at render, never via
 * a setState-in-effect (that trips react-hooks/set-state-in-effect and lags
 * a render behind) — so a filter shrinking the result set below the current
 * page just resolves correctly on the next render with no extra wiring.
 * Callers still need to call `setPage(1)` themselves inside each filter's
 * onChange, same as the existing pattern — this hook can't know when a
 * caller's own filtering logic has changed.
 */
export function usePagination(totalItems: number, pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * pageSize;

  return { page, setPage, currentPage, totalPages, offset, pageSize };
}
