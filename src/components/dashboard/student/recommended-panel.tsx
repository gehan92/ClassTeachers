import { useTranslations } from "next-intl";
import { MapPin, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";

export type RecommendedListingRow = {
  id: string;
  kind: "teacher" | "class";
  name: string;
  subject: string | null;
  gradeBand: string | null;
  location: string | null;
  online: boolean;
  rating: number;
  reviewCount: number;
  photoUrl: string | null;
  priceLabel: string | null;
  /** Whether this listing matched one of the student's own profile subjects
   * — decides the panel's heading/subtitle, never shown per-card. */
  matched: boolean;
  href: string;
};

/**
 * Home's "Recommended for you" panel (spec doc) — real active ads from the
 * same source as the public /teachers search, ranked against the student's
 * own profile subjects server-side (student/page.tsx). Only claims to be
 * "personalized" when a real subject match exists; otherwise reads as a
 * plain "popular right now" list rather than pretending a match.
 */
export function RecommendedPanel({ listings, personalized }: { listings: RecommendedListingRow[]; personalized: boolean }) {
  const t = useTranslations("studentDashboard.overview.recommended");

  if (listings.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-1 text-lg">{t("heading")}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{personalized ? t("subtitlePersonalized") : t("subtitleGeneral")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={listing.href}
            className="flex flex-col gap-2.5 rounded-lg border border-border bg-white p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-2.5">
              {listing.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.photoUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                  {listing.kind === "class" ? "🏫" : listing.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{listing.name}</p>
                {listing.subject && <p className="truncate text-xs text-muted-foreground">{listing.subject}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {listing.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="size-3 fill-current text-amber-500" />
                  {listing.rating.toFixed(1)}
                  {listing.reviewCount > 0 && ` (${listing.reviewCount})`}
                </span>
              )}
              {listing.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {listing.location}
                </span>
              )}
            </div>
            {listing.priceLabel && <p className="text-sm font-medium text-foreground">{listing.priceLabel}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
