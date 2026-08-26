"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { createWantedAd, updateWantedAd, setWantedAdStatus, deleteWantedAd } from "@/lib/dashboard/wanted-ads-actions";

const textareaClass =
  "min-h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

type LookingFor = "teacher" | "institute";
const LOOKING_FOR_OPTIONS: LookingFor[] = ["teacher", "institute"];
type Mode = "online" | "physical" | "both";
const MODE_OPTIONS: Mode[] = ["online", "physical", "both"];

export type WantedAdRow = {
  id: string;
  lookingFor: LookingFor;
  subjectId: string | null;
  subjectName: string | null;
  mode: Mode | null;
  gradeLevel: string | null;
  title: string;
  description: string | null;
  status: "active" | "closed";
};

type SubjectOption = { id: string; name: string };

export function WantedAdsTab({
  wantedAds,
  subjectOptions,
}: {
  wantedAds: WantedAdRow[];
  subjectOptions: SubjectOption[];
}) {
  const t = useTranslations("studentDashboard.wantedAds");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <WantedAdCreator subjectOptions={subjectOptions} />

      <div className="flex flex-col gap-4">
        {wantedAds.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
            {t("emptyState")}
          </div>
        ) : (
          wantedAds.map((ad) => <WantedAdCard key={ad.id} ad={ad} subjectOptions={subjectOptions} />)
        )}
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
  gradeLevel,
  setGradeLevel,
  title,
  setTitle,
  description,
  setDescription,
  idPrefix,
}: {
  subjectOptions: SubjectOption[];
  lookingFor: LookingFor;
  setLookingFor: (value: LookingFor) => void;
  subjectId: string;
  setSubjectId: (value: string) => void;
  mode: Mode | "";
  setMode: (value: Mode | "") => void;
  gradeLevel: string;
  setGradeLevel: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  idPrefix: string;
}) {
  const t = useTranslations("studentDashboard.wantedAds");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
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
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-grade`}>{t("gradeLabel")}</Label>
          <Input
            id={`${idPrefix}-grade`}
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            placeholder={t("gradePlaceholder")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-title`}>{t("titleLabel")}</Label>
          <Input
            id={`${idPrefix}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
          />
        </div>
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
      </div>
    </div>
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
  const [gradeLevel, setGradeLevel] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) {
      setError(t("titleRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createWantedAd({ lookingFor, subjectId, mode, gradeLevel, title, description });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setLookingFor("teacher");
    setSubjectId("");
    setMode("");
    setGradeLevel("");
    setTitle("");
    setDescription("");
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
        gradeLevel={gradeLevel}
        setGradeLevel={setGradeLevel}
        title={title}
        setTitle={setTitle}
        description={description}
        setDescription={setDescription}
        idPrefix={idPrefix}
      />
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {t("postAd")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          {tc("close")}
        </Button>
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>
    </div>
  );
}

function WantedAdCard({ ad, subjectOptions }: { ad: WantedAdRow; subjectOptions: SubjectOption[] }) {
  const t = useTranslations("studentDashboard.wantedAds");
  const tc = useTranslations("studentDashboard.common");
  const { refresh } = useDashboardRefresh();
  const idPrefix = useId();

  const [editing, setEditing] = useState(false);
  const [lookingFor, setLookingFor] = useState<LookingFor>(ad.lookingFor);
  const [subjectId, setSubjectId] = useState(ad.subjectId ?? "");
  const [mode, setMode] = useState<Mode | "">(ad.mode ?? "");
  const [gradeLevel, setGradeLevel] = useState(ad.gradeLevel ?? "");
  const [title, setTitle] = useState(ad.title);
  const [description, setDescription] = useState(ad.description ?? "");
  const [active, setActive] = useState(ad.status === "active");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) {
      setError(t("titleRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateWantedAd(ad.id, { lookingFor, subjectId, mode, gradeLevel, title, description });
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
          <h4 className="text-base font-medium text-foreground">{ad.title}</h4>
          <p className="text-sm text-muted-foreground">
            {t(`lookingForOptions.${ad.lookingFor}`)}
            {ad.subjectName ? ` · ${ad.subjectName}` : ""}
            {ad.mode ? ` · ${t(`modeOptions.${ad.mode}`)}` : ""}
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
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              {tc("close")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
