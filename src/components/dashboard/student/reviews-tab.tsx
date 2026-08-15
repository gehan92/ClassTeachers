"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StarRatingInput } from "@/components/features/star-rating-input";
import { studentEnrollments, studentReviews } from "@/lib/mock-data";
import type { StudentReview } from "@/types/dashboard-student";

const TODAY_LABEL = "14 Aug 2026";

export function ReviewsTab() {
  const t = useTranslations("studentDashboard.reviews");
  const [reviews, setReviews] = useState<StudentReview[]>(studentReviews);
  const [targetId, setTargetId] = useState(studentEnrollments[0]?.id ?? "");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [ratingResetKey, setRatingResetKey] = useState(0);
  const [posted, setPosted] = useState(false);

  function handlePost() {
    const target = studentEnrollments.find((enrollment) => enrollment.id === targetId);
    if (!target || rating === 0 || comment.trim() === "") return;

    const newReview: StudentReview = {
      id: `rev-${Date.now()}`,
      targetName: target.targetName,
      rating,
      body: comment.trim(),
      date: TODAY_LABEL,
    };
    setReviews((prev) => [newReview, ...prev]);
    setComment("");
    setRating(0);
    setRatingResetKey((key) => key + 1);
    setPosted(true);
    setTimeout(() => setPosted(false), 2500);
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("leftTitle")}</h3>
        {reviews.map((review) => (
          <div key={review.id} className="border-b border-border py-4 last:border-b-0 first:pt-0">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-foreground">{review.targetName}</span>
              <span className="text-xs text-muted-foreground">{review.date}</span>
            </div>
            <div className="mb-2 flex items-center gap-0.5 text-cta">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-3.5" fill={i < review.rating ? "currentColor" : "none"} />
              ))}
            </div>
            <p className="text-sm text-foreground/85">{review.body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("composerTitle")}</h3>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5">{t("targetLabel")}</Label>
            <Select value={targetId} onValueChange={(value) => setTargetId(value ?? "")}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder={t("targetLabel")} />
              </SelectTrigger>
              <SelectContent>
                {studentEnrollments.map((enrollment) => (
                  <SelectItem key={enrollment.id} value={enrollment.id}>
                    {enrollment.targetName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5">{t("ratingLabel")}</Label>
            <StarRatingInput key={ratingResetKey} name="review-rating" value={rating} onChange={setRating} />
          </div>

          <div>
            <Label htmlFor="review-comment" className="mb-1.5">
              {t("commentLabel")}
            </Label>
            <textarea
              id="review-comment"
              rows={4}
              placeholder={t("commentPlaceholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="h-auto w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handlePost}>{t("postButton")}</Button>
            {posted && <span className="text-sm font-medium text-success">{t("posted")}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
