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
 * The circle is deliberately generic (a graduation-cap glyph, colored from
 * the ad id for visual variety) rather than a name-derived initial like
 * ListingCard's avatar — a wanted-ad never identifies who posted it, even
 * to a signed-in teacher/institute, so nothing here should look like a
 * placeholder for a real photo/name that's just waiting to be "unlocked."
 */
function RequestCard({ ad, respondHref }: { ad: PublicWantedAd; respondHref: string }) {
  const t = useTranslations("requestsPage");

  return (
    <div className="flex flex-col gap-3.5 rounded-lg border border-border bg-white p-4 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)] transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center">
      <div
        className={`flex size-12 shrink-0 items-center justify-center rounded-full text-white ${avatarGradientClass(ad.id)}`}
      >
        <GraduationCap className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-base text-primary">{ad.title}</h3>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
            {t(`lookingForOptions.${ad.lookingFor}`)}
          </span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {[ad.subject, ad.mode ? t(`modeOptions.${ad.mode}`) : null, ad.gradeLevel, ad.createdLabel]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {ad.description && <p className="mt-2 text-sm text-foreground/80">{ad.description}</p>}
      </div>

      <Link
        href={respondHref}
        className="inline-flex shrink-0 items-center justify-center rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-secondary"
      >
        {t("respondCta")}
      </Link>
    </div>
  );
}

export function WantedAdsBoard({ ads, respondHref }: { ads: PublicWantedAd[]; respondHref: string }) {
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
    <section className="py-12">
      <div className="mx-auto max-w-[1180px] px-7">
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

        <div className="space-y-3">
          {filteredAds.length > 0 ? (
            filteredAds.map((ad) => <RequestCard key={ad.id} ad={ad} respondHref={respondHref} />)
          ) : (
            <div className="rounded-lg border border-dashed border-input bg-white p-10 text-center text-muted-foreground">
              {t("empty")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
