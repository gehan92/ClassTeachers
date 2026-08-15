"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AdSlot } from "@/components/features/ad-slot";

const DEFAULT_PROMOTION_TEXT =
  "Enrollment for the O/L 2027 group is now open across all subjects — early-bird pricing until end of month.";

export function AdvertisementTab() {
  const t = useTranslations("instituteDashboard.ads");
  const [draftText, setDraftText] = useState(DEFAULT_PROMOTION_TEXT);
  const [promotionText, setPromotionText] = useState(DEFAULT_PROMOTION_TEXT);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setPromotionText(draftText);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("panelTitle")}</h3>
        <div className="grid gap-1.5">
          <Label htmlFor="promotion-text">{t("promotionLabel")}</Label>
          <textarea
            id="promotion-text"
            rows={4}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSave}>{t("save")}</Button>
          {saved && <span className="text-sm font-medium text-success">{t("saved")}</span>}
        </div>
      </div>

      <AdSlot
        size="sm"
        eyebrow={t("spotlight.eyebrow")}
        text={promotionText}
        ctaLabel={t("spotlight.cta")}
        ctaHref="/advertise"
      />
    </div>
  );
}
