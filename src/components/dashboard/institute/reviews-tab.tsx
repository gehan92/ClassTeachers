import { useTranslations } from "next-intl";
import { ReviewItem } from "@/components/features/review-item";
import { instituteReviews } from "@/lib/mock-data/dashboard-institute";

export function ReviewsTab() {
  const t = useTranslations("instituteDashboard.reviews");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("summary", { count: 211, rating: "4.7" })}</p>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        {instituteReviews.map((review) => (
          <ReviewItem key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}
