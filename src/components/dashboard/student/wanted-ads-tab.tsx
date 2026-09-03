"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/features/status-badge";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { avatarGradientClass } from "@/lib/avatar-color";
import {
  createWantedAd,
  updateWantedAd,
  setWantedAdStatus,
  deleteWantedAd,
  markWantedAdResponseRead,
} from "@/lib/dashboard/wanted-ads-actions";
import type { PublicWantedAd } from "@/components/features/wanted-ads-board";

const textareaClass =
  "min-h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

type LookingFor = "teacher" | "institute";
const LOOKING_FOR_OPTIONS: LookingFor[] = ["teacher", "institute"];
type Mode = "online" | "physical" | "both";
const MODE_OPTIONS: Mode[] = ["online", "physical", "both"];
type Medium = "english" | "sinhala" | "tamil" | "other";
const MEDIUM_OPTIONS: Medium[] = ["english", "sinhala", "tamil", "other"];
type ClassType = "new" | "revision";
const CLASS_TYPE_OPTIONS: ClassType[] = ["new", "revision"];

const DESCRIPTION_WORD_LIMIT = 60;
const ADDITIONAL_DETAILS_WORD_LIMIT = 60;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function WordCounter({ count, limit }: { count: number; limit: number }) {
  const t = useTranslations("studentDashboard.wantedAds");
  return (
    <p className={`text-xs ${count > limit ? "font-medium text-destructive" : "text-muted-foreground"}`}>
      {t("wordsCounter", { count, limit })}
    </p>
  );
}

export type WantedAdRow = {
  id: string;
  lookingFor: LookingFor;
  subjectId: string | null;
  subjectName: string | null;
  mode: Mode | null;
  gradeLevel: string | null;
  medium: Medium;
  classType: ClassType;
  title: string;
  description: string | null;
  status: "active" | "closed";
};

export type WantedAdResponseRow = {
  id: string;
  wantedAdId: string;
  responderType: "teacher" | "class";
  responderName: string | null;
  message: string;
  status: "new" | "read";
  createdLabel: string;
};

type SubjectOption = { id: string; name: string };

export function WantedAdsTab({
  wantedAds,
  subjectOptions,
  responses,
  sampleAds,
}: {
  wantedAds: WantedAdRow[];
  subjectOptions: SubjectOption[];
  responses: WantedAdResponseRow[];
  sampleAds: PublicWantedAd[];
}) {
  const t = useTranslations("studentDashboard.wantedAds");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {sampleAds.length > 0 && <SampleAdsSection ads={sampleAds} />}

      <WantedAdCreator subjectOptions={subjectOptions} />

      <div className="flex flex-col gap-4">
        {wantedAds.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
            {t("emptyState")}
          </div>
        ) : (
          wantedAds.map((ad) => (
            <WantedAdCard
              key={ad.id}
              ad={ad}
              subjectOptions={subjectOptions}
              responses={responses.filter((r) => r.wantedAdId === ad.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Real requests from other students, not fake placeholder text — a handful
// (whatever the caller passes, capped at 3 server-side) shown as posting
// inspiration. No respond action here; this student isn't a teacher/institute.
function SampleAdsSection({ ads }: { ads: PublicWantedAd[] }) {
  const t = useTranslations("studentDashboard.wantedAds");

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h4 className="mb-1 text-base font-medium text-foreground">{t("samplesHeading")}</h4>
      <p className="mb-4 text-sm text-muted-foreground">{t("samplesSubtitle")}</p>
      <div className="flex flex-col gap-3">
        {ads.map((ad) => (
          <div key={ad.id} className="rounded-md bg-secondary/60 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{ad.title}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                {t(`lookingForOptions.${ad.lookingFor}`)}
              </span>
              {ad.classType === "revision" && (
                <span className="rounded-full bg-accent-deep/10 px-2 py-0.5 text-[11px] font-medium text-accent-deep">
                  {t("classTypeOptions.revision")}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[
                ad.subject,
                ad.mode ? t(`modeOptions.${ad.mode}`) : null,
                t(`mediumOptions.${ad.medium}`),
                ad.gradeLevel,
                ad.createdLabel,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WantedAdFields({
  subjectOptions,
  lookingFor,
  setLookingFor,
  subjectId,
  setSubjectId,
  mode,
  setMode,
  medium,
  setMedium,
  classType,
  setClassType,
  gradeLevel,
  setGradeLevel,
  title,
  setTitle,
  description,
  setDescription,
  idPrefix,
  titleHint,
  descriptionHint,
}: {
  subjectOptions: SubjectOption[];
  lookingFor: LookingFor;
  setLookingFor: (value: LookingFor) => void;
  subjectId: string;
  setSubjectId: (value: string) => void;
  mode: Mode | "";
  setMode: (value: Mode | "") => void;
  medium: Medium;
  setMedium: (value: Medium) => void;
  classType: ClassType;
  setClassType: (value: ClassType) => void;
  gradeLevel: string;
  setGradeLevel: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  idPrefix: string;
  /** Shown under the headline field only by the create flow (WantedAdCreator
   * auto-drafts a headline from the fields above) — editing an existing ad
   * never auto-overwrites its saved headline, so there's nothing to explain
   * there. */
  titleHint?: string;
  /** Same story as titleHint, for the auto-drafted description. */
  descriptionHint?: string;
}) {
  const t = useTranslations("studentDashboard.wantedAds");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-looking-for`}>{t("lookingForLabel")}</Label>
          <Select value={lookingFor} onValueChange={(value) => setLookingFor((value as LookingFor) ?? "teacher")}>
            <SelectTrigger id={`${idPrefix}-looking-for`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOOKING_FOR_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`lookingForOptions.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-subject`}>{t("subjectLabel")}</Label>
          <Select value={subjectId} onValueChange={(value) => setSubjectId(value ?? "")}>
            <SelectTrigger id={`${idPrefix}-subject`} className="w-full">
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
          <Label htmlFor={`${idPrefix}-mode`}>{t("modeLabel")}</Label>
          <Select value={mode} onValueChange={(value) => setMode((value as Mode) ?? "")}>
            <SelectTrigger id={`${idPrefix}-mode`} className="w-full">
              <SelectValue placeholder={t("modePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`modeOptions.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-medium`}>{t("mediumLabel")}</Label>
          <Select value={medium} onValueChange={(value) => setMedium((value as Medium) ?? "sinhala")}>
            <SelectTrigger id={`${idPrefix}-medium`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEDIUM_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`mediumOptions.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-class-type`}>{t("classTypeLabel")}</Label>
          <Select value={classType} onValueChange={(value) => setClassType((value as ClassType) ?? "new")}>
            <SelectTrigger id={`${idPrefix}-class-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLASS_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`classTypeOptions.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-grade`}>{t("gradeLabel")}</Label>
          <Input
            id={`${idPrefix}-grade`}
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            placeholder={t("gradePlaceholder")}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-title`}>{t("titleLabel")}</Label>
        <Input
          id={`${idPrefix}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholder")}
        />
        {titleHint && <p className="text-xs text-muted-foreground">{titleHint}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-description`}>{t("descriptionLabel")}</Label>
        <textarea
          id={`${idPrefix}-description`}
          className={textareaClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("descriptionPlaceholder")}
        />
        {descriptionHint && <p className="text-xs text-muted-foreground">{descriptionHint}</p>}
        <WordCounter count={countWords(description)} limit={DESCRIPTION_WORD_LIMIT} />
      </div>
    </div>
  );
}

function buildLookingForSentence(t: ReturnType<typeof useTranslations>, lookingFor: LookingFor, subjectName: string | undefined) {
  return subjectName
    ? t(lookingFor === "teacher" ? "suggestedTitleTeacherWithSubject" : "suggestedTitleInstituteWithSubject", {
        subject: subjectName,
      })
    : t(lookingFor === "teacher" ? "suggestedTitleTeacherBase" : "suggestedTitleInstituteBase");
}

/**
 * A blank headline is the single biggest thing stopping a student from
 * posting — not everyone can turn "I'm looking for a Sinhala teacher for
 * Grade 11" into a punchy title from scratch. This drafts one from the
 * fields the student's already picking anyway, so there's something usable
 * the moment they've chosen a couple of dropdowns instead of a blank input.
 * Grade is appended with a dash rather than a translated "for" connector —
 * sidesteps needing per-language word-order handling for something that's
 * just a starting point the student edits anyway.
 */
function buildSuggestedTitle(
  t: ReturnType<typeof useTranslations>,
  lookingFor: LookingFor,
  subjectName: string | undefined,
  gradeLevel: string,
) {
  const base = buildLookingForSentence(t, lookingFor, subjectName);
  const grade = gradeLevel.trim();
  return grade ? `${base} — ${grade}` : base;
}

/**
 * Same motivation as buildSuggestedTitle, for the description: a blank
 * paragraph is intimidating, and most of what it would say is already
 * sitting in the fields above. Reads as a short, professional paragraph —
 * a handful of complete, independently-translated sentences joined with
 * plain spaces — rather than a "Label: value" fact list (the first version
 * of this, which Gehan felt read as too mechanical/not detailed enough).
 * Every sentence is a whole, hand-translated unit per language (only
 * {subject}/{grade}/{medium} are interpolated, never assembled from
 * fragments), so nothing here depends on runtime word-order or grammar
 * agreement across en/si/ta. Medium always has a value (default 'sinhala')
 * so its sentence always appears; grade/mode/revision only add a sentence
 * when actually set, same as the card's badge only showing for revision.
 */
function buildSuggestedDescription(
  t: ReturnType<typeof useTranslations>,
  lookingFor: LookingFor,
  subjectName: string | undefined,
  mode: Mode | "",
  medium: Medium,
  classType: ClassType,
  gradeLevel: string,
) {
  const sentences = [`${buildLookingForSentence(t, lookingFor, subjectName)}.`];
  const grade = gradeLevel.trim();
  if (grade) sentences.push(t("descriptionGradeSentence", { grade }));
  if (mode === "online") sentences.push(t("descriptionModeSentenceOnline"));
  else if (mode === "physical") sentences.push(t("descriptionModeSentencePhysical"));
  else if (mode === "both") sentences.push(t("descriptionModeSentenceBoth"));
  sentences.push(t("descriptionMediumSentence", { medium: t(`mediumOptions.${medium}`) }));
  if (classType === "revision") sentences.push(t("descriptionRevisionSentence"));
  sentences.push(t("descriptionClosingSentence"));
  return sentences.join(" ");
}

/**
 * Mirrors RequestCard's markup (wanted-ads-board.tsx) almost exactly — same
 * banner/avatar/footer-pill structure — so what a student sees here is what
 * actually renders on /requests, not an approximation. Pulls lookingFor/mode
 * labels and the "Respond" pill straight from requestsPage's own translation
 * keys rather than duplicating that copy, so the preview can't drift out of
 * sync with the real public card's wording.
 */
function WantedAdPreviewCard({
  seed,
  lookingFor,
  subjectName,
  mode,
  medium,
  classType,
  gradeLevel,
  title,
  description,
}: {
  seed: string;
  lookingFor: LookingFor;
  subjectName: string | undefined;
  mode: Mode | "";
  medium: Medium;
  classType: ClassType;
  gradeLevel: string;
  title: string;
  description: string;
}) {
  const t = useTranslations("studentDashboard.wantedAds");
  const tr = useTranslations("requestsPage");

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
      <div className="relative flex h-33 items-start bg-gradient-to-br from-primary to-primary-light p-3">
        {/* pr-16 reserves the avatar's bottom-right footprint so a second
         * badge wraps to its own line instead of sliding underneath it —
         * flex-wrap alone isn't enough since the avatar is absolutely
         * positioned and doesn't participate in this row's layout. */}
        <div className="flex flex-wrap gap-1.5 pr-16">
          <span className="rounded-[3px] border border-white/30 bg-white/15 px-2 py-0.5 font-mono text-[11px] tracking-wide text-white">
            {tr(`lookingForOptions.${lookingFor}`)}
          </span>
          {classType === "revision" && (
            <span className="rounded-[3px] border border-white/30 bg-white/15 px-2 py-0.5 font-mono text-[11px] tracking-wide text-white">
              {tr("classTypeOptions.revision")}
            </span>
          )}
        </div>
        <div
          className={`absolute -bottom-5.5 right-3.5 flex size-14 items-center justify-center rounded-full border-4 border-white text-white shadow-sm ${avatarGradientClass(seed)}`}
        >
          <GraduationCap className="size-5.5" />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-7.5">
        <div className="mb-1 line-clamp-2 font-display text-[17px] tracking-wide text-primary">
          {title.trim() || t("preview.untitled")}
        </div>
        <div className="mb-2.5 text-[12.5px] text-muted-foreground">
          {[subjectName, mode ? tr(`modeOptions.${mode}`) : null, tr(`mediumOptions.${medium}`), gradeLevel.trim() || null]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {description.trim() && <p className="mb-3.5 line-clamp-2 text-[12.5px] text-muted-foreground">{description}</p>}

        <div className="mt-auto flex items-center border-t border-dashed border-border pt-3.5">
          <span className="rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary">
            {tr("respondCta")}
          </span>
        </div>
      </div>
    </div>
  );
}

function WantedAdPreviewDialog({
  open,
  onOpenChange,
  ...cardProps
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & Parameters<typeof WantedAdPreviewCard>[0]) {
  const t = useTranslations("studentDashboard.wantedAds");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("preview.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("preview.dialogSubtitle")}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <WantedAdPreviewCard {...cardProps} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WantedAdCreator({ subjectOptions }: { subjectOptions: SubjectOption[] }) {
  const t = useTranslations("studentDashboard.wantedAds");
  const tc = useTranslations("studentDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const idPrefix = useId();

  const [open, setOpen] = useState(false);
  const [lookingFor, setLookingFor] = useState<LookingFor>("teacher");
  const [subjectId, setSubjectId] = useState("");
  const [mode, setMode] = useState<Mode | "">("");
  const [medium, setMedium] = useState<Medium>("sinhala");
  const [classType, setClassType] = useState<ClassType>("new");
  const [gradeLevel, setGradeLevel] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Only drafts while the student hasn't typed their own headline yet — once
  // they touch the field directly (handleTitleChange below), this stops
  // overwriting whatever they wrote.
  useEffect(() => {
    if (titleTouched) return;
    const subjectName = subjectOptions.find((s) => s.id === subjectId)?.name;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drafting a suggestion from other field state, not derived render state
    setTitle(buildSuggestedTitle(t, lookingFor, subjectName, gradeLevel));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/subjectOptions are stable for this component's lifetime; only the actual field values should retrigger the draft
  }, [lookingFor, subjectId, gradeLevel, titleTouched]);

  // Same drafting pattern as the headline, one effect down — keeps drafting
  // the description from the structured fields until the student edits it
  // directly (handleDescriptionChange below).
  useEffect(() => {
    if (descriptionTouched) return;
    const subjectName = subjectOptions.find((s) => s.id === subjectId)?.name;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drafting a suggestion from other field state, not derived render state
    setDescription(buildSuggestedDescription(t, lookingFor, subjectName, mode, medium, classType, gradeLevel));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/subjectOptions are stable for this component's lifetime; only the actual field values should retrigger the draft
  }, [lookingFor, subjectId, mode, medium, classType, gradeLevel, descriptionTouched]);

  function handleTitleChange(value: string) {
    setTitleTouched(true);
    setTitle(value);
  }

  function handleDescriptionChange(value: string) {
    setDescriptionTouched(true);
    setDescription(value);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError(t("titleRequired"));
      return;
    }
    if (countWords(description) > DESCRIPTION_WORD_LIMIT) {
      setError(t("descriptionTooLong", { limit: DESCRIPTION_WORD_LIMIT }));
      return;
    }
    if (countWords(additionalDetails) > ADDITIONAL_DETAILS_WORD_LIMIT) {
      setError(t("additionalDetailsTooLong", { limit: ADDITIONAL_DETAILS_WORD_LIMIT }));
      return;
    }
    setSaving(true);
    setError(null);
    const finalDescription = [description.trim(), additionalDetails.trim()].filter(Boolean).join("\n\n");
    const result = await createWantedAd({
      lookingFor,
      subjectId,
      mode,
      gradeLevel,
      medium,
      classType,
      title,
      description: finalDescription,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setLookingFor("teacher");
    setSubjectId("");
    setMode("");
    setMedium("sinhala");
    setClassType("new");
    setGradeLevel("");
    setTitle("");
    setTitleTouched(false);
    setDescription("");
    setDescriptionTouched(false);
    setAdditionalDetails("");
    refresh();
  }

  if (!open) {
    return (
      <div className="rounded-lg border border-dashed border-input bg-white p-5">
        <h4 className="mb-1 text-base font-medium text-foreground">{t("creatorHeading")}</h4>
        <p className="mb-3 text-sm text-muted-foreground">{t("creatorSubtitle")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          {t("postAd")}
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
      <h4 className="mb-3 text-base font-medium text-foreground">{t("creatorHeading")}</h4>
      <WantedAdFields
        subjectOptions={subjectOptions}
        lookingFor={lookingFor}
        setLookingFor={setLookingFor}
        subjectId={subjectId}
        setSubjectId={setSubjectId}
        mode={mode}
        setMode={setMode}
        medium={medium}
        setMedium={setMedium}
        classType={classType}
        setClassType={setClassType}
        gradeLevel={gradeLevel}
        setGradeLevel={setGradeLevel}
        title={title}
        setTitle={handleTitleChange}
        titleHint={t("titleAutoDraftHint")}
        description={description}
        setDescription={handleDescriptionChange}
        descriptionHint={t("descriptionAutoDraftHint")}
        idPrefix={idPrefix}
      />
      <div className="mt-4 grid gap-1.5">
        <Label htmlFor={`${idPrefix}-additional-details`}>{t("additionalDetailsLabel")}</Label>
        <textarea
          id={`${idPrefix}-additional-details`}
          className={textareaClass}
          value={additionalDetails}
          onChange={(e) => setAdditionalDetails(e.target.value)}
          placeholder={t("additionalDetailsPlaceholder")}
        />
        <WordCounter count={countWords(additionalDetails)} limit={ADDITIONAL_DETAILS_WORD_LIMIT} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {t("postAd")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
          {t("preview.button")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          {tc("close")}
        </Button>
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>
      <WantedAdPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        seed={title || "preview"}
        lookingFor={lookingFor}
        subjectName={subjectOptions.find((s) => s.id === subjectId)?.name}
        mode={mode}
        medium={medium}
        classType={classType}
        gradeLevel={gradeLevel}
        title={title}
        description={[description.trim(), additionalDetails.trim()].filter(Boolean).join("\n\n")}
      />
    </div>
  );
}

function WantedAdCard({
  ad,
  subjectOptions,
  responses,
}: {
  ad: WantedAdRow;
  subjectOptions: SubjectOption[];
  responses: WantedAdResponseRow[];
}) {
  const t = useTranslations("studentDashboard.wantedAds");
  const tc = useTranslations("studentDashboard.common");
  const { refresh } = useDashboardRefresh();
  const idPrefix = useId();

  const [editing, setEditing] = useState(false);
  const [lookingFor, setLookingFor] = useState<LookingFor>(ad.lookingFor);
  const [subjectId, setSubjectId] = useState(ad.subjectId ?? "");
  const [mode, setMode] = useState<Mode | "">(ad.mode ?? "");
  const [medium, setMedium] = useState<Medium>(ad.medium);
  const [classType, setClassType] = useState<ClassType>(ad.classType);
  const [gradeLevel, setGradeLevel] = useState(ad.gradeLevel ?? "");
  const [title, setTitle] = useState(ad.title);
  const [description, setDescription] = useState(ad.description ?? "");
  const [active, setActive] = useState(ad.status === "active");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      setError(t("titleRequired"));
      return;
    }
    if (countWords(description) > DESCRIPTION_WORD_LIMIT) {
      setError(t("descriptionTooLong", { limit: DESCRIPTION_WORD_LIMIT }));
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateWantedAd(ad.id, { lookingFor, subjectId, mode, gradeLevel, medium, classType, title, description });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    refresh();
  }

  async function handleToggle(checked: boolean) {
    setToggling(true);
    const result = await setWantedAdStatus(ad.id, checked);
    setToggling(false);
    if (!result.error) {
      setActive(checked);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteWantedAd(ad.id);
    if (result.error) {
      setDeleting(false);
      setError(result.error);
      return;
    }
    refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-medium text-foreground">{ad.title}</h4>
            {ad.classType === "revision" && (
              <span className="rounded-full bg-accent-deep/10 px-2 py-0.5 text-[11px] font-medium text-accent-deep">
                {t("classTypeOptions.revision")}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t(`lookingForOptions.${ad.lookingFor}`)}
            {ad.subjectName ? ` · ${ad.subjectName}` : ""}
            {ad.mode ? ` · ${t(`modeOptions.${ad.mode}`)}` : ""}
            {` · ${t(`mediumOptions.${ad.medium}`)}`}
            {ad.gradeLevel ? ` · ${ad.gradeLevel}` : ""}
          </p>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${active ? "text-success" : "text-muted-foreground"}`}>
              {active ? t("statusOpen") : t("statusClosed")}
            </span>
            <Switch checked={active} onCheckedChange={handleToggle} disabled={toggling} />
          </div>
        )}
      </div>

      {!editing && (
        <div>
          {ad.description && <p className="mb-3 text-sm text-muted-foreground">{ad.description}</p>}

          {responses.length > 0 && (
            <div className="mb-3 flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground">
                {t("responsesHeading", { count: responses.length })}
              </p>
              {responses.map((response) => (
                <ResponseItem key={response.id} response={response} />
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              {t("editAd")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDelete} disabled={deleting}>
              {t("deleteAd")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-4">
          <WantedAdFields
            subjectOptions={subjectOptions}
            lookingFor={lookingFor}
            setLookingFor={setLookingFor}
            subjectId={subjectId}
            setSubjectId={setSubjectId}
            mode={mode}
            setMode={setMode}
            medium={medium}
            setMedium={setMedium}
            classType={classType}
            setClassType={setClassType}
            gradeLevel={gradeLevel}
            setGradeLevel={setGradeLevel}
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            idPrefix={idPrefix}
          />
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {tc("save")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
              {t("preview.button")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              {tc("close")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}
      <WantedAdPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        seed={ad.id}
        lookingFor={lookingFor}
        subjectName={subjectOptions.find((s) => s.id === subjectId)?.name}
        mode={mode}
        medium={medium}
        classType={classType}
        gradeLevel={gradeLevel}
        title={title}
        description={description}
      />
    </div>
  );
}

// Mirrors InquiryItem's new/read shape (inquiries-tab.tsx) — full page
// refresh() rather than local list splicing, matching how the rest of this
// tab already handles its own mutations (create/update/delete above).
function ResponseItem({ response }: { response: WantedAdResponseRow }) {
  const t = useTranslations("studentDashboard.wantedAds");
  const { refresh } = useDashboardRefresh();
  const [marking, setMarking] = useState(false);

  async function handleMarkRead() {
    setMarking(true);
    await markWantedAdResponseRead(response.id);
    setMarking(false);
    refresh();
  }

  return (
    <div className="rounded-md bg-secondary/60 px-3 py-2">
      <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {response.responderName ?? t(`responderTypeLabels.${response.responderType}`)}
            {" · "}
            {t(`responderTypeLabels.${response.responderType}`)}
          </span>
          {response.status === "new" && <StatusBadge variant="pending">{t("newResponseBadge")}</StatusBadge>}
        </div>
        <span className="text-xs text-muted-foreground">{response.createdLabel}</span>
      </div>
      <p className="text-sm text-foreground/85">{response.message}</p>
      {response.status === "new" && (
        <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2" onClick={handleMarkRead} disabled={marking}>
          {t("markResponseRead")}
        </Button>
      )}
    </div>
  );
}
