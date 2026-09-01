import { useTranslations } from "next-intl";
import { BadgeCheck, BookOpen, GraduationCap, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LockPill } from "./lock-pill";
import { avatarGradientClass } from "@/lib/avatar-color";
import type { Listing } from "@/types/listing";

export function ListingCard({ listing, index }: { listing: Listing; index?: number }) {
  const t = useTranslations("listing");

  return (
    <Link
      href={listing.href}
      style={index !== undefined ? { animationDelay: `${Math.min(index, 10) * 45}ms` } : undefined}
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)] transition-transform animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500 hover:-translate-y-0.5"
    >
      <div className="relative aspect-4/5 w-full overflow-hidden bg-gradient-to-br from-primary to-primary-light">
        {listing.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, not a local/optimizable asset
          <img src={listing.photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div
            className={`absolute inset-0 flex items-center justify-center ${avatarGradientClass(listing.id)}`}
          >
            {listing.kind === "class" ? (
              <BookOpen className="pointer-events-none absolute -right-4 -top-4 size-28 text-white/10" aria-hidden />
            ) : (
              <GraduationCap
                className="pointer-events-none absolute -right-4 -top-4 size-28 text-white/10"
                aria-hidden
              />
            )}
            <span className="font-display text-5xl font-bold text-white/90">{listing.avatarInitials}</span>
          </div>
        )}

        <span className="absolute left-3 top-3 rounded-[3px] border border-white/30 bg-white/15 px-2 py-0.5 font-mono text-[11px] tracking-wide text-white backdrop-blur-sm">
          {listing.gradeChip}
        </span>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3.5 pb-3 pt-10">
          <div className="flex items-center gap-1.5 font-display text-lg font-semibold text-white">
            {listing.name}
            <span title={listing.verified ? t("institutionVerified") : t("reviewed")}>
              <BadgeCheck
                className="size-4 shrink-0"
                aria-label={listing.verified ? t("institutionVerified") : t("reviewed")}
              />
            </span>
          </div>
          <div className="text-[12.5px] text-white/80">{listing.roleLabel}</div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        {listing.headline && (
          <div className="mb-1 line-clamp-2 text-[13.5px] font-semibold text-foreground">
            {listing.campusCredential?.courseCode && (
              <span className="text-muted-foreground">{listing.campusCredential.courseCode} · </span>
            )}
            {listing.headline}
          </div>
        )}
        {listing.excerpt && (
          <p className="mb-2.5 line-clamp-2 text-[12.5px] text-muted-foreground">{listing.excerpt}</p>
        )}
        <div className="mb-3 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <span className="flex items-center gap-0.5 text-cta">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="size-3"
                fill={i < Math.round(listing.rating) ? "currentColor" : "none"}
              />
            ))}
          </span>
          {listing.rating.toFixed(1)} ({t("reviewsCount", { count: listing.reviewCount })})
        </div>
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {listing.subjects.map((subject) => (
            <span
              key={subject}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-[11.5px] text-foreground/80"
            >
              {subject}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-dashed border-border pt-3.5">
          {listing.kind === "class" ? (
            <span className="rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary">
              {t("viewClass")}
            </span>
          ) : (
            <LockPill>{t("signInForContact")}</LockPill>
          )}
          <span className="font-mono text-sm font-semibold text-primary">
            {listing.price.fromPrice ? "From " : ""}
            {listing.price.currency === "LKR" ? "Rs. " : ""}
            {listing.price.amount.toLocaleString()}
            <small className="ml-0.5 text-[11px] font-normal text-muted-foreground">
              /{listing.price.interval}
            </small>
          </span>
        </div>
      </div>
    </Link>
  );
}
