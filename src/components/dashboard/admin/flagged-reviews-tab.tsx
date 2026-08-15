"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { flaggedReviews } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function FlaggedReviewsTab() {
  const t = useTranslations("adminDashboard.flagged");
  const [reviews, setReviews] = useState(flaggedReviews);

  function resolveFlag(id: string) {
    setReviews((prev) => prev.filter((review) => review.id !== id));
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

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
                <Button size="sm" variant="ghost" onClick={() => resolveFlag(review.id)}>
                  {t("actions.keep")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-lock hover:text-lock"
                  onClick={() => resolveFlag(review.id)}
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
