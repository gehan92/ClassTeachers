"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LockPill } from "@/components/features/lock-pill";

type StandaloneAd = {
  id: string;
  title: string;
  posterType: string;
  location: string;
  expiresLabel: string;
  subjects: string[];
};

const initialAds: StandaloneAd[] = [
  {
    id: "ad-1",
    title: "A/L Combined Maths — Weekend Batch",
    posterType: "Individual Teacher",
    location: "Matara",
    expiresLabel: "Expires in 5 days",
    subjects: ["Combined Maths", "A/L"],
  },
  {
    id: "ad-2",
    title: "O/L Science Group Classes",
    posterType: "Horizon Learning Institute",
    location: "Colombo · Online",
    expiresLabel: "Expires in 11 days",
    subjects: ["Science", "O/L"],
  },
  {
    id: "ad-3",
    title: "Primary English & Reading",
    posterType: "Individual Teacher",
    location: "Galle",
    expiresLabel: "Expires in 2 days",
    subjects: ["English", "Grade 1–5"],
  },
];

function AdListingRow({ ad, signInLabel }: { ad: StandaloneAd; signInLabel: string }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-lg border border-border bg-white p-4 sm:flex-row sm:items-center">
      <div className="h-16 w-16 shrink-0 rounded-md bg-gradient-to-br from-primary to-primary-light" />

      <div className="min-w-0 flex-1">
        <div className="font-display text-base text-primary">{ad.title}</div>
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
        title,
        posterType: t("form.newAdPosterType"),
        location: location || t("form.newAdLocationFallback"),
        expiresLabel: t("form.newAdExpiresLabel"),
        subjects: subject ? [subject] : [],
      },
      ...prev,
    ]);
    e.currentTarget.reset();
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

          <div className="space-y-3">
            {ads.map((ad) => (
              <AdListingRow key={ad.id} ad={ad} signInLabel={t("currentAds.signInToContact")} />
            ))}
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
                <Label htmlFor="adTitle">{t("form.adTitleLabel")}</Label>
                <Input id="adTitle" name="adTitle" placeholder={t("form.adTitlePlaceholder")} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="subject">{t("form.subjectLabel")}</Label>
                  <Input id="subject" name="subject" placeholder={t("form.subjectPlaceholder")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="location">{t("form.locationLabel")}</Label>
                  <Input id="location" name="location" placeholder={t("form.locationPlaceholder")} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="details">{t("form.detailsLabel")}</Label>
                <textarea
                  id="details"
                  name="details"
                  rows={4}
                  placeholder={t("form.detailsPlaceholder")}
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
