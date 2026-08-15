"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ReviewItem } from "@/components/features/review-item";
import { teacherReviews } from "@/lib/mock-data";
import type { ReviewDisplay } from "@/types/review";

const textareaClass =
  "min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export function ReviewsTab() {
  const t = useTranslations("teacherDashboard.reviews");
  const tc = useTranslations("teacherDashboard.common");

  const [reviews, setReviews] = useState<ReviewDisplay[]>(teacherReviews);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  function startReply(id: string) {
    setReplyingId(id);
    setReplyText("");
  }

  function cancelReply() {
    setReplyingId(null);
    setReplyText("");
  }

  function postReply(id: string) {
    if (!replyText.trim()) return;
    setReviews((list) => list.map((review) => (review.id === id ? { ...review, reply: replyText.trim() } : review)));
    setReplyingId(null);
    setReplyText("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("summary", { count: 128, rating: "4.9" })}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        {reviews.map((review) => (
          <div key={review.id}>
            <ReviewItem review={review} />
            {!review.reply && replyingId !== review.id && (
              <div className="-mt-2 mb-2 flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => startReply(review.id)}>
                  {t("reply")}
                </Button>
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
        ))}
      </div>
    </div>
  );
}
