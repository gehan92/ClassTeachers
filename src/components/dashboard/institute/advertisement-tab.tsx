"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AdSlot } from "@/components/features/ad-slot";
import { updateOwnProfileAd, upsertClassBatchAd, setClassBatchAdActive } from "@/lib/dashboard/ads-actions";

const textareaClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

export type InstituteAdBatchRow = {
  id: string;
  title: string;
  subjectName: string | null;
  hourlyRate: number | null;
  monthlyRate: number | null;
  ad: { id: string; title: string; content: string; status: "active" | "expired" | "removed" } | null;
};

export function AdvertisementTab({ initialContent, batches }: { initialContent: string; batches: InstituteAdBatchRow[] }) {
  const t = useTranslations("instituteDashboard.ads");
  const [draftText, setDraftText] = useState(initialContent);
  const [promotionText, setPromotionText] = useState(initialContent);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateOwnProfileAd({ ownerType: "class", content: draftText });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
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

      <div>
        <h3 className="mb-1 text-lg">{t("classAds.heading")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t("classAds.subtitle")}</p>

        {batches.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
            {t("classAds.noBatches")}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {batches.map((batch) => (
              <ClassBatchAdCard key={batch.id} batch={batch} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("panelTitle")}</h3>
        <div className="grid gap-1.5">
          <Label htmlFor="promotion-text">{t("promotionLabel")}</Label>
          <textarea
            id="promotion-text"
            rows={4}
            placeholder={t("promotionPlaceholder")}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className={textareaClass}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {t("save")}
          </Button>
          {saved && <span className="text-sm font-medium text-success">{t("saved")}</span>}
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
      </div>

      <AdSlot
        size="sm"
        eyebrow={t("spotlight.eyebrow")}
        text={promotionText || t("spotlight.empty")}
        ctaLabel={t("spotlight.cta")}
        ctaHref="/advertise"
      />
    </div>
  );
}

function ClassBatchAdCard({ batch }: { batch: InstituteAdBatchRow }) {
  const t = useTranslations("instituteDashboard.ads.classAds");
  const tc = useTranslations("instituteDashboard.common");

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(batch.ad?.title ?? "");
  const [content, setContent] = useState(batch.ad?.content ?? "");
  const [hourlyRate, setHourlyRate] = useState(batch.hourlyRate != null ? String(batch.hourlyRate) : "");
  const [monthlyRate, setMonthlyRate] = useState(batch.monthlyRate != null ? String(batch.monthlyRate) : "");
  const [active, setActive] = useState(batch.ad?.status === "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  async function handleSave() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await upsertClassBatchAd({
      batchId: batch.id,
      title,
      content,
      hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : undefined,
      monthlyRate: monthlyRate.trim() ? Number(monthlyRate) : undefined,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setActive(true);
    setEditing(false);
  }

  async function handleToggle(checked: boolean) {
    if (!batch.ad) return;
    setToggling(true);
    const result = await setClassBatchAdActive(batch.ad.id, checked);
    setToggling(false);
    if (!result.error) {
      setActive(checked);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-medium text-foreground">{batch.title}</h4>
          <p className="text-sm text-muted-foreground">
            {batch.subjectName ? t("batchSubject", { subject: batch.subjectName }) : t("noSubjectYet")}
          </p>
        </div>
        {batch.ad && !editing && (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${active ? "text-success" : "text-muted-foreground"}`}>
              {active ? t("active") : t("paused")}
            </span>
            <Switch checked={active} onCheckedChange={handleToggle} disabled={toggling} />
          </div>
        )}
      </div>

      {!editing && (
        <div>
          {batch.ad ? (
            <div className="mb-3">
              <p className="text-sm font-medium text-foreground">{batch.ad.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{batch.ad.content}</p>
            </div>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">{t("noAdYet")}</p>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            {batch.ad ? t("editAd") : t("createAd")}
          </Button>
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`class-ad-title-${batch.id}`}>{t("titleLabel")}</Label>
            <Input
              id={`class-ad-title-${batch.id}`}
              placeholder={t("titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`class-ad-content-${batch.id}`}>{t("contentLabel")}</Label>
            <textarea
              id={`class-ad-content-${batch.id}`}
              className={textareaClass}
              rows={4}
              placeholder={t("contentPlaceholder")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`class-ad-hourly-${batch.id}`}>{t("hourlyRateLabel")}</Label>
              <Input
                id={`class-ad-hourly-${batch.id}`}
                type="number"
                min="0"
                inputMode="decimal"
                placeholder={t("ratePlaceholderNone")}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`class-ad-monthly-${batch.id}`}>{t("monthlyRateLabel")}</Label>
              <Input
                id={`class-ad-monthly-${batch.id}`}
                type="number"
                min="0"
                inputMode="decimal"
                placeholder={t("ratePlaceholderNone")}
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(e.target.value)}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t("rateHelper")}</p>
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {t("save")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              {tc("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
