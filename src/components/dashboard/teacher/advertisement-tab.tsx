"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { AdSlot } from "@/components/features/ad-slot";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { AdPreviewCard } from "@/components/dashboard/ad-preview-card";
import { AdHistoryList, type AdHistoryRow } from "@/components/dashboard/ad-history-list";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { hasRichText, RICH_TEXT_DISPLAY_CLASS } from "@/lib/rich-text";
import {
  updateOwnProfileAd,
  upsertBatchAd,
  setBatchAdActive,
  deleteBatchAd,
  createIndividualAd,
} from "@/lib/dashboard/ads-actions";
import type { GradeBand } from "@/types/grade-band";
import { GRADE_BAND_SELECT_VALUES, OPEN_GRADE_VALUE } from "@/lib/grade-band-options";

const textareaClass =
  "min-h-28 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

type Medium = "english" | "sinhala" | "tamil" | "other";
const MEDIUM_OPTIONS: Medium[] = ["english", "sinhala", "tamil", "other"];
type ClassType = "new" | "revision";
const CLASS_TYPE_OPTIONS: ClassType[] = ["new", "revision"];

// Auto-drafted description text (built from plain translation strings, see
// buildAdDescription below) gets wrapped in a <p> before being handed to
// RichTextEditor as its HTML value — escape it first so a free-typed title
// like "Grade 10 < 11" can't be parsed as a tag. Same helper as
// wanted-ads-tab.tsx's own escapeHtml, duplicated locally rather than shared
// since the two composers otherwise share nothing.
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildAdTitle(t: ReturnType<typeof useTranslations>, subjectName: string | undefined): string {
  return subjectName ? t("titleWithSubject", { subject: subjectName }) : t("titleBase");
}

/**
 * Mirrors wanted-ads-tab.tsx's buildSuggestedDescription — a handful of
 * complete, independently-translated sentences joined with plain spaces,
 * built from whatever fields this particular composer actually has
 * (BatchAdCard has no mode/grade fields, IndividualAdCreator does).
 */
function buildAdDescription(
  t: ReturnType<typeof useTranslations>,
  subjectName: string | undefined,
  mediumLabel: string,
  classType: ClassType,
  modeLabel?: string,
  gradeLabel?: string,
): string {
  const sentences = [
    subjectName ? t("descriptionSubjectSentence", { subject: subjectName }) : t("descriptionNoSubjectSentence"),
  ];
  if (gradeLabel) sentences.push(t("descriptionGradeSentence", { grade: gradeLabel }));
  if (modeLabel) sentences.push(modeLabel);
  sentences.push(t("descriptionMediumSentence", { medium: mediumLabel }));
  if (classType === "revision") sentences.push(t("descriptionRevisionSentence"));
  sentences.push(t("descriptionClosingSentence"));
  return sentences.join(" ");
}

/**
 * Mirrors wanted-ads-tab.tsx's WantedAdPreviewDialog — a "Preview" button
 * opens this instead of the preview sitting inline in the form all the
 * time, matching the student "Post an ad" composer's Post ad/Preview/Close
 * button row (Gehan asked for parity after comparing the two dashboards).
 */
function AdPreviewDialog({
  open,
  onOpenChange,
  dialogTitle,
  dialogSubtitle,
  ...cardProps
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogTitle: string;
  dialogSubtitle: string;
} & Parameters<typeof AdPreviewCard>[0]) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogSubtitle}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <AdPreviewCard {...cardProps} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type TeacherAdBatchRow = {
  id: string;
  title: string;
  courseCode: string | null;
  subjectId: string | null;
  subjectName: string | null;
  hourlyRate: number | null;
  monthlyRate: number | null;
  hourlyRateMax: number | null;
  monthlyRateMax: number | null;
  medium: Medium | null;
  classType: ClassType | null;
  ad: { id: string; title: string; content: string; status: "active" | "expired" | "removed"; viewCount: number } | null;
};

export function AdvertisementTab({
  initialContent,
  batches,
  subjectOptions,
  defaultHourlyRate,
  defaultMonthlyRate,
  history = [],
}: {
  initialContent: string;
  batches: TeacherAdBatchRow[];
  subjectOptions: { id: string; name: string }[];
  defaultHourlyRate?: number | null;
  defaultMonthlyRate?: number | null;
  history?: AdHistoryRow[];
}) {
  const t = useTranslations("teacherDashboard.ads");
  const tc = useTranslations("teacherDashboard.common");

  const [promotionText, setPromotionText] = useState(initialContent);
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
          {saved && <span className="animate-in fade-in-0 text-sm font-medium text-success duration-200">{tc("saved")}</span>}
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
      </div>

      <AdSlot
        size="sm"
        eyebrow={t("adSlot.eyebrow")}
        text={promotionText || t("adSlot.empty")}
        ctaLabel={t("adSlot.ctaLabel")}
        ctaHref="/advertise"
      />

      {history.length > 0 && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-1 text-lg">{t("history.heading")}</h3>
          <p className="mb-4 text-sm text-muted-foreground">{t("history.subtitle")}</p>
          <AdHistoryList
            items={history}
            ownerType="teacher"
            restoreLabel={t("history.restore")}
            restoredLabel={t("history.restored")}
          />
        </div>
      )}
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
  const tp = useTranslations("teacherDashboard.ads.classAds.preview");
  const td = useTranslations("teacherDashboard.ads.autoDraft");
  const tr = useTranslations("requestsPage");
  const tc = useTranslations("teacherDashboard.common");

  const [editing, setEditing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(batch.subjectId ?? subjectOptions[0]?.id ?? "");
  const [medium, setMedium] = useState<Medium>(batch.medium ?? "sinhala");
  const [classType, setClassType] = useState<ClassType>(batch.classType ?? "new");
  const [title, setTitle] = useState(batch.ad?.title ?? "");
  // Only a brand-new ad (no batch.ad yet) auto-drafts — editing an existing
  // ad never overwrites its saved title/content, same split as wanted-ads'
  // WantedAdCreator (drafts) vs WantedAdCard (doesn't).
  const [titleTouched, setTitleTouched] = useState(Boolean(batch.ad));
  const [content, setContent] = useState(batch.ad?.content ?? "");
  const [contentTouched, setContentTouched] = useState(Boolean(batch.ad));
  const [hourlyRate, setHourlyRate] = useState(batch.hourlyRate != null ? String(batch.hourlyRate) : "");
  const [monthlyRate, setMonthlyRate] = useState(batch.monthlyRate != null ? String(batch.monthlyRate) : "");
  const [hourlyRateMax, setHourlyRateMax] = useState(batch.hourlyRateMax != null ? String(batch.hourlyRateMax) : "");
  const [monthlyRateMax, setMonthlyRateMax] = useState(batch.monthlyRateMax != null ? String(batch.monthlyRateMax) : "");
  const [active, setActive] = useState(batch.ad?.status === "active");
  const [deleted, setDeleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { refresh } = useDashboardRefresh();

  const subjectName = subjectOptions.find((s) => s.id === subjectId)?.name;

  useEffect(() => {
    if (titleTouched) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drafting a suggestion from other field state, not derived render state
    setTitle(buildAdTitle(td, subjectName));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- td/subjectOptions are stable for this component's lifetime; only the actual field values should retrigger the draft
  }, [subjectId, titleTouched]);

  useEffect(() => {
    if (contentTouched) return;
    const draft = buildAdDescription(td, subjectName, tr(`mediumOptions.${medium}`), classType);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drafting a suggestion from other field state, not derived render state
    setContent(`<p>${escapeHtml(draft)}</p>`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- td/tr/subjectOptions are stable for this component's lifetime; only the actual field values should retrigger the draft
  }, [subjectId, medium, classType, contentTouched]);

  function handleTitleChange(value: string) {
    setTitleTouched(true);
    setTitle(value);
  }

  function handleContentChange(value: string) {
    setContentTouched(true);
    setContent(value);
  }

  async function handleSave() {
    if (!subjectId || !title.trim() || !hasRichText(content)) return;
    setSaving(true);
    setError(null);
    const result = await upsertBatchAd({
      batchId: batch.id,
      subjectId,
      title,
      content,
      medium,
      classType,
      hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : undefined,
      monthlyRate: monthlyRate.trim() ? Number(monthlyRate) : undefined,
      hourlyRateMax: hourlyRateMax.trim() ? Number(hourlyRateMax) : undefined,
      monthlyRateMax: monthlyRateMax.trim() ? Number(monthlyRateMax) : undefined,
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

  async function handleDelete() {
    if (!batch.ad) return;
    if (!window.confirm(t("confirmDelete"))) return;
    setDeleting(true);
    setError(null);
    const result = await deleteBatchAd(batch.ad.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDeleted(true);
    refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-medium text-foreground">
            {batch.courseCode && <span className="text-muted-foreground">{batch.courseCode} · </span>}
            {batch.title}
          </h4>
          <p className="text-sm text-muted-foreground">
            {batch.subjectName ? t("batchSubject", { subject: batch.subjectName }) : t("noSubjectYet")}
          </p>
        </div>
        {batch.ad && !deleted && !editing && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {t("viewCount", { count: batch.ad.viewCount })}
            </span>
            <span className={`text-sm font-medium ${active ? "text-success" : "text-muted-foreground"}`}>
              {active ? t("active") : t("paused")}
            </span>
            <Switch checked={active} onCheckedChange={handleToggle} disabled={toggling} />
          </div>
        )}
      </div>

      {!editing && (
        <div>
          {batch.ad && !deleted ? (
            <div className="mb-3">
              <p className="text-sm font-medium text-foreground">{batch.ad.title}</p>
              <div
                className={`mt-1 text-sm text-muted-foreground ${RICH_TEXT_DISPLAY_CLASS}`}
                dangerouslySetInnerHTML={{ __html: batch.ad.content }}
              />
            </div>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">{t("noAdYet")}</p>
          )}
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              {batch.ad && !deleted ? t("editAd") : t("createAd")}
            </Button>
            {batch.ad && !deleted && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {t("deleteAd")}
              </Button>
            )}
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-4">
          {subjectOptions.length === 0 ? (
            <p className="text-sm text-destructive">{t("noSubjects")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
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
              <div className="grid gap-1.5">
                <Label htmlFor={`medium-${batch.id}`}>{t("mediumLabel")}</Label>
                <Select value={medium} onValueChange={(value) => setMedium((value as Medium) ?? "sinhala")}>
                  <SelectTrigger id={`medium-${batch.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIUM_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {tr(`mediumOptions.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`class-type-${batch.id}`}>{t("classTypeLabel")}</Label>
                <Select value={classType} onValueChange={(value) => setClassType((value as ClassType) ?? "new")}>
                  <SelectTrigger id={`class-type-${batch.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASS_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {tr(`classTypeOptions.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor={`ad-title-${batch.id}`}>{t("titleLabel")}</Label>
            <Input
              id={`ad-title-${batch.id}`}
              placeholder={t("titlePlaceholder")}
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("titleAutoDraftHint")}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`ad-content-${batch.id}`}>{t("contentLabel")}</Label>
            <RichTextEditor
              id={`ad-content-${batch.id}`}
              value={content}
              onChange={handleContentChange}
              placeholder={t("contentPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("descriptionAutoDraftHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`ad-hourly-${batch.id}`}>{t("hourlyRateLabel")}</Label>
              <div className="flex items-center gap-2">
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
                <span className="shrink-0 text-muted-foreground">–</span>
                <Input
                  aria-label={t("hourlyRateMaxLabel")}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder={t("rateMaxPlaceholder")}
                  value={hourlyRateMax}
                  onChange={(e) => setHourlyRateMax(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`ad-monthly-${batch.id}`}>{t("monthlyRateLabel")}</Label>
              <div className="flex items-center gap-2">
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
                <span className="shrink-0 text-muted-foreground">–</span>
                <Input
                  aria-label={t("monthlyRateMaxLabel")}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder={t("rateMaxPlaceholder")}
                  value={monthlyRateMax}
                  onChange={(e) => setMonthlyRateMax(e.target.value)}
                />
              </div>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t("rateHelper")}</p>
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || subjectOptions.length === 0}>
              {t("save")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
              {tp("button")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              {tc("close")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
          <AdPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            dialogTitle={tp("dialogTitle")}
            dialogSubtitle={tp("dialogSubtitle")}
            badgeLabel={t("previewBadge")}
            emptyLabel={t("previewEmpty")}
            title={title}
            content={content}
            richContent
            meta={[batch.courseCode, subjectName, tr(`mediumOptions.${medium}`), classType === "revision" ? tr("classTypeOptions.revision") : null].filter(
              (v): v is string => Boolean(v),
            )}
          />
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
  const tp = useTranslations("teacherDashboard.ads.individualAd.preview");
  const td = useTranslations("teacherDashboard.ads.autoDraft");
  const tr = useTranslations("requestsPage");
  const tc = useTranslations("teacherDashboard.common");
  const tg = useTranslations("search");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(subjectOptions[0]?.id ?? "");
  const [mode, setMode] = useState<"online" | "physical">("online");
  const [gradeBand, setGradeBand] = useState<GradeBand | typeof OPEN_GRADE_VALUE>("12-13");
  const [medium, setMedium] = useState<Medium>("sinhala");
  const [classType, setClassType] = useState<ClassType>("new");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [content, setContent] = useState("");
  const [contentTouched, setContentTouched] = useState(false);
  const [hourlyRate, setHourlyRate] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("");
  const [hourlyRateMax, setHourlyRateMax] = useState("");
  const [monthlyRateMax, setMonthlyRateMax] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjectName = subjectOptions.find((s) => s.id === subjectId)?.name;

  useEffect(() => {
    if (titleTouched) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drafting a suggestion from other field state, not derived render state
    setTitle(buildAdTitle(td, subjectName));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- td/subjectOptions are stable for this component's lifetime; only the actual field values should retrigger the draft
  }, [subjectId, titleTouched]);

  useEffect(() => {
    if (contentTouched) return;
    const gradeLabel = gradeBand === OPEN_GRADE_VALUE ? undefined : tg(`grades.${gradeBand}`);
    const modeLabel = mode === "online" ? td("descriptionModeSentenceOnline") : td("descriptionModeSentencePhysical");
    const draft = buildAdDescription(td, subjectName, tr(`mediumOptions.${medium}`), classType, modeLabel, gradeLabel);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drafting a suggestion from other field state, not derived render state
    setContent(`<p>${escapeHtml(draft)}</p>`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- td/tr/tg/subjectOptions are stable for this component's lifetime; only the actual field values should retrigger the draft
  }, [subjectId, mode, gradeBand, medium, classType, contentTouched]);

  function handleTitleChange(value: string) {
    setTitleTouched(true);
    setTitle(value);
  }

  function handleContentChange(value: string) {
    setContentTouched(true);
    setContent(value);
  }

  async function handleSave() {
    if (!subjectId || !title.trim() || !hasRichText(content)) return;
    setSaving(true);
    setError(null);
    const result = await createIndividualAd({
      subjectId,
      mode,
      gradeBand: gradeBand === OPEN_GRADE_VALUE ? undefined : gradeBand,
      title,
      content,
      medium,
      classType,
      hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : undefined,
      monthlyRate: monthlyRate.trim() ? Number(monthlyRate) : undefined,
      hourlyRateMax: hourlyRateMax.trim() ? Number(hourlyRateMax) : undefined,
      monthlyRateMax: monthlyRateMax.trim() ? Number(monthlyRateMax) : undefined,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setTitle("");
    setTitleTouched(false);
    setContent("");
    setContentTouched(false);
    setHourlyRate("");
    setMonthlyRate("");
    setHourlyRateMax("");
    setMonthlyRateMax("");
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
              <Select
                value={gradeBand}
                onValueChange={(value) => setGradeBand((value as GradeBand | typeof OPEN_GRADE_VALUE) ?? "12-13")}
              >
                <SelectTrigger id="individual-grade" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_BAND_SELECT_VALUES.map((band) => (
                    <SelectItem key={band} value={band}>
                      {band === OPEN_GRADE_VALUE ? tg("grades.open") : tg(`grades.${band}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="individual-medium">{t("mediumLabel")}</Label>
              <Select value={medium} onValueChange={(value) => setMedium((value as Medium) ?? "sinhala")}>
                <SelectTrigger id="individual-medium" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEDIUM_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {tr(`mediumOptions.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="individual-class-type">{t("classTypeLabel")}</Label>
              <Select value={classType} onValueChange={(value) => setClassType((value as ClassType) ?? "new")}>
                <SelectTrigger id="individual-class-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {tr(`classTypeOptions.${option}`)}
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
              onChange={(e) => handleTitleChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("titleAutoDraftHint")}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="individual-content">{t("contentLabel")}</Label>
            <RichTextEditor
              id="individual-content"
              value={content}
              onChange={handleContentChange}
              placeholder={t("contentPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("descriptionAutoDraftHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="individual-hourly">{t("hourlyRateLabel")}</Label>
              <div className="flex items-center gap-2">
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
                <span className="shrink-0 text-muted-foreground">–</span>
                <Input
                  aria-label={t("hourlyRateMaxLabel")}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder={t("rateMaxPlaceholder")}
                  value={hourlyRateMax}
                  onChange={(e) => setHourlyRateMax(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="individual-monthly">{t("monthlyRateLabel")}</Label>
              <div className="flex items-center gap-2">
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
                <span className="shrink-0 text-muted-foreground">–</span>
                <Input
                  aria-label={t("monthlyRateMaxLabel")}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder={t("rateMaxPlaceholder")}
                  value={monthlyRateMax}
                  onChange={(e) => setMonthlyRateMax(e.target.value)}
                />
              </div>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t("rateHelper")}</p>
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {t("save")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
              {tp("button")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              {tc("close")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
          <AdPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            dialogTitle={tp("dialogTitle")}
            dialogSubtitle={tp("dialogSubtitle")}
            badgeLabel={t("previewBadge")}
            emptyLabel={t("previewEmpty")}
            title={title}
            content={content}
            richContent
            meta={[
              subjectName,
              mode === "online" ? t("modeOnline") : t("modePhysical"),
              tr(`mediumOptions.${medium}`),
              classType === "revision" ? tr("classTypeOptions.revision") : null,
            ].filter((v): v is string => Boolean(v))}
          />
        </div>
      )}
    </div>
  );
}
