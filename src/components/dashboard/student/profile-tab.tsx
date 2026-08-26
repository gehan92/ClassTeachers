"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Check, Plus, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { avatarGradientClass } from "@/lib/avatar-color";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { updateStudentProfile, updateNotificationPrefs } from "@/lib/dashboard/actions";
import { uploadAvatar } from "@/lib/dashboard/avatar-actions";

const panelClass = "rounded-lg border border-border bg-white p-5";
const textareaClass =
  "min-h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";
type EducationLevel = "school" | "campus" | "graduated";
const EDUCATION_LEVELS: EducationLevel[] = ["school", "campus", "graduated"];

export function ProfileTab({
  initialName,
  initialPhone,
  initialGrade,
  initialNotificationPrefs,
  initialPhotoUrl,
  initialBio,
  initialEducationLevel,
  initialInstitutionName,
  initialQualifications,
  initialWorkExperience,
  initialSubjects,
  initialLanguages,
  classesCount,
  email,
}: {
  initialName: string;
  initialPhone: string;
  initialGrade: string;
  initialNotificationPrefs: Record<string, boolean>;
  initialPhotoUrl: string | null;
  initialBio: string;
  initialEducationLevel: EducationLevel | null;
  initialInstitutionName: string;
  initialQualifications: string[];
  initialWorkExperience: string[];
  initialSubjects: string[];
  initialLanguages: string[];
  classesCount: number;
  email: string;
}) {
  const t = useTranslations("studentDashboard.profile");
  // Defaults to a read-only summary card (view mode) instead of dropping
  // straight into the edit form — matches the teacher profile tab's
  // live/edit toggle. View mode reads straight from the server-rendered
  // props, the same as the teacher tab's `liveView`; the edit form calls
  // refresh() on save, so switching back to view always reflects the
  // latest save.
  const [mode, setMode] = useState<"view" | "edit">("view");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl">{t("profileTitle")}</h1>
        {mode === "view" ? (
          <Button type="button" onClick={() => setMode("edit")}>
            <Pencil className="size-4" />
            {t("editProfile")}
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => setMode("view")}>
            <Check className="size-4" />
            {t("doneEditing")}
          </Button>
        )}
      </div>

      {mode === "view" ? (
        <ProfileCard
          name={initialName}
          grade={initialGrade}
          phone={initialPhone}
          email={email}
          photoUrl={initialPhotoUrl}
          classesCount={classesCount}
          bio={initialBio}
          educationLevel={initialEducationLevel}
          institutionName={initialInstitutionName}
          qualifications={initialQualifications}
          workExperience={initialWorkExperience}
          subjects={initialSubjects}
          languages={initialLanguages}
        />
      ) : (
        <>
          <PhotoPanel initialPhotoUrl={initialPhotoUrl} studentName={initialName} />
          <EditForm
            initialName={initialName}
            initialPhone={initialPhone}
            initialGrade={initialGrade}
            initialBio={initialBio}
            initialEducationLevel={initialEducationLevel}
            initialInstitutionName={initialInstitutionName}
            initialQualifications={initialQualifications}
            initialWorkExperience={initialWorkExperience}
            initialSubjects={initialSubjects}
            initialLanguages={initialLanguages}
            email={email}
          />
        </>
      )}

      <NotificationsPanel initialPrefs={initialNotificationPrefs} />
    </div>
  );
}

function educationLabel(t: ReturnType<typeof useTranslations>, level: EducationLevel | null) {
  if (!level) return null;
  return t(`educationOptions.${level}`);
}

function ProfileCard({
  name,
  grade,
  phone,
  email,
  photoUrl,
  classesCount,
  bio,
  educationLevel,
  institutionName,
  qualifications,
  workExperience,
  subjects,
  languages,
}: {
  name: string;
  grade: string;
  phone: string;
  email: string;
  photoUrl: string | null;
  classesCount: number;
  bio: string;
  educationLevel: EducationLevel | null;
  institutionName: string;
  qualifications: string[];
  workExperience: string[];
  subjects: string[];
  languages: string[];
}) {
  const t = useTranslations("studentDashboard.profile");
  const statusLabel = educationLabel(t, educationLevel);

  return (
    <>
      {/* Same gradient-hero visual language as the teacher public-profile
       * card (TeacherProfileView's Hero) — purely for consistency between
       * the two dashboards. Unlike that one, this card is never public: no
       * rating/join-button, and it's fine to show email/phone here since
       * this is the student's own private view of their own account. */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary-light p-7 text-white sm:p-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL
            <img
              src={photoUrl}
              alt=""
              className="mx-auto size-28 shrink-0 rounded-full border-4 border-white object-cover shadow-md sm:mx-0"
            />
          ) : (
            <div
              className={`mx-auto flex size-28 shrink-0 items-center justify-center rounded-full border-4 border-white font-display text-3xl font-bold text-white shadow-md sm:mx-0 ${avatarGradientClass(name)}`}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {grade && (
              <div className="mb-1.5 font-mono text-xs uppercase tracking-[0.12em] text-white/70">{grade}</div>
            )}
            <h1 className="mb-2 text-[28px] text-white sm:text-[34px]">{name}</h1>
            {statusLabel && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/85">
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">{statusLabel}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={panelClass}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">{t("classesJoinedLabel")}</div>
            <div className="text-sm font-medium text-foreground">{classesCount}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t("emailLabel")}</div>
            <div className="truncate text-sm font-medium text-foreground">{email}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t("phoneLabel")}</div>
            <div className="text-sm font-medium text-foreground">{phone || "—"}</div>
          </div>
        </div>
      </div>

      {bio && (
        <div className={panelClass}>
          <h3 className="mb-2 text-lg">{t("aboutHeading")}</h3>
          <p className="text-sm whitespace-pre-line text-foreground/85">{bio}</p>
        </div>
      )}

      {(institutionName || qualifications.length > 0 || workExperience.length > 0) && (
        <div className={panelClass}>
          <h3 className="mb-4 text-lg">{t("educationHeading")}</h3>
          <div className="flex flex-col gap-4">
            {institutionName && (
              <div>
                <div className="text-xs text-muted-foreground">{t("fields.institutionName")}</div>
                <div className="text-sm font-medium text-foreground">{institutionName}</div>
              </div>
            )}
            {qualifications.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs text-muted-foreground">{t("fields.qualifications")}</div>
                <ul className="flex flex-col gap-1">
                  {qualifications.map((qualification, i) => (
                    <li key={i} className="text-sm font-medium text-foreground">
                      {qualification}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {workExperience.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs text-muted-foreground">{t("fields.workExperience")}</div>
                <ul className="flex flex-col gap-1">
                  {workExperience.map((entry, i) => (
                    <li key={i} className="text-sm font-medium text-foreground">
                      {entry}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {(subjects.length > 0 || languages.length > 0) && (
        <div className={panelClass}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {subjects.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs text-muted-foreground">{t("fields.subjects")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {subjects.map((subject, i) => (
                    <span key={i} className="rounded-full bg-background px-2.5 py-1 text-xs text-foreground">
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {languages.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs text-muted-foreground">{t("fields.languages")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {languages.map((language, i) => (
                    <span key={i} className="rounded-full bg-background px-2.5 py-1 text-xs text-foreground">
                      {language}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PhotoPanel({ initialPhotoUrl, studentName }: { initialPhotoUrl: string | null; studentName: string }) {
  const t = useTranslations("studentDashboard.profile");
  const { refresh } = useDashboardRefresh();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("ownerType", "student");
    const result = await uploadAvatar(formData);
    setUploading(false);
    if (result.error || !result.url) {
      setError(result.error ?? "Couldn't upload the image. Please try again.");
      return;
    }
    setPhotoUrl(result.url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    // The dashboard shell's header avatar is a server-rendered prop — needs
    // a refetch to pick up the new photo.
    refresh();
  }

  return (
    <div className={panelClass}>
      <h3 className="mb-4 text-lg">{t("photoHeading")}</h3>
      <div className="flex items-center gap-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL
          <img src={photoUrl} alt="" className="size-[76px] shrink-0 rounded-full object-cover shadow-sm" />
        ) : (
          <div
            className={`flex size-[76px] shrink-0 items-center justify-center rounded-full font-display text-2xl font-bold text-white shadow-sm ${avatarGradientClass(studentName)}`}
          >
            {studentName.charAt(0).toUpperCase()}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handlePhotoSelected}
        />
        <Button type="button" variant="outline" onClick={handleUploadClick} disabled={uploading}>
          {t("uploadPhoto")}
        </Button>
        {saved && <span className="text-sm font-medium text-success">{t("saved")}</span>}
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>
    </div>
  );
}

/**
 * Add/remove list of free-text entries — used for qualifications, work
 * experience, subjects and languages so a student adds one entry at a time
 * instead of typing a comma-separated string into a single Input. Same
 * shape as the teacher profile tab's qualifications/work-experience lists.
 */
function RepeatableListField({
  label,
  items,
  onChange,
  placeholder,
  addLabel,
  removeLabel,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
  removeLabel: string;
}) {
  function updateItem(index: number, value: string) {
    onChange(items.map((item, i) => (i === index ? value : item)));
  }

  function addItem() {
    onChange([...items, ""]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input value={item} placeholder={placeholder} onChange={(e) => updateItem(index, e.target.value)} />
              <Button type="button" variant="ghost" size="icon" aria-label={removeLabel} onClick={() => removeItem(index)}>
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" className="mt-1 self-start" onClick={addItem}>
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}

/**
 * One shared save button for everything below — Personal details, About me
 * and Education are visually separate panels but a single form/save action,
 * same shape as the teacher profile tab's several panels sharing one
 * "Save changes" button at the bottom. Photo saves immediately on upload
 * instead (see PhotoPanel), so it isn't part of this form.
 */
function EditForm({
  initialName,
  initialPhone,
  initialGrade,
  initialBio,
  initialEducationLevel,
  initialInstitutionName,
  initialQualifications,
  initialWorkExperience,
  initialSubjects,
  initialLanguages,
  email,
}: {
  initialName: string;
  initialPhone: string;
  initialGrade: string;
  initialBio: string;
  initialEducationLevel: EducationLevel | null;
  initialInstitutionName: string;
  initialQualifications: string[];
  initialWorkExperience: string[];
  initialSubjects: string[];
  initialLanguages: string[];
  email: string;
}) {
  const t = useTranslations("studentDashboard.profile");
  const nameId = useId();
  const gradeId = useId();
  const emailId = useId();
  const phoneId = useId();
  const bioId = useId();
  const institutionId = useId();
  const { refresh } = useDashboardRefresh();

  const [form, setForm] = useState({
    name: initialName,
    grade: initialGrade,
    phone: initialPhone,
    bio: initialBio,
    educationLevel: initialEducationLevel ?? ("" as EducationLevel | ""),
    institutionName: initialInstitutionName,
  });
  const [qualifications, setQualifications] = useState(initialQualifications);
  const [workExperience, setWorkExperience] = useState(initialWorkExperience);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [languages, setLanguages] = useState(initialLanguages);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(field: "name" | "grade" | "phone" | "institutionName") {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateStudentProfile({
      fullName: form.name,
      phone: form.phone,
      gradeLevel: form.grade,
      bio: form.bio,
      educationLevel: form.educationLevel,
      institutionName: form.institutionName,
      qualifications,
      workExperience,
      subjects,
      languages,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    // The dashboard shell's header avatar/name comes from the server page,
    // not this component's own state — without a refresh it keeps showing
    // the old name until a hard reload.
    refresh();
  }

  return (
    <>
      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("personalDetailsHeading")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={nameId} className="mb-1.5">
              {t("nameLabel")}
            </Label>
            <Input id={nameId} value={form.name} onChange={update("name")} />
          </div>
          <div>
            <Label htmlFor={gradeId} className="mb-1.5">
              {t("gradeLabel")}
            </Label>
            <Input id={gradeId} value={form.grade} onChange={update("grade")} />
          </div>
          <div>
            <Label htmlFor={emailId} className="mb-1.5">
              {t("emailLabel")}
            </Label>
            <Input id={emailId} type="email" value={email} readOnly disabled />
          </div>
          <div>
            <Label htmlFor={phoneId} className="mb-1.5">
              {t("phoneLabel")}
            </Label>
            <Input id={phoneId} type="tel" value={form.phone} onChange={update("phone")} />
          </div>
        </div>
      </div>

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("aboutHeading")}</h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={bioId}>{t("fields.bio")}</Label>
          <textarea
            id={bioId}
            className={textareaClass}
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder={t("bioPlaceholder")}
          />
        </div>
      </div>

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("educationHeading")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t("fields.educationLevel")}</Label>
            <Select
              value={form.educationLevel}
              onValueChange={(value) => setForm((f) => ({ ...f, educationLevel: (value as EducationLevel) ?? "" }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("educationLevelPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {t(`educationOptions.${level}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={institutionId}>{t("fields.institutionName")}</Label>
            <Input
              id={institutionId}
              value={form.institutionName}
              onChange={update("institutionName")}
              placeholder={t("institutionPlaceholder")}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          <RepeatableListField
            label={t("fields.qualifications")}
            items={qualifications}
            onChange={setQualifications}
            placeholder={t("qualificationPlaceholder")}
            addLabel={t("addQualification")}
            removeLabel={t("removeQualification")}
          />
          <RepeatableListField
            label={t("fields.workExperience")}
            items={workExperience}
            onChange={setWorkExperience}
            placeholder={t("workExperiencePlaceholder")}
            addLabel={t("addWorkExperience")}
            removeLabel={t("removeWorkExperience")}
          />
          <RepeatableListField
            label={t("fields.subjects")}
            items={subjects}
            onChange={setSubjects}
            placeholder={t("subjectsPlaceholder")}
            addLabel={t("addSubject")}
            removeLabel={t("removeSubject")}
          />
          <RepeatableListField
            label={t("fields.languages")}
            items={languages}
            onChange={setLanguages}
            placeholder={t("languagesPlaceholder")}
            addLabel={t("addLanguage")}
            removeLabel={t("removeLanguage")}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {t("saveChanges")}
        </Button>
        {saved && <span className="text-sm font-medium text-success">{t("saved")}</span>}
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          {t("changePassword")}
        </Link>
      </div>
    </>
  );
}

function NotificationsPanel({ initialPrefs }: { initialPrefs: Record<string, boolean> }) {
  const t = useTranslations("studentDashboard.profile");
  const [newNotes, setNewNotes] = useState(initialPrefs.newNotes ?? true);
  const [liveReminders, setLiveReminders] = useState(initialPrefs.liveReminders ?? true);
  const [examGraded, setExamGraded] = useState(initialPrefs.examGraded ?? true);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const newNotesId = useId();
  const liveRemindersId = useId();
  const examGradedId = useId();

  // Optimistic toggle: flips immediately for responsiveness, then reverts
  // itself (`current` is the pre-toggle value, captured fresh each render)
  // and shows an error if the save actually failed — previously the switch
  // just stayed flipped regardless of whether updateNotificationPrefs
  // succeeded, since its result was never checked.
  function handleToggle(key: string, current: boolean, setter: (value: boolean) => void) {
    return async (checked: boolean) => {
      setter(checked);
      setToggleError(null);
      const result = await updateNotificationPrefs({ [key]: checked });
      if (result.error) {
        setter(current);
        setToggleError(result.error);
      }
    };
  }

  return (
    <div className={panelClass}>
      <h3 className="mb-4 text-lg">{t("notificationsTitle")}</h3>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={newNotesId}>{t("notifNewNotes")}</Label>
          <Switch
            id={newNotesId}
            checked={newNotes}
            onCheckedChange={handleToggle("newNotes", newNotes, setNewNotes)}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={liveRemindersId}>{t("notifLiveReminders")}</Label>
          <Switch
            id={liveRemindersId}
            checked={liveReminders}
            onCheckedChange={handleToggle("liveReminders", liveReminders, setLiveReminders)}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={examGradedId}>{t("notifExamGraded")}</Label>
          <Switch
            id={examGradedId}
            checked={examGraded}
            onCheckedChange={handleToggle("examGraded", examGraded, setExamGraded)}
          />
        </div>
      </div>
      {toggleError && <p className="mt-3 text-sm font-medium text-destructive">{toggleError}</p>}
    </div>
  );
}
