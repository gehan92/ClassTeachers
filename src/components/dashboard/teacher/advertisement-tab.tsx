"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AdSlot } from "@/components/features/ad-slot";
import { updateOwnProfileAd, upsertBatchAd, setBatchAdActive } from "@/lib/dashboard/ads-actions";

const textareaClass =
  "min-h-28 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

export type TeacherAdBatchRow = {
  id: string;
  title: string;
  subjectId: string | null;
  subjectName: string | null;
  ad: { id: string; title: string; content: string; status: "active" | "expired" | "removed" } | null;
};

export function AdvertisementTab({
  initialContent,
  batches,
  subjectOptions,
}: {
  initialContent: string;
  batches: TeacherAdBatchRow[];
  subjectOptions: { id: string; name: string }[];
}) {
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
              <BatchAdCard key={batch.id} batch={batch} subjectOptions={subjectOptions} />
            ))}
          </div>
        )}
      </div>

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

function BatchAdCard({
  batch,
  subjectOptions,
}: {
  batch: TeacherAdBatchRow;
  subjectOptions: { id: string; name: string }[];
}) {
  const t = useTranslations("teacherDashboard.ads.classAds");
  const tc = useTranslations("teacherDashboard.common");

  const [editing, setEditing] = useState(false);
  const [subjectId, setSubjectId] = useState(batch.subjectId ?? subjectOptions[0]?.id ?? "");
  const [title, setTitle] = useState(batch.ad?.title ?? "");
  const [content, setContent] = useState(batch.ad?.content ?? "");
  const [active, setActive] = useState(batch.ad?.status === "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  async function handleSave() {
    if (!subjectId || !title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await upsertBatchAd({ batchId: batch.id, subjectId, title, content });
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
    const result = await setBatchAdActive(batch.ad.id, checked);
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
          {subjectOptions.length === 0 ? (
            <p className="text-sm text-destructive">{t("noSubjects")}</p>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor={`subject-${batch.id}`}>{t("subjectLabel")}</Label>
              <Select value={subjectId} onValueChange={(value) => setSubjectId(value ?? "")}>
                <SelectTrigger id={`subject-${batch.id}`} className="w-full">
                  <SelectValue placeholder={t("subjectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor={`ad-title-${batch.id}`}>{t("titleLabel")}</Label>
            <Input
              id={`ad-title-${batch.id}`}
              placeholder={t("titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`ad-content-${batch.id}`}>{t("contentLabel")}</Label>
            <textarea
              id={`ad-content-${batch.id}`}
              className={textareaClass}
              placeholder={t("contentPlaceholder")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || subjectOptions.length === 0}>
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
