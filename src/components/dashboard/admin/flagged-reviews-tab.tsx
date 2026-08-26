"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveFlaggedReview } from "@/lib/dashboard/admin-actions";
import { cn } from "@/lib/utils";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import type { FlaggedReview } from "@/types/dashboard-admin";

export function FlaggedReviewsTab({ initialReviews }: { initialReviews: FlaggedReview[] }) {
  const t = useTranslations("adminDashboard.flagged");
  const tc = useTranslations("adminDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [reviews, setReviews] = useState(initialReviews);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve(id: string, decision: "keep" | "remove") {
    setPendingId(id);
    setError(null);
    const result = await resolveFlaggedReview({ id, decision });
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setReviews((prev) => prev.filter((review) => review.id !== id));
    refresh();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {error && <p className="mb-4 text-sm font-medium text-destructive">{error}</p>}

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
        className="mb-4"
      />

      <div className="rounded-lg border border-border bg-white p-5">
        {reviews.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("noFlaggedReviews")}</p>
        ) : (
          reviews.map((review, index) => (
            <div
              key={review.id}
              className={cn("py-4.5 first:pt-0 last:pb-0", index > 0 && "border-t border-border")}
            >
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-foreground">{review.targetLabel}</span>
                <span className="text-xs text-lock">{review.flaggedAt}</span>
              </div>
              <div className="mb-2 flex items-center gap-0.5 text-cta">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5" fill={i < review.rating ? "currentColor" : "none"} />
                ))}
              </div>
              <p className="mb-3 text-sm text-foreground/85">{review.body}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleResolve(review.id, "keep")}
                  disabled={pendingId === review.id}
                >
                  {t("actions.keep")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-lock hover:text-lock"
                  onClick={() => handleResolve(review.id, "remove")}
                  disabled={pendingId === review.id}
                >
                  {t("actions.remove")}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
