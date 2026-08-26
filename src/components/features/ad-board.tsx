"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LockPill } from "@/components/features/lock-pill";
import { cn } from "@/lib/utils";
import type { Listing } from "@/types/listing";

const adFilters = ["all", "teacher", "class"] as const;
type AdFilter = (typeof adFilters)[number];

function AdListingRow({
  listing,
  signInLabel,
  viewClassLabel,
}: {
  listing: Listing;
  signInLabel: string;
  viewClassLabel: string;
}) {
  return (
    <Link
      href={listing.href}
      className="flex flex-col gap-3.5 rounded-lg border border-border bg-white p-4 transition-colors hover:border-primary sm:flex-row sm:items-center"
    >
      <div className="h-16 w-16 shrink-0 rounded-md bg-gradient-to-br from-primary to-primary-light" />

      <div className="min-w-0 flex-1">
        <div className="font-display text-base text-primary">{listing.headline ?? listing.name}</div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">{listing.roleLabel}</div>
        {listing.subjects.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {listing.subjects.map((subject) => (
              <span
                key={subject}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-[11.5px] text-foreground/80"
              >
                {subject}
              </span>
            ))}
          </div>
        )}
      </div>

      {listing.kind === "class" ? (
        <span className="shrink-0 rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary">
          {viewClassLabel}
        </span>
      ) : (
        <LockPill className="shrink-0">{signInLabel}</LockPill>
      )}
    </Link>
  );
}

/**
 * Was a fully mock, client-only board — a hardcoded array plus a "post an
 * ad" form that appended to local state and vanished on reload, with a
 * "vacancy" ad type that had no backing anywhere in the schema. Now shows
 * the real, already-live class ads (same data the /teachers search page
 * uses via getPublicListings) and points visitors at the real place ads
 * are actually created — the teacher/institute dashboard's Ads tab —
 * instead of duplicating a fake creation form here.
 */
export function AdBoard({ listings }: { listings: Listing[] }) {
  const t = useTranslations("advertise");
  const tl = useTranslations("listing");
  const [filter, setFilter] = useState<AdFilter>("all");

  const filteredListings = useMemo(
    () => (filter === "all" ? listings : listings.filter((listing) => listing.kind === filter)),
    [listings, filter],
  );

  return (
    <>
      <section className="py-15">
        <div className="mx-auto max-w-[1180px] px-7">
          <div className="mb-7">
            <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
              {t("currentAds.eyebrow")}
            </div>
            <h2 className="text-[28px]">{t("currentAds.title")}</h2>
          </div>

          <div role="radiogroup" aria-label={t("currentAds.title")} className="mb-4 flex flex-wrap gap-1.5">
            {adFilters.map((value) => (
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
                {t(`currentAds.filter${value === "all" ? "All" : value === "teacher" ? "Teachers" : "Institutes"}`)}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredListings.length > 0 ? (
              filteredListings.map((listing) => (
                <AdListingRow
                  key={listing.id}
                  listing={listing}
                  signInLabel={tl("signInForContact")}
                  viewClassLabel={tl("viewClass")}
                />
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-input bg-white p-8 text-center text-muted-foreground">
                {t("currentAds.empty")}
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="postAd" className="border-t border-border bg-white py-15">
        <div className="mx-auto max-w-160 px-7 text-center">
          <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
            {t("form.eyebrow")}
          </div>
          <h2 className="mb-2 text-[28px]">{t("form.title")}</h2>
          <p className="mx-auto mb-6.5 max-w-[46ch] text-muted-foreground">{t("form.subtitle")}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={{ pathname: "/signup", query: { role: "teacher" } }}
              className="inline-flex items-center justify-center rounded-sm bg-primary px-5 py-2.75 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-px hover:bg-primary-light"
            >
              {t("form.ctaTeacher")}
            </Link>
            <Link
              href={{ pathname: "/signup", query: { role: "class" } }}
              className="inline-flex items-center justify-center rounded-sm border border-input px-5 py-2.75 text-sm font-semibold text-primary transition-all hover:-translate-y-px hover:bg-white"
            >
              {t("form.ctaInstitute")}
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("form.alreadyHaveAccount")}{" "}
            <Link href="/login" className="font-semibold text-primary">
              {t("form.loginLink")}
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
