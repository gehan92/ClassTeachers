"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, Eye, Pencil, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { avatarGradientClass } from "@/lib/avatar-color";
import { updateTeacherProfile, updateTeacherSubjects, setListingPublished, resubmitListing } from "@/lib/dashboard/actions";
import { uploadAvatar } from "@/lib/dashboard/avatar-actions";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import type { ProfileStatus } from "@/types/database";
import { academicTitles } from "@/types/academic-title";

const panelClass = "rounded-lg border border-border bg-white p-5";
const textareaClass =
  "min-h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";
type ClassType = "physical" | "online" | "both";

export function ProfileTab({
  initialHeadline,
  initialBio,
  initialQualifications,
  initialWorkExperience,
  initialExperienceYears,
  initialSubjects,
  initialLanguages,
  initialLocation,
  initialClassType,
  initialHourlyRate,
  initialMonthlyRate,
  initialStatus,
  initialOwnerPublished,
  initialPhotoUrl,
  teacherName,
  isCampusLecturer,
  initialInstitution,
  initialAcademicTitle,
  initialPublications,
  institutionVerified,
  liveView,
}: {
  initialHeadline: string;
  initialBio: string;
  initialQualifications: string[];
  initialWorkExperience: string[];
  initialExperienceYears: string;
  initialSubjects: string[];
  initialLanguages: string[];
  initialLocation: string;
  initialClassType: ClassType;
  initialHourlyRate: string;
  initialMonthlyRate: string;
  initialStatus: ProfileStatus;
  initialOwnerPublished: boolean;
  initialPhotoUrl: string | null;
  teacherName: string;
  /** Campus credentials panel only renders for a `campus_lecturer` account — a regular teacher never sees or writes these fields. */
  isCampusLecturer: boolean;
  initialInstitution: string;
  initialAcademicTitle: string;
  initialPublications: string[];
  /** Admin-only toggle (Admin -> Users) — shown here read-only so a lecturer can see their own status, never editable from this form. */
  institutionVerified: boolean;
  liveView: React.ReactNode;
}) {
  const t = useTranslations("teacherDashboard.profile");
  const tc = useTranslations("teacherDashboard.common");
  const tAcademic = useTranslations("signup.lecturerFields");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  const [mode, setMode] = useState<"edit" | "live">("live");
  const [status, setStatus] = useState(initialStatus);
  const [published, setPublished] = useState(initialOwnerPublished);
  const [publishSaving, setPublishSaving] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function handleTogglePublished(checked: boolean) {
    setPublishSaving(true);
    setPublishError(null);
    const result = await setListingPublished({ kind: "teacher", published: checked });
    setPublishSaving(false);
    if (result.error) {
      setPublishError(result.error);
      return;
    }
    setPublished(checked);
  }

  async function handleResubmit() {
    setPublishSaving(true);
    setPublishError(null);
    const result = await resubmitListing({ kind: "teacher" });
    setPublishSaving(false);
    if (result.error) {
      setPublishError(result.error);
      return;
    }
    setStatus("pending");
  }

  // Subjects is a many-to-many relation (subject_links, resolved by name via
  // the resolve_subject RPC) rather than a column, so it's edited here as a
  // comma-separated list and diffed against subject_links on save. Grade
  // levels shown on the public profile aren't a separate field at all — the
  // RPC that lists teachers derives them from the grade bands of whatever
  // subjects are linked (0021/0026), so there's no "grade levels" input here.
  const [form, setForm] = useState({
    headline: initialHeadline,
    bio: initialBio,
    experience: initialExperienceYears,
    subjects: initialSubjects.join(", "),
    languages: initialLanguages.join(", "),
    location: initialLocation,
    classType: initialClassType,
    hourlyRate: initialHourlyRate,
    monthlyRate: initialMonthlyRate,
  });

  const [qualifications, setQualifications] = useState(initialQualifications);

  function updateQualification(index: number, value: string) {
    setQualifications((qs) => qs.map((q, i) => (i === index ? value : q)));
  }

  function addQualification() {
    setQualifications((qs) => [...qs, ""]);
  }

  function removeQualification(index: number) {
    setQualifications((qs) => qs.filter((_, i) => i !== index));
  }

  const [workExperience, setWorkExperience] = useState(initialWorkExperience);

  function updateWorkExperience(index: number, value: string) {
    setWorkExperience((ws) => ws.map((w, i) => (i === index ? value : w)));
  }

  function addWorkExperience() {
    setWorkExperience((ws) => [...ws, ""]);
  }

  function removeWorkExperience(index: number) {
    setWorkExperience((ws) => ws.filter((_, i) => i !== index));
  }

  const [institution, setInstitution] = useState(initialInstitution);
  const [academicTitle, setAcademicTitle] = useState(initialAcademicTitle);
  const [publications, setPublications] = useState(initialPublications);

  function updatePublication(index: number, value: string) {
    setPublications((ps) => ps.map((p, i) => (i === index ? value : p)));
  }

  function addPublication() {
    setPublications((ps) => [...ps, ""]);
  }

  function removePublication(index: number) {
    setPublications((ps) => ps.filter((_, i) => i !== index));
  }

  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [photoSaved, setPhotoSaved] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(
    field: "headline" | "experience" | "subjects" | "languages" | "location" | "hourlyRate" | "monthlyRate",
  ) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleUploadPhoto() {
    fileInputRef.current?.click();
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPhotoUploading(true);
    setPhotoError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("ownerType", "teacher");
    const result = await uploadAvatar(formData);
    setPhotoUploading(false);
    if (result.error || !result.url) {
      setPhotoError(result.error ?? "Couldn't upload the image. Please try again.");
      return;
    }
    setPhotoUrl(result.url);
    setPhotoSaved(true);
    setTimeout(() => setPhotoSaved(false), 2500);
    // liveView below is a server-rendered snapshot passed in as a prop —
    // needs a refetch to pick up the new photo.
    refresh();
  }

  async function handleSaveChanges() {
    setSaving(true);
    setError(null);
    const [profileResult, subjectsResult] = await Promise.all([
      updateTeacherProfile({
        headline: form.headline,
        bio: form.bio,
        qualifications,
        workExperience,
        experienceYears: form.experience,
        location: form.location,
        classType: form.classType,
        hourlyRate: form.hourlyRate,
        monthlyRate: form.monthlyRate,
        languages: form.languages.split(","),
        // Only ever sent for a campus_lecturer account — otherwise every
        // regular teacher's save would round-trip empty strings into these
        // (harmless, since they're always null for a teacher, but pointless).
        institution: isCampusLecturer ? institution : undefined,
        academicTitle: isCampusLecturer ? academicTitle : undefined,
        publications: isCampusLecturer ? publications : undefined,
      }),
      updateTeacherSubjects(form.subjects.split(",")),
    ]);
    setSaving(false);
    if (profileResult.error || subjectsResult.error) {
      setError(profileResult.error ?? subjectsResult.error ?? null);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    // Same reason as the photo upload above — liveView needs a refetch.
    refresh();
  }

  if (mode === "live") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl">{t("heading")}</h1>
          <Button type="button" onClick={() => setMode("edit")}>
            <Pencil className="size-4" />
            {t("preview.editProfile")}
          </Button>
        </div>

        {status !== "approved" && (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {t("preview.notLiveYet")}
          </p>
        )}
        {status === "approved" && !published && (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {t("preview.hiddenNote")}
          </p>
        )}

        <RefreshStatus
          pending={isRefreshing}
          stuck={refreshStuck}
          pendingLabel={tc("updatingList")}
          stuckLabel={tc("updateStuck")}
          reloadLabel={tc("reloadPage")}
        />

        <div className="overflow-hidden rounded-xl border border-border bg-muted/30">{liveView}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl">{t("heading")}</h1>
        <Button type="button" variant="outline" onClick={() => setMode("live")}>
          <Eye className="size-4" />
          {t("preview.viewLive")}
        </Button>
      </div>

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("photoHeading")}</h3>
        <div className="flex items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              className="size-[76px] shrink-0 rounded-full object-cover shadow-sm"
            />
          ) : (
            <div
              className={`flex size-[76px] shrink-0 items-center justify-center rounded-full font-display text-2xl font-bold text-white shadow-sm ${avatarGradientClass(teacherName)}`}
            >
              {teacherName.charAt(0).toUpperCase()}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoSelected}
          />
          <Button type="button" variant="outline" onClick={handleUploadPhoto} disabled={photoUploading}>
            {t("uploadPhoto")}
          </Button>
          {photoSaved && <span className="text-sm font-medium text-success">{tc("saved")}</span>}
          {photoError && <span className="text-sm font-medium text-destructive">{photoError}</span>}
        </div>
      </div>

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("headlineHeading")}</h3>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="headline">{t("fields.headline")}</Label>
            <Input
              id="headline"
              value={form.headline}
              onChange={update("headline")}
              placeholder={t("headlinePlaceholder")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bio">{t("fields.bio")}</Label>
            <textarea
              id="bio"
              className={textareaClass}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder={t("bioPlaceholder")}
            />
          </div>
        </div>
      </div>

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("qualificationsHeading")}</h3>

        <div className="mb-5 flex flex-col gap-1.5">
          <Label>{t("fields.qualifications")}</Label>
          {qualifications.length > 0 && (
            <div className="flex flex-col gap-2">
              {qualifications.map((qualification, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={qualification}
                    placeholder={t("qualificationPlaceholder")}
                    onChange={(e) => updateQualification(index, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeQualification")}
                    onClick={() => removeQualification(index)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" className="mt-1 self-start" onClick={addQualification}>
            <Plus className="size-4" />
            {t("addQualification")}
          </Button>
        </div>

        <div className="mb-5 flex flex-col gap-1.5">
          <Label>{t("fields.workExperience")}</Label>
          {workExperience.length > 0 && (
            <div className="flex flex-col gap-2">
              {workExperience.map((entry, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={entry}
                    placeholder={t("workExperiencePlaceholder")}
                    onChange={(e) => updateWorkExperience(index, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeWorkExperience")}
                    onClick={() => removeWorkExperience(index)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" className="mt-1 self-start" onClick={addWorkExperience}>
            <Plus className="size-4" />
            {t("addWorkExperience")}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="experience">{t("fields.experience")}</Label>
            <Input id="experience" type="number" min={0} value={form.experience} onChange={update("experience")} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="subjects">{t("fields.subjects")}</Label>
            <Input
              id="subjects"
              value={form.subjects}
              onChange={update("subjects")}
              placeholder={t("subjectsPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("subjectsHint")}</p>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="languages">{t("fields.languages")}</Label>
            <Input
              id="languages"
              value={form.languages}
              onChange={update("languages")}
              placeholder={t("languagesPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("languagesHint")}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">{t("fields.location")}</Label>
            <Input id="location" value={form.location} onChange={update("location")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="classType">{t("fields.classType")}</Label>
            <Select
              value={form.classType}
              onValueChange={(value) => setForm((f) => ({ ...f, classType: value as ClassType }))}
            >
              <SelectTrigger id="classType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="physical">{t("classTypeOptions.physical")}</SelectItem>
                <SelectItem value="online">{t("classTypeOptions.online")}</SelectItem>
                <SelectItem value="both">{t("classTypeOptions.both")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isCampusLecturer && (
        <div className={panelClass}>
          <h3 className="mb-1 text-lg">{t("campusCredentialsHeading")}</h3>
          <p className="mb-4 text-sm text-muted-foreground">{t("campusCredentialsSubtitle")}</p>

          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="institution">{tAcademic("institutionLabel")}</Label>
              <Input
                id="institution"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder={tAcademic("institutionPlaceholder")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="academicTitle">{tAcademic("academicTitleLabel")}</Label>
              <Select value={academicTitle} onValueChange={(value) => setAcademicTitle(value ?? "")}>
                <SelectTrigger id="academicTitle" className="w-full">
                  <SelectValue placeholder={tAcademic("academicTitlePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {academicTitles.map((title) => (
                    <SelectItem key={title} value={title}>
                      {tAcademic(`academicTitles.${title}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("fields.publications")}</Label>
            {publications.length > 0 && (
              <div className="flex flex-col gap-2">
                {publications.map((publication, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={publication}
                      placeholder={t("publicationPlaceholder")}
                      onChange={(e) => updatePublication(index, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("removePublication")}
                      onClick={() => removePublication(index)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" className="mt-1 self-start" onClick={addPublication}>
              <Plus className="size-4" />
              {t("addPublication")}
            </Button>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            {institutionVerified ? (
              <>
                <BadgeCheck className="size-3.5 shrink-0 text-primary" />
                {t("institutionVerifiedNote")}
              </>
            ) : (
              t("institutionNotVerifiedNote")
            )}
          </p>
        </div>
      )}

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("pricingHeading")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hourlyRate">{t("fields.hourlyRate")}</Label>
            <Input id="hourlyRate" type="number" min={0} value={form.hourlyRate} onChange={update("hourlyRate")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="monthlyRate">{t("fields.monthlyRate")}</Label>
            <Input id="monthlyRate" type="number" min={0} value={form.monthlyRate} onChange={update("monthlyRate")} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSaveChanges} disabled={saving}>
          {t("saveChanges")}
        </Button>
        {saved && <span className="text-sm font-medium text-success">{tc("saved")}</span>}
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        <RefreshStatus
          pending={isRefreshing}
          stuck={refreshStuck}
          pendingLabel={tc("updatingList")}
          stuckLabel={tc("updateStuck")}
          reloadLabel={tc("reloadPage")}
        />
      </div>

      <div className={panelClass}>
        <h3 className="mb-1 text-lg">{t("publish.title")}</h3>

        {status === "pending" && <p className="text-sm text-muted-foreground">{t("publish.pending")}</p>}

        {status === "rejected" && (
          <div>
            <p className="mb-3 text-sm text-destructive">{t("publish.rejected")}</p>
            <Button type="button" size="sm" variant="outline" onClick={handleResubmit} disabled={publishSaving}>
              {t("publish.resubmit")}
            </Button>
          </div>
        )}

        {status === "suspended" && <p className="text-sm text-destructive">{t("publish.suspended")}</p>}

        {status === "approved" && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{t("publish.helper")}</p>
            <div className="flex items-center justify-between gap-4">
              <p className={`text-sm font-medium ${published ? "text-success" : "text-muted-foreground"}`}>
                {published ? t("publish.live") : t("publish.hidden")}
              </p>
              <Switch checked={published} onCheckedChange={handleTogglePublished} disabled={publishSaving} />
            </div>
          </>
        )}

        {publishError && <p className="mt-2 text-sm font-medium text-destructive">{publishError}</p>}
      </div>
    </div>
  );
}
