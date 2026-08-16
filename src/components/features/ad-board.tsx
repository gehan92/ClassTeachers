"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LockPill } from "@/components/features/lock-pill";
import { cn } from "@/lib/utils";

type AdType = "class" | "vacancy";

type StandaloneAd = {
  id: string;
  type: AdType;
  title: string;
  posterType: string;
  location: string;
  expiresLabel: string;
  subjects: string[];
};

const initialAds: StandaloneAd[] = [
  {
    id: "ad-1",
    type: "class",
    title: "A/L Combined Maths — Weekend Batch",
    posterType: "Individual Teacher",
    location: "Matara",
    expiresLabel: "Expires in 5 days",
    subjects: ["Combined Maths", "A/L"],
  },
  {
    id: "ad-2",
    type: "class",
    title: "O/L Science Group Classes",
    posterType: "Horizon Learning Institute",
    location: "Colombo · Online",
    expiresLabel: "Expires in 11 days",
    subjects: ["Science", "O/L"],
  },
  {
    id: "ad-3",
    type: "vacancy",
    title: "Hiring an A/L Chemistry teacher",
    posterType: "Horizon Learning Institute",
    location: "Galle",
    expiresLabel: "Expires in 9 days",
    subjects: ["Chemistry", "A/L"],
  },
];

const adFilters = ["all", "class", "vacancy"] as const;
type AdFilter = (typeof adFilters)[number];

function AdListingRow({
  ad,
  signInLabel,
  vacancyBadgeLabel,
}: {
  ad: StandaloneAd;
  signInLabel: string;
  vacancyBadgeLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-lg border border-border bg-white p-4 sm:flex-row sm:items-center">
      <div className="h-16 w-16 shrink-0 rounded-md bg-gradient-to-br from-primary to-primary-light" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-display text-base text-primary">{ad.title}</div>
          {ad.type === "vacancy" && (
            <span className="rounded-full bg-accent-deep px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-white">
              {vacancyBadgeLabel}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">
          {ad.posterType} · {ad.location} · {ad.expiresLabel}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ad.subjects.map((subject) => (
            <span
              key={subject}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-[11.5px] text-foreground/80"
            >
              {subject}
            </span>
          ))}
        </div>
      </div>

      <LockPill className="shrink-0">{signInLabel}</LockPill>
    </div>
  );
}

export function AdBoard() {
  const t = useTranslations("advertise");
  const [ads, setAds] = useState<StandaloneAd[]>(initialAds);
  const [posted, setPosted] = useState(false);
  const [filter, setFilter] = useState<AdFilter>("all");
  const [adType, setAdType] = useState<AdType>("class");

  const filteredAds = useMemo(
    () => (filter === "all" ? ads : ads.filter((ad) => ad.type === filter)),
    [ads, filter],
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("adTitle") ?? "").trim();
    const subject = String(form.get("subject") ?? "").trim();
    const location = String(form.get("location") ?? "").trim();
    if (!title) return;

    setAds((prev) => [
      {
        id: `ad-${Date.now()}`,
        type: adType,
        title,
        posterType: t("form.newAdPosterType"),
        location: location || t("form.newAdLocationFallback"),
        expiresLabel: t("form.newAdExpiresLabel"),
        subjects: subject ? [subject] : [],
      },
      ...prev,
    ]);
    e.currentTarget.reset();
    setAdType("class");
    setPosted(true);
    setTimeout(() => setPosted(false), 3000);
  }

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

          <div
            role="radiogroup"
            aria-label={t("currentAds.title")}
            className="mb-4 flex flex-wrap gap-1.5"
          >
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
                {t(`currentAds.filter${value === "all" ? "All" : value === "class" ? "ClassAds" : "Vacancies"}`)}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredAds.length > 0 ? (
              filteredAds.map((ad) => (
                <AdListingRow
                  key={ad.id}
                  ad={ad}
                  signInLabel={t("currentAds.signInToContact")}
                  vacancyBadgeLabel={t("form.vacancyBadge")}
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
        <div className="mx-auto max-w-160 px-7">
          <div className="mb-7 text-center">
            <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
              {t("form.eyebrow")}
            </div>
            <h2 className="text-[28px]">{t("form.title")}</h2>
            <p className="text-muted-foreground">{t("form.subtitle")}</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]"
          >
            <div className="mb-4 grid grid-cols-1 gap-4">
              <div className="grid gap-1.5">
                <Label>{t("form.typeLabel")}</Label>
                <div role="radiogroup" className="flex overflow-hidden rounded-md border border-input bg-white">
                  {(["class", "vacancy"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={adType === value}
                      onClick={() => setAdType(value)}
                      className={cn(
                        "flex-1 border-r border-border px-3 py-2 text-center text-sm font-medium text-foreground/80 transition-colors last:border-r-0 hover:bg-secondary",
                        adType === value && "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {t(value === "class" ? "form.typeClassAd" : "form.typeVacancy")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="adTitle">{t(adType === "vacancy" ? "form.vacancyTitleLabel" : "form.adTitleLabel")}</Label>
                <Input
                  id="adTitle"
                  name="adTitle"
                  placeholder={t(adType === "vacancy" ? "form.vacancyTitlePlaceholder" : "form.adTitlePlaceholder")}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="subject">{t("form.subjectLabel")}</Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder={t(adType === "vacancy" ? "form.vacancySubjectPlaceholder" : "form.subjectPlaceholder")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="location">{t("form.locationLabel")}</Label>
                  <Input id="location" name="location" placeholder={t("form.locationPlaceholder")} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="details">{t(adType === "vacancy" ? "form.vacancyDetailsLabel" : "form.detailsLabel")}</Label>
                <textarea
                  id="details"
                  name="details"
                  rows={4}
                  placeholder={t(adType === "vacancy" ? "form.vacancyDetailsPlaceholder" : "form.detailsPlaceholder")}
                  className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                />
              </div>

              <div className="grid gap-1.5 sm:max-w-70">
                <Label htmlFor="phone">{t("form.phoneLabel")}</Label>
                <Input id="phone" name="phone" type="tel" placeholder={t("form.phonePlaceholder")} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                className="h-auto rounded-sm bg-primary px-5 py-2.75 text-sm text-primary-foreground hover:bg-primary-light"
              >
                {t("form.submit")}
              </Button>
              {posted && <span className="text-sm font-medium text-success">{t("form.posted")}</span>}
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
