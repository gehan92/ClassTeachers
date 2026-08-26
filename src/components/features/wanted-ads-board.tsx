"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
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

function RequestCard({ ad, respondHref }: { ad: PublicWantedAd; respondHref: string }) {
  const t = useTranslations("requestsPage");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
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

  return (
    <section className="py-12">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="sm:max-w-80"
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

        <div className="space-y-3">
          {filteredAds.length > 0 ? (
            filteredAds.map((ad) => <RequestCard key={ad.id} ad={ad} respondHref={respondHref} />)
          ) : (
            <div className="rounded-lg border border-dashed border-input bg-white p-8 text-center text-muted-foreground">
              {t("empty")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
