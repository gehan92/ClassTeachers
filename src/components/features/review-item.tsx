import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import type { ReviewDisplay } from "@/types/review";

export function ReviewItem({ review }: { review: ReviewDisplay }) {
  const t = useTranslations("reviews");

  return (
    <div className="border-b border-border py-4.5 last:border-b-0">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{review.author}</span>
          {review.tag && (
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
              {review.tag}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{review.date}</span>
      </div>
      <div className="mb-2 flex items-center gap-0.5 text-cta">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="size-3.5" fill={i < review.rating ? "currentColor" : "none"} />
        ))}
      </div>
      <p className="text-sm text-foreground/85">{review.body}</p>
      {review.reply && (
        <div className="mt-3 border-l-2 border-primary/30 pl-3.5 text-sm text-muted-foreground">
          <span className="font-semibold text-primary">{t("replyPrefix")} </span>
          {review.reply}
        </div>
      )}
    </div>
  );
}
