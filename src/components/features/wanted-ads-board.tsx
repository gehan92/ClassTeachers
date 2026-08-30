"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { GraduationCap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { avatarGradientClass } from "@/lib/avatar-color";
import { cn } from "@/lib/utils";

export type PublicWantedAd = {
  id: string;
  lookingFor: "teacher" | "institute";
  subject: string | null;
  mode: "online" | "physical" | "both" | null;
  gradeLevel: string | null;
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
 * The avatar stays generic (a graduation-cap glyph, colored from the ad id)
 * rather than a name-derived initial like ListingCard's — a wanted-ad never
 * identifies who posted it, even to a signed-in teacher/institute, so
 * nothing here should look like a placeholder for a real photo that's just
 * waiting to be "unlocked." Links to the ad's own detail page (/requests/[id],
 * added alongside this) rather than straight to a login/respond href, so a
 * visitor can actually read the full request before deciding to respond.
 */
function RequestCard({ ad, index }: { ad: PublicWantedAd; index?: number }) {
  const t = useTranslations("requestsPage");

  return (
    <Link
      href={`/requests/${ad.id}`}
      style={index !== undefined ? { animationDelay: `${Math.min(index, 10) * 45}ms` } : undefined}
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)] transition-transform animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500 hover:-translate-y-0.5"
    >
      <div className="relative flex h-33 items-end bg-gradient-to-br from-primary to-primary-light p-3">
        <span className="rounded-[3px] border border-white/30 bg-white/15 px-2 py-0.5 font-mono text-[11px] tracking-wide text-white">
          {t(`lookingForOptions.${ad.lookingFor}`)}
        </span>
        <div
          className={`absolute -bottom-5.5 right-3.5 flex size-14 items-center justify-center rounded-full border-4 border-white text-white shadow-sm ${avatarGradientClass(ad.id)}`}
        >
          <GraduationCap className="size-5.5" />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-7.5">
        <div className="mb-1 line-clamp-2 font-display text-[17px] tracking-wide text-primary">{ad.title}</div>
        <div className="mb-2.5 text-[12.5px] text-muted-foreground">
          {[ad.subject, ad.mode ? t(`modeOptions.${ad.mode}`) : null, ad.gradeLevel, ad.createdLabel]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {ad.description && <p className="mb-3.5 line-clamp-2 text-[12.5px] text-muted-foreground">{ad.description}</p>}

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
        (ad.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [ads, query, filter]);

  const hasFilters = query.length > 0 || filter !== "all";

  function clearFilters() {
    setQuery("");
    setFilter("all");
  }

  return (
    <>
      {/* Same boxed-panel chrome as TeachersSearch's filter box — this
       * page is another searchable listing, so it should look like one. */}
      <div className="mb-7 rounded-2xl border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
                onClick={() => setFilter(value)}
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAds.map((ad, i) => (
            <RequestCard key={ad.id} ad={ad} index={i} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-input bg-white p-10 text-center text-muted-foreground">
          {t("empty")}
        </div>
      )}
    </>
  );
}
