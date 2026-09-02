"use client";

import { Button } from "@/components/ui/button";

/**
 * Shared "Showing X of Y" + Previous/Next + "Page X of Y" footer — the same
 * markup hand-copied into every dashboard list tab that already paginates.
 * Pairs with usePagination (src/lib/hooks/use-pagination.ts). Deliberately
 * takes already-translated label strings rather than calling useTranslations
 * itself — every dashboard keeps its own translation namespace, so the
 * caller is what knows which one applies.
 */
export function PaginationFooter({
  currentPage,
  totalPages,
  onPageChange,
  showingLabel,
  previousLabel,
  nextLabel,
  pageInfoLabel,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showingLabel: string;
  previousLabel: string;
  nextLabel: string;
  pageInfoLabel: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{showingLabel}</p>
      {totalPages > 1 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          >
            {previousLabel}
          </Button>
          <span className="text-sm text-muted-foreground">{pageInfoLabel}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          >
            {nextLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
