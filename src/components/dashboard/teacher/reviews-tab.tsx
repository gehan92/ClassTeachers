"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ReviewItem } from "@/components/features/review-item";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { usePagination } from "@/lib/hooks/use-pagination";
import { replyToReview, flagReview } from "@/lib/dashboard/reviews-actions";
import type { ReviewDisplay } from "@/types/review";

const textareaClass =
  "min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export function ReviewsTab({
  initialReviews,
  averageRating,
  reviewCount,
}: {
  initialReviews: ReviewDisplay[];
  averageRating: string;
  reviewCount: number;
}) {
  const t = useTranslations("teacherDashboard.reviews");
  const tc = useTranslations("teacherDashboard.common");

  const [reviews, setReviews] = useState<ReviewDisplay[]>(initialReviews);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(reviews.length);
  const pagedReviews = reviews.slice(offset, offset + pageSize);

  function startReply(id: string) {
    setReplyingId(id);
    setReplyText("");
  }

  function cancelReply() {
    setReplyingId(null);
    setReplyText("");
  }

  async function postReply(id: string) {
    if (!replyText.trim()) return;
    const result = await replyToReview({ id, replyText: replyText.trim() });
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setReviews((list) => list.map((review) => (review.id === id ? { ...review, reply: replyText.trim() } : review)));
    setReplyingId(null);
    setReplyText("");
  }

  async function handleFlag(id: string) {
    if (!window.confirm(t("confirmFlag"))) return;
    const result = await flagReview({ id, reason: "" });
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setFlaggedIds((prev) => new Set(prev).add(id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("summary", { count: reviewCount, rating: averageRating })}</p>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <div className="rounded-lg border border-border bg-white p-5">
        {reviews.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          pagedReviews.map((review) => (
            <div key={review.id}>
              <ReviewItem review={review} />
              {replyingId !== review.id && (
                <div className="-mt-2 mb-2 flex justify-end gap-2">
                  {!flaggedIds.has(review.id) && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleFlag(review.id)}>
                      {t("flag")}
                    </Button>
                  )}
                  {!review.reply && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => startReply(review.id)}>
                      {t("reply")}
                    </Button>
                  )}
                </div>
              )}
              {replyingId === review.id && (
                <div className="-mt-2 mb-4 flex flex-col gap-2.5">
                  <textarea
                    className={textareaClass}
                    placeholder={t("replyPlaceholder")}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2.5">
                    <Button type="button" variant="outline" size="sm" onClick={cancelReply}>
                      {tc("cancel")}
                    </Button>
                    <Button type="button" size="sm" onClick={() => postReply(review.id)}>
                      {tc("postReply")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {reviews.length > 0 && (
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            showingLabel={tc("pagination.showingCount", { shown: pagedReviews.length, total: reviews.length })}
            previousLabel={tc("pagination.previous")}
            nextLabel={tc("pagination.next")}
            pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
          />
        )}
      </div>
    </div>
  );
}
