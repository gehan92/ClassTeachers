import { useTranslations } from "next-intl";
import { ArrowRight, BadgeCheck, BookOpen, GraduationCap, Sparkles, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { avatarGradientClass } from "@/lib/avatar-color";
import { RICH_TEXT_DISPLAY_CLASS } from "@/lib/rich-text";
import type { Listing } from "@/types/listing";

export function ListingCard({ listing, index }: { listing: Listing; index?: number }) {
  const t = useTranslations("listing");
  // Reuses the requests board's own vocabulary for these two chips (same
  // words: "Revision class", "Sinhala medium"...) instead of duplicating
  // them under a second translation key.
  const tr = useTranslations("requestsPage");
  const hasReviews = listing.reviewCount > 0;

  return (
    <Link
      href={listing.href}
      style={index !== undefined ? { animationDelay: `${Math.min(index, 10) * 45}ms` } : undefined}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.06),0_10px_28px_-16px_rgba(14,33,29,0.22)] transition-[transform,box-shadow] duration-300 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(14,33,29,0.06),0_18px_40px_-18px_rgba(14,33,29,0.32)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="relative aspect-4/3 w-full overflow-hidden bg-gradient-to-br from-primary to-primary-light">
        {listing.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded Supabase Storage photo; lazy so off-screen cards cost nothing
          <img
            src={listing.photoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className={`absolute inset-0 flex items-center justify-center ${avatarGradientClass(listing.ownerId)}`}>
            {listing.kind === "class" ? (
              <BookOpen className="pointer-events-none absolute -top-4 -right-4 size-28 text-white/10" aria-hidden />
            ) : (
              <GraduationCap className="pointer-events-none absolute -top-4 -right-4 size-28 text-white/10" aria-hidden />
            )}
            <span className="font-display text-5xl font-bold text-white/90">{listing.avatarInitials}</span>
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="rounded-md border border-white/25 bg-black/30 px-2 py-0.5 font-mono text-[11px] tracking-wide text-white backdrop-blur-sm">
            {listing.gradeChip}
          </span>
          {listing.classType === "revision" && (
            <span className="rounded-md border border-white/25 bg-black/30 px-2 py-0.5 font-mono text-[11px] tracking-wide text-white backdrop-blur-sm">
              {tr("classTypeOptions.revision")}
            </span>
          )}
        </div>
        {listing.verified && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[11px] font-semibold text-success-foreground shadow-sm">
            <BadgeCheck className="size-3.5" aria-hidden />
            {t("verified")}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pt-12 pb-3">
          <div className="truncate font-display text-lg font-semibold text-white">{listing.name}</div>
          <div className="truncate text-[12.5px] text-white/80">{listing.roleLabel}</div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
        {listing.headline && (
          <div className="mb-1 line-clamp-2 text-[14px] leading-snug font-semibold text-primary">
            {listing.campusCredential?.courseCode && (
              <span className="text-muted-foreground">{listing.campusCredential.courseCode} · </span>
            )}
            {listing.headline}
          </div>
        )}
        {listing.excerpt &&
          (listing.excerptIsRichText ? (
            <div
              className={`mb-2.5 line-clamp-2 text-[12.5px] text-muted-foreground ${RICH_TEXT_DISPLAY_CLASS}`}
              dangerouslySetInnerHTML={{ __html: listing.excerpt }}
            />
          ) : (
            <p className="mb-2.5 line-clamp-2 text-[12.5px] text-muted-foreground">{listing.excerpt}</p>
          ))}

        <div className="mb-3 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          {hasReviews ? (
            <>
              <Star className="size-3.5 text-cta" fill="currentColor" aria-hidden />
              <span className="font-semibold text-foreground">{listing.rating.toFixed(1)}</span>
              <span>· {t("reviewsCount", { count: listing.reviewCount })}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
              <Sparkles className="size-3" aria-hidden />
              {t("newListing")}
            </span>
          )}
        </div>

        {(listing.subjects.length > 0 || listing.medium) && (
          <div className="mb-3.5 flex flex-wrap gap-1.5">
            {listing.subjects.map((subject) => (
              <span
                key={subject}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-[11.5px] text-foreground/80"
              >
                {subject}
              </span>
            ))}
            {listing.medium && (
              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11.5px] text-foreground/80">
                {tr(`mediumOptions.${listing.medium}`)}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5 border-t border-dashed border-border pt-3.5">
          {listing.price ? (
            <span className="font-mono text-[15px] font-semibold text-primary">
              {listing.price.fromPrice && <span className="mr-1 font-sans text-xs font-normal text-muted-foreground">{t("from")}</span>}
              {listing.price.currency === "LKR" ? "Rs. " : ""}
              {listing.price.amount.toLocaleString()}
              {listing.price.maxAmount && `–${listing.price.maxAmount.toLocaleString()}`}
              <small className="ml-0.5 text-[11px] font-normal text-muted-foreground">
                {listing.price.interval === "hr" ? t("perHour") : t("perMonth")}
              </small>
            </span>
          ) : (
            <span className="text-[12.5px] font-medium text-muted-foreground">{t("contactForPrice")}</span>
          )}
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-deep transition-transform group-hover:translate-x-0.5">
            {listing.kind === "class" ? t("viewClass") : t("viewDetails")}
            <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
