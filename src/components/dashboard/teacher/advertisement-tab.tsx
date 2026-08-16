"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AdSlot } from "@/components/features/ad-slot";
import { updateOwnProfileAd } from "@/lib/dashboard/ads-actions";

const textareaClass =
  "min-h-28 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

export function AdvertisementTab({ initialContent }: { initialContent: string }) {
  const t = useTranslations("teacherDashboard.ads");
  const tc = useTranslations("teacherDashboard.common");

  const [promotionText, setPromotionText] = useState(initialContent);
  const [savedText, setSavedText] = useState(initialContent);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateOwnProfileAd({ ownerType: "teacher", content: promotionText });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSavedText(promotionText);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("heading")}</h1>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("promotionHeading")}</h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="promotionText">{t("promotionLabel")}</Label>
          <textarea
            id="promotionText"
            className={textareaClass}
            placeholder={t("promotionPlaceholder")}
            value={promotionText}
            onChange={(e) => setPromotionText(e.target.value)}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={handleSave} disabled={saving}>
            {t("save")}
          </Button>
          {saved && <span className="text-sm font-medium text-success">{tc("saved")}</span>}
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
      </div>

      <AdSlot
        size="sm"
        eyebrow={t("adSlot.eyebrow")}
        text={savedText || t("adSlot.empty")}
        ctaLabel={t("adSlot.ctaLabel")}
        ctaHref="/advertise"
      />
    </div>
  );
}
