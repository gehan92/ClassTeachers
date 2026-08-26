"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AdSlot } from "@/components/features/ad-slot";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { updateOwnProfileAd, upsertBatchAd, setBatchAdActive, createIndividualAd } from "@/lib/dashboard/ads-actions";
import type { GradeBand } from "@/types/grade-band";

const textareaClass =
  "min-h-28 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

const GRADE_BANDS: GradeBand[] = ["1-5", "6-9", "10-11", "12-13", "campus"];

export type TeacherAdBatchRow = {
  id: string;
  title: string;
  subjectId: string | null;
  subjectName: string | null;
  hourlyRate: number | null;
  monthlyRate: number | null;
  ad: { id: string; title: string; content: string; status: "active" | "expired" | "removed" } | null;
};

export function AdvertisementTab({
  initialContent,
  batches,
  subjectOptions,
  defaultHourlyRate,
  defaultMonthlyRate,
}: {
  initialContent: string;
  batches: TeacherAdBatchRow[];
  subjectOptions: { id: string; name: string }[];
  defaultHourlyRate?: number | null;
  defaultMonthlyRate?: number | null;
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

        <div className="flex flex-col gap-4">
          <IndividualAdCreator
            subjectOptions={subjectOptions}
            defaultHourlyRate={defaultHourlyRate}
            defaultMonthlyRate={defaultMonthlyRate}
          />

          {batches.length === 0 ? (
            <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
              {t("classAds.noBatches")}
            </div>
          ) : (
            batches.map((batch) => (
              <BatchAdCard
                key={batch.id}
                batch={batch}
                subjectOptions={subjectOptions}
                defaultHourlyRate={defaultHourlyRate}
                defaultMonthlyRate={defaultMonthlyRate}
              />
            ))
          )}
        </div>
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
  defaultHourlyRate,
  defaultMonthlyRate,
}: {
  batch: TeacherAdBatchRow;
  subjectOptions: { id: string; name: string }[];
  defaultHourlyRate?: number | null;
  defaultMonthlyRate?: number | null;
}) {
  const t = useTranslations("teacherDashboard.ads.classAds");
  const tc = useTranslations("teacherDashboard.common");

  const [editing, setEditing] = useState(false);
  const [subjectId, setSubjectId] = useState(batch.subjectId ?? subjectOptions[0]?.id ?? "");
  const [title, setTitle] = useState(batch.ad?.title ?? "");
  const [content, setContent] = useState(batch.ad?.content ?? "");
  const [hourlyRate, setHourlyRate] = useState(batch.hourlyRate != null ? String(batch.hourlyRate) : "");
  const [monthlyRate, setMonthlyRate] = useState(batch.monthlyRate != null ? String(batch.monthlyRate) : "");
  const [active, setActive] = useState(batch.ad?.status === "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  async function handleSave() {
    if (!subjectId || !title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await upsertBatchAd({
      batchId: batch.id,
      subjectId,
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`ad-hourly-${batch.id}`}>{t("hourlyRateLabel")}</Label>
              <Input
                id={`ad-hourly-${batch.id}`}
                type="number"
                min="0"
                inputMode="decimal"
                placeholder={
                  defaultHourlyRate != null ? t("ratePlaceholderDefault", { rate: defaultHourlyRate }) : t("ratePlaceholderNone")
                }
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`ad-monthly-${batch.id}`}>{t("monthlyRateLabel")}</Label>
              <Input
                id={`ad-monthly-${batch.id}`}
                type="number"
                min="0"
                inputMode="decimal"
                placeholder={
                  defaultMonthlyRate != null
                    ? t("ratePlaceholderDefault", { rate: defaultMonthlyRate })
                    : t("ratePlaceholderNone")
                }
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(e.target.value)}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t("rateHelper")}</p>
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

/**
 * Advertising used to require an existing batch (a scheduled class), which
 * meant a teacher who just does flexible one-on-one tutoring — no fixed
 * class or timetable — couldn't post an ad at all. This creates a
 * lightweight batch behind the scenes alongside the ad, so posting an ad is
 * one step regardless of whether a "class" exists yet; always shown, not
 * just when the teacher has zero batches, since even someone with scheduled
 * classes may also want to offer flexible individual tutoring.
 */
function IndividualAdCreator({
  subjectOptions,
  defaultHourlyRate,
  defaultMonthlyRate,
}: {
  subjectOptions: { id: string; name: string }[];
  defaultHourlyRate?: number | null;
  defaultMonthlyRate?: number | null;
}) {
  const t = useTranslations("teacherDashboard.ads.individualAd");
  const tc = useTranslations("teacherDashboard.common");
  const tg = useTranslations("search");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(subjectOptions[0]?.id ?? "");
  const [mode, setMode] = useState<"online" | "physical">("online");
  const [gradeBand, setGradeBand] = useState<GradeBand>("12-13");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!subjectId || !title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createIndividualAd({
      subjectId,
      mode,
      gradeBand,
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
    setOpen(false);
    setTitle("");
    setContent("");
    setHourlyRate("");
    setMonthlyRate("");
    refresh();
  }

  if (!open) {
    return (
      <div className="rounded-lg border border-dashed border-input bg-white p-5">
        <h4 className="mb-1 text-base font-medium text-foreground">{t("heading")}</h4>
        <p className="mb-3 text-sm text-muted-foreground">{t("subtitle")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          {t("createAd")}
        </Button>
        <RefreshStatus
          pending={isRefreshing}
          stuck={refreshStuck}
          pendingLabel={tc("updatingList")}
          stuckLabel={tc("updateStuck")}
          reloadLabel={tc("reloadPage")}
          className="mt-3"
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h4 className="mb-3 text-base font-medium text-foreground">{t("heading")}</h4>
      {subjectOptions.length === 0 ? (
        <p className="text-sm text-destructive">{t("noSubjects")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="individual-subject">{t("subjectLabel")}</Label>
              <Select value={subjectId} onValueChange={(value) => setSubjectId(value ?? "")}>
                <SelectTrigger id="individual-subject" className="w-full">
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
            <div className="grid gap-1.5">
              <Label htmlFor="individual-mode">{t("modeLabel")}</Label>
              <Select value={mode} onValueChange={(value) => setMode((value as "online" | "physical") ?? "online")}>
                <SelectTrigger id="individual-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">{t("modeOnline")}</SelectItem>
                  <SelectItem value="physical">{t("modePhysical")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="individual-grade">{t("gradeLabel")}</Label>
              <Select value={gradeBand} onValueChange={(value) => setGradeBand((value as GradeBand) ?? "12-13")}>
                <SelectTrigger id="individual-grade" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_BANDS.map((band) => (
                    <SelectItem key={band} value={band}>
                      {tg(`grades.${band}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="individual-title">{t("titleLabel")}</Label>
            <Input
              id="individual-title"
              placeholder={t("titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="individual-content">{t("contentLabel")}</Label>
            <textarea
              id="individual-content"
              className={textareaClass}
              placeholder={t("contentPlaceholder")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="individual-hourly">{t("hourlyRateLabel")}</Label>
              <Input
                id="individual-hourly"
                type="number"
                min="0"
                inputMode="decimal"
                placeholder={
                  defaultHourlyRate != null ? t("ratePlaceholderDefault", { rate: defaultHourlyRate }) : t("ratePlaceholderNone")
                }
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="individual-monthly">{t("monthlyRateLabel")}</Label>
              <Input
                id="individual-monthly"
                type="number"
                min="0"
                inputMode="decimal"
                placeholder={
                  defaultMonthlyRate != null
                    ? t("ratePlaceholderDefault", { rate: defaultMonthlyRate })
                    : t("ratePlaceholderNone")
                }
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
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
