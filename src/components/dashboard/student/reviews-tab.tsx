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
import { postReview } from "@/lib/dashboard/reviews-actions";

export type ReviewTarget = { ownerType: "teacher" | "class"; ownerId: string; name: string };
export type StudentPostedReview = {
  id: string;
  ownerType: "teacher" | "class";
  ownerId: string;
  targetName: string;
  rating: number;
  body: string;
  date: string;
};

export function ReviewsTab({
  targets,
  initialReviews,
}: {
  targets: ReviewTarget[];
  initialReviews: StudentPostedReview[];
}) {
  const t = useTranslations("studentDashboard.reviews");
  const [reviews, setReviews] = useState<StudentPostedReview[]>(initialReviews);
  const initialTargetKey = targets[0] ? `${targets[0].ownerType}:${targets[0].ownerId}` : "";
  const initialExistingReview = initialReviews.find((r) => `${r.ownerType}:${r.ownerId}` === initialTargetKey);
  const [targetKey, setTargetKey] = useState(initialTargetKey);
  const [rating, setRating] = useState(initialExistingReview?.rating ?? 0);
  const [comment, setComment] = useState(initialExistingReview?.body ?? "");
  const [ratingResetKey, setRatingResetKey] = useState(0);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Switching targets loads that target's existing review (if any) into the
  // form instead of leaving stale values from the previous target — posting
  // is an upsert server-side, so without this a student picking a
  // teacher/class they'd already reviewed would silently overwrite it
  // starting from a blank-looking form. ratingResetKey forces
  // StarRatingInput to remount with the new value, since it only reads its
  // `value` prop once on mount (see its own initial-state comment).
  function handleTargetChange(value: string | null) {
    const key = value ?? "";
    setTargetKey(key);
    const existing = reviews.find((r) => `${r.ownerType}:${r.ownerId}` === key);
    setRating(existing?.rating ?? 0);
    setComment(existing?.body ?? "");
    setRatingResetKey((k) => k + 1);
    setError(null);
  }

  async function handlePost() {
    const target = targets.find((t) => `${t.ownerType}:${t.ownerId}` === targetKey);
    if (!target || rating === 0 || comment.trim() === "") return;

    setSaving(true);
    setError(null);
    const result = await postReview({
      targetType: target.ownerType,
      targetId: target.ownerId,
      rating,
      comment: comment.trim(),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    setReviews((prev) => {
      const existing = prev.find((r) => r.ownerType === target.ownerType && r.ownerId === target.ownerId);
      const updated: StudentPostedReview = {
        id: existing?.id ?? `local-${target.ownerType}-${target.ownerId}`,
        ownerType: target.ownerType,
        ownerId: target.ownerId,
        targetName: target.name,
        rating,
        body: comment.trim(),
        date: existing?.date ?? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date()),
      };
      if (existing) {
        return prev.map((r) => (r.id === existing.id ? updated : r));
      }
      return [updated, ...prev];
    });
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

      {reviews.length > 0 && (
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
      )}

      {targets.length > 0 ? (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-4 text-lg">{t("composerTitle")}</h3>
          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">{t("targetLabel")}</Label>
              <Select value={targetKey} onValueChange={handleTargetChange}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder={t("targetLabel")} />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((target) => (
                    <SelectItem key={`${target.ownerType}:${target.ownerId}`} value={`${target.ownerType}:${target.ownerId}`}>
                      {target.name}
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
              <Button onClick={handlePost} disabled={saving || rating === 0 || comment.trim() === ""}>
                {t("postButton")}
              </Button>
              {posted && <span className="text-sm font-medium text-success">{t("posted")}</span>}
              {error && <span className="text-sm font-medium text-destructive">{error}</span>}
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
          {t("noTargets")}
        </p>
      )}
    </div>
  );
}
