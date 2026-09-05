"use client";

import { createElement, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { usePagination } from "@/lib/hooks/use-pagination";
import { avatarGradientClass } from "@/lib/avatar-color";
import { getSubjectIcon } from "@/lib/subject-icon";
import { cn } from "@/lib/utils";
import { hasRichText, stripRichText, RICH_TEXT_DISPLAY_CLASS } from "@/lib/rich-text";

export type PublicWantedAd = {
  id: string;
  lookingFor: "teacher" | "institute";
  subject: string | null;
  mode: "online" | "physical" | "both" | null;
  gradeLevel: string | null;
  medium: "english" | "sinhala" | "tamil" | "other";
  classType: "new" | "revision";
  title: string;
  description: string | null;
  createdLabel: string;
};

const lookingForFilters = ["all", "teacher", "institute"] as const;
type LookingForFilter = (typeof lookingForFilters)[number];

/**
 * Deliberately mirrors ListingCard's shape (same banner/avatar/footer-pill
 * structure as /teachers) so the two searchable pages feel like one design
 * system, not two — Gehan flagged the mismatch after comparing screenshots.
 * The avatar stays generic (a subject-category glyph, colored from the ad
 * id — never a name-derived initial like ListingCard's) — a wanted-ad never
 * identifies who posted it, even to a signed-in teacher/institute, so
 * nothing here should look like a placeholder for a real photo that's just
 * waiting to be "unlocked." Varying the icon by subject (getSubjectIcon)
 * mirrors how demand-side "wanted" posts on other platforms (TaskRabbit,
 * Urban Company) use a category icon rather than a photo of the requester —
 * professional without compromising that anonymity. Links to the ad's own
 * detail page (/requests/[id], added alongside this) rather than straight
 * to a login/respond href, so a visitor can actually read the full request
 * before deciding to respond.
 */
function RequestCard({ ad, index }: { ad: PublicWantedAd; index?: number }) {
  const t = useTranslations("requestsPage");

  return (
    <Link
      href={`/requests/${ad.id}`}
      style={index !== undefined ? { animationDelay: `${Math.min(index, 10) * 45}ms` } : undefined}
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)] transition-transform animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500 hover:-translate-y-0.5"
    >
      <div className="relative flex h-33 items-start bg-gradient-to-br from-primary to-primary-light p-3">
        {/* pr-16 reserves the avatar's bottom-right footprint so a second
         * badge wraps to its own line instead of sliding underneath it —
         * flex-wrap alone isn't enough since the avatar is absolutely
         * positioned and doesn't participate in this row's layout. */}
        <div className="flex flex-wrap gap-1.5 pr-16">
          <span className="rounded-[3px] border border-white/30 bg-white/15 px-2 py-0.5 font-mono text-[11px] tracking-wide text-white">
            {t(`lookingForOptions.${ad.lookingFor}`)}
          </span>
          {ad.classType === "revision" && (
            <span className="rounded-[3px] border border-white/30 bg-white/15 px-2 py-0.5 font-mono text-[11px] tracking-wide text-white">
              {t("classTypeOptions.revision")}
            </span>
          )}
        </div>
        <div
          className={`absolute -bottom-5.5 right-3.5 flex size-14 items-center justify-center rounded-full border-4 border-white text-white shadow-sm ${avatarGradientClass(ad.id)}`}
        >
          {createElement(getSubjectIcon(ad.subject), { className: "size-5.5" })}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-7.5">
        <div className="mb-1 line-clamp-2 font-display text-[17px] tracking-wide text-primary">{ad.title}</div>
        <div className="mb-2.5 text-[12.5px] text-muted-foreground">
          {[ad.subject, ad.mode ? t(`modeOptions.${ad.mode}`) : null, t(`mediumOptions.${ad.medium}`), ad.gradeLevel, ad.createdLabel]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {hasRichText(ad.description) && (
          <div
            className={`mb-3.5 line-clamp-2 text-[12.5px] text-muted-foreground ${RICH_TEXT_DISPLAY_CLASS}`}
            dangerouslySetInnerHTML={{ __html: ad.description ?? "" }}
          />
        )}

        <div className="mt-auto flex items-center border-t border-dashed border-border pt-3.5">
          <span className="rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary">
            {t("respondCta")}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function WantedAdsBoard({ ads }: { ads: PublicWantedAd[] }) {
  const t = useTranslations("requestsPage");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LookingForFilter>("all");

  const filteredAds = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ads.filter((ad) => {
      if (filter !== "all" && ad.lookingFor !== filter) return false;
      if (!q) return true;
      return (
        ad.title.toLowerCase().includes(q) ||
        (ad.subject ?? "").toLowerCase().includes(q) ||
        stripRichText(ad.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [ads, query, filter]);

  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(filteredAds.length);
  const pagedAds = filteredAds.slice(offset, offset + pageSize);

  const hasFilters = query.length > 0 || filter !== "all";

  function clearFilters() {
    setQuery("");
    setFilter("all");
    setPage(1);
  }

  return (
    <>
      {/* Same boxed-panel chrome as TeachersSearch's filter box — this
       * page is another searchable listing, so it should look like one. */}
      <div className="mb-7 rounded-2xl border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t("searchPlaceholder")}
            className="bg-white sm:max-w-80"
          />
          <div role="radiogroup" aria-label={t("filterLabel")} className="flex flex-wrap gap-1.5">
            {lookingForFilters.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filter === value}
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  filter === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-white text-foreground/80 hover:bg-secondary",
                )}
              >
                {t(`filterOptions.${value}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("resultsCount", { count: filteredAds.length })}</p>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-sm font-semibold text-primary">
            {t("clearFilters")}
          </button>
        )}
      </div>

      {filteredAds.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pagedAds.map((ad, i) => (
              <RequestCard key={ad.id} ad={ad} index={i} />
            ))}
          </div>
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            showingLabel={t("pagination.showingCount", { shown: pagedAds.length, total: filteredAds.length })}
            previousLabel={t("pagination.previous")}
            nextLabel={t("pagination.next")}
            pageInfoLabel={t("pagination.pageInfo", { page: currentPage, totalPages })}
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-input bg-white p-10 text-center text-muted-foreground">
          {t("empty")}
        </div>
      )}

      <ClosingCtaBanner />
    </>
  );
}

/**
 * This board's audience is genuinely two-sided (students checking existing
 * requests before posting their own, teachers/institutes browsing to
 * respond) and always shown — even with a handful of ads the page shouldn't
 * dead-end after the grid/pagination. Two static CTAs rather than one
 * role-detected CTA: this component has no session data today (the page
 * doesn't fetch a user), and adding that just to pick one CTA would be more
 * machinery than a filler banner warrants — the wrong CTA for a visitor's
 * role is just a no-op click, not a broken state.
 */
function ClosingCtaBanner() {
  const t = useTranslations("requestsPage.closingCta");

  return (
    <div className="mt-8 grid grid-cols-1 divide-y divide-border rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      <div className="flex flex-col items-start gap-2 p-6">
        <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
          {t("studentEyebrow")}
        </div>
        <p className="text-sm text-muted-foreground">{t("studentText")}</p>
        <Link
          href="/student?tab=wantedAds"
          className="mt-1 inline-flex items-center justify-center rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-px hover:bg-primary-light"
        >
          {t("studentCta")}
        </Link>
      </div>
      <div className="flex flex-col items-start gap-2 p-6">
        <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
          {t("teacherEyebrow")}
        </div>
        <p className="text-sm text-muted-foreground">{t("teacherText")}</p>
        <Link
          href="/advertise"
          className="mt-1 inline-flex items-center justify-center rounded-sm border border-input px-4 py-2 text-sm font-semibold text-primary transition-all hover:-translate-y-px hover:bg-secondary"
        >
          {t("teacherCta")}
        </Link>
      </div>
    </div>
  );
}
