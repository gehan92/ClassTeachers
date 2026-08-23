"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Panel } from "@/components/features/teacher-profile-view";
import { ReviewItem } from "@/components/features/review-item";
import { Button } from "@/components/ui/button";
import type { ReviewDisplay } from "@/types/review";

const PAGE_SIZE = 5;

/**
 * Client component so pagination can be plain useState — the full reviews
 * array is already fetched server-side (no extra query per page), this just
 * slices it. A popular teacher's review list was rendering fully inline
 * with no cap, which made the page unbounded in height.
 */
export function ReviewsPanel({
  reviews,
  reviewCount,
  rating,
}: {
  reviews: ReviewDisplay[];
  reviewCount: number;
  rating: number;
}) {
  const t = useTranslations("profilePage");
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(reviews.length / PAGE_SIZE);
  const visible = reviews.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <Panel title={t("reviewsHeading", { count: reviewCount, rating: rating.toFixed(1) })}>
      {reviews.length > 0 ? (
        <>
          {visible.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
          {pageCount > 1 && (
            <div className="mt-3 flex items-center justify-between gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                {t("reviewsPrev")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("reviewsPageOf", { page: page + 1, pages: pageCount })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
              >
                {t("reviewsNext")}
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="m-0 py-2 text-sm text-muted-foreground">{t("noReviews")}</p>
      )}
    </Panel>
  );
}
