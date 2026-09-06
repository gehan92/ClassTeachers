"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Pencil,
  Check,
  Plus,
  X,
  Camera,
  User,
  FileText,
  GraduationCap,
  Trophy,
  Tags,
  Clock,
  Mail,
  Phone,
  MapPin,
  BookOpen,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/dashboard/stat-card";
import { avatarGradientClass } from "@/lib/avatar-color";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { updateStudentProfile } from "@/lib/dashboard/actions";
import { uploadAvatar } from "@/lib/dashboard/avatar-actions";

const panelClass = "rounded-lg border border-border bg-white p-5";
const textareaClass =
  "min-h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";
type EducationLevel = "school" | "campus" | "graduated";
const EDUCATION_LEVELS: EducationLevel[] = ["school", "campus", "graduated"];
type PreferredMode = "online" | "in_person" | "both";
const PREFERRED_MODES: PreferredMode[] = ["online", "in_person", "both"];

// Age is shown, not the raw date of birth — more useful at a glance and it
// stays correct year over year without anyone editing it. Stored as a date
// (not a maintained age number) so this is the only place it's computed.
function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// A light nudge (LinkedIn-style "profile strength") rather than a hard
// requirement — every field here is optional, this just encourages filling
// them in. Name/grade/email are excluded since those are set at signup.
function computeCompleteness(input: {
  photoUrl: string | null;
  bio: string;
  dateOfBirth: string | null;
  location: string;
  learningGoals: string;
  educationLevel: EducationLevel | null;
  institutionName: string;
  qualifications: string[];
  subjects: string[];
  languages: string[];
  achievements: string[];
  interests: string[];
  preferredMode: PreferredMode | null;
  availability: string;
  phone: string;
}): number {
  const checks = [
    Boolean(input.photoUrl),
    Boolean(input.bio),
    Boolean(input.dateOfBirth),
    Boolean(input.location),
    Boolean(input.learningGoals),
    Boolean(input.educationLevel),
    Boolean(input.institutionName),
    input.qualifications.length > 0,
    input.subjects.length > 0,
    input.languages.length > 0,
    input.achievements.length > 0,
    input.interests.length > 0,
    Boolean(input.preferredMode),
    Boolean(input.availability),
    Boolean(input.phone),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function ProfileTab({
  initialName,
  initialPhone,
  initialGrade,
  initialPhotoUrl,
  initialBio,
  initialEducationLevel,
  initialInstitutionName,
  initialQualifications,
  initialWorkExperience,
  initialSubjects,
  initialLanguages,
  initialSharePhoneWithTeachers,
  initialDateOfBirth,
  initialLocation,
  initialLearningGoals,
  initialPreferredMode,
  initialAchievements,
  initialInterests,
  initialAvailability,
  classesCount,
  email,
}: {
  initialName: string;
  initialPhone: string;
  initialGrade: string;
  initialPhotoUrl: string | null;
  initialBio: string;
  initialEducationLevel: EducationLevel | null;
  initialInstitutionName: string;
  initialQualifications: string[];
  initialWorkExperience: string[];
  initialSubjects: string[];
  initialLanguages: string[];
  initialSharePhoneWithTeachers: boolean;
  initialDateOfBirth: string | null;
  initialLocation: string;
  initialLearningGoals: string;
  initialPreferredMode: PreferredMode | null;
  initialAchievements: string[];
  initialInterests: string[];
  initialAvailability: string;
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
        // Same outer wrapper as the teacher tab's live view (a single
        // shared rounded/bordered/muted-bg container around everything)
        // rather than each panel just floating on the page background —
        // that wrapper is what gives the teacher card its inset,
        // centered-with-a-border look.
        <div className="overflow-hidden rounded-xl border border-border bg-muted/30 p-5 sm:p-7">
          <div className="flex flex-col gap-5">
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
              sharePhoneWithTeachers={initialSharePhoneWithTeachers}
              dateOfBirth={initialDateOfBirth}
              location={initialLocation}
              learningGoals={initialLearningGoals}
              preferredMode={initialPreferredMode}
              achievements={initialAchievements}
              interests={initialInterests}
              availability={initialAvailability}
              onEdit={() => setMode("edit")}
            />
          </div>
        </div>
      ) : (
        <>
          <PhotoPanel initialPhotoUrl={initialPhotoUrl} studentName={initialName} />
          <EditForm
            initialName={initialName}
            initialGrade={initialGrade}
            initialBio={initialBio}
            initialEducationLevel={initialEducationLevel}
            initialInstitutionName={initialInstitutionName}
            initialQualifications={initialQualifications}
            initialWorkExperience={initialWorkExperience}
            initialSubjects={initialSubjects}
            initialLanguages={initialLanguages}
            initialDateOfBirth={initialDateOfBirth}
            initialLocation={initialLocation}
            initialLearningGoals={initialLearningGoals}
            initialPreferredMode={initialPreferredMode}
            initialAchievements={initialAchievements}
            initialInterests={initialInterests}
            initialAvailability={initialAvailability}
          />
        </>
      )}
    </div>
  );
}

function educationLabel(t: ReturnType<typeof useTranslations>, level: EducationLevel | null) {
  if (!level) return null;
  return t(`educationOptions.${level}`);
}

/** Shared section heading style (icon + label) for both view and edit panels. */
function SectionHeading({
  icon: Icon,
  className = "mb-4",
  children,
}: {
  icon: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className={`${className} flex items-center gap-2 text-lg`}>
      <Icon className="size-[18px] text-primary" />
      {children}
    </h3>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  hint,
  truncate,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-sm font-medium text-foreground ${truncate ? "truncate" : ""}`}>{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

/** LinkedIn-style "profile strength" nudge — hidden once every optional field is filled in. */
function CompletenessCard({ percent, onEdit }: { percent: number; onEdit: () => void }) {
  const t = useTranslations("studentDashboard.profile");
  if (percent >= 100) return null;

  return (
    <div className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t("completeness.heading")}</h3>
        </div>
        <span className="text-sm font-medium text-primary">{t("completeness.percentLabel", { percent })}</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          {t("completeness.cta")}
        </Button>
      </div>
    </div>
  );
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
  sharePhoneWithTeachers,
  dateOfBirth,
  location,
  learningGoals,
  preferredMode,
  achievements,
  interests,
  availability,
  onEdit,
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
  sharePhoneWithTeachers: boolean;
  dateOfBirth: string | null;
  location: string;
  learningGoals: string;
  preferredMode: PreferredMode | null;
  achievements: string[];
  interests: string[];
  availability: string;
  onEdit: () => void;
}) {
  const t = useTranslations("studentDashboard.profile");
  const statusLabel = educationLabel(t, educationLevel);
  const age = calculateAge(dateOfBirth);
  const percent = computeCompleteness({
    photoUrl,
    bio,
    dateOfBirth,
    location,
    learningGoals,
    educationLevel,
    institutionName,
    qualifications,
    subjects,
    languages,
    achievements,
    interests,
    preferredMode,
    availability,
    phone,
  });

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
              className="mx-auto size-20 shrink-0 rounded-full border-4 border-white object-cover shadow-md sm:mx-0"
            />
          ) : (
            <div
              className={`mx-auto flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white font-display text-2xl font-bold text-white shadow-md sm:mx-0 ${avatarGradientClass(name)}`}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {grade && (
              <div className="mb-1.5 font-mono text-xs uppercase tracking-[0.12em] text-white/70">{grade}</div>
            )}
            <h1 className="mb-2 text-[28px] text-white sm:text-[34px]">{name}</h1>
            {(statusLabel || age !== null || location) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/85">
                {statusLabel && (
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">{statusLabel}</span>
                )}
                {age !== null && <span>{t("ageLabel", { age })}</span>}
                {location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {location}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <CompletenessCard percent={percent} onEdit={onEdit} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("classesJoinedLabel")} value={classesCount} icon={BookOpen} tone="primary" />
        <StatCard label={t("subjectsCountLabel")} value={subjects.length} icon={Tags} tone="success" />
        <StatCard label={t("achievementsCountLabel")} value={achievements.length} icon={Trophy} tone="cta" />
      </div>

      <div className={panelClass}>
        <SectionHeading icon={Mail}>{t("contactHeading")}</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ContactRow icon={Mail} label={t("emailLabel")} value={email} truncate />
          <ContactRow
            icon={Phone}
            label={t("phoneLabel")}
            value={phone || "—"}
            hint={phone ? (sharePhoneWithTeachers ? t("phoneVisibleToTeachers") : t("phoneHiddenFromTeachers")) : undefined}
          />
        </div>
      </div>

      {(bio || learningGoals) && (
        <div className={panelClass}>
          <SectionHeading icon={FileText} className="mb-2">
            {t("aboutHeading")}
          </SectionHeading>
          {bio && <p className="text-sm whitespace-pre-line text-foreground/85">{bio}</p>}
          {learningGoals && (
            <div className={bio ? "mt-4" : ""}>
              <div className="mb-1 text-xs text-muted-foreground">{t("fields.learningGoals")}</div>
              <p className="text-sm font-medium text-foreground">{learningGoals}</p>
            </div>
          )}
        </div>
      )}

      {(institutionName || qualifications.length > 0 || workExperience.length > 0) && (
        <div className={panelClass}>
          <SectionHeading icon={GraduationCap}>{t("educationHeading")}</SectionHeading>
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

      {achievements.length > 0 && (
        <div className={panelClass}>
          <SectionHeading icon={Trophy} className="mb-3">
            {t("achievementsHeading")}
          </SectionHeading>
          <ul className="flex flex-col gap-1">
            {achievements.map((achievement, i) => (
              <li key={i} className="text-sm font-medium text-foreground">
                {achievement}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(subjects.length > 0 || languages.length > 0 || interests.length > 0) && (
        <div className={panelClass}>
          <SectionHeading icon={Tags}>{t("tagsHeading")}</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {subjects.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs text-muted-foreground">{t("fields.subjects")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {subjects.map((subject, i) => (
                    <span key={i} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
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
                    <span key={i} className="rounded-full bg-cta/15 px-2.5 py-1 text-xs font-medium text-accent-deep">
                      {language}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {interests.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs text-muted-foreground">{t("fields.interests")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {interests.map((interest, i) => (
                    <span key={i} className="rounded-full bg-background px-2.5 py-1 text-xs text-foreground">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(preferredMode || availability) && (
        <div className={panelClass}>
          <SectionHeading icon={Clock}>{t("preferencesHeading")}</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {preferredMode && (
              <div>
                <div className="text-xs text-muted-foreground">{t("fields.preferredMode")}</div>
                <div className="text-sm font-medium text-foreground">{t(`preferredModeOptions.${preferredMode}`)}</div>
              </div>
            )}
            {availability && (
              <div>
                <div className="text-xs text-muted-foreground">{t("fields.availability")}</div>
                <div className="text-sm font-medium text-foreground">{availability}</div>
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
      <SectionHeading icon={Camera}>{t("photoHeading")}</SectionHeading>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={uploading}
          aria-label={t("uploadPhoto")}
          className="group relative size-[76px] shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
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
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
            <Camera className="size-5" />
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handlePhotoSelected}
        />
        <div className="flex flex-col gap-1.5">
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={handleUploadClick} disabled={uploading}>
            {t("uploadPhoto")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("photoHint")}</span>
        </div>
        {saved && <span className="animate-in fade-in-0 text-sm font-medium text-success duration-200">{t("saved")}</span>}
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>
    </div>
  );
}

/**
 * Add/remove list of free-text entries — used for qualifications, work
 * experience, subjects, languages, achievements and interests so a student
 * adds one entry at a time instead of typing a comma-separated string into
 * a single Input. Same shape as the teacher profile tab's qualifications/
 * work-experience lists.
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
 * One shared save button for everything below — each panel is visually
 * separate but a single form/save action, same shape as the teacher profile
 * tab's several panels sharing one "Save changes" button at the bottom.
 * Photo saves immediately on upload instead (see PhotoPanel), so it isn't
 * part of this form.
 */
function EditForm({
  initialName,
  initialGrade,
  initialBio,
  initialEducationLevel,
  initialInstitutionName,
  initialQualifications,
  initialWorkExperience,
  initialSubjects,
  initialLanguages,
  initialDateOfBirth,
  initialLocation,
  initialLearningGoals,
  initialPreferredMode,
  initialAchievements,
  initialInterests,
  initialAvailability,
}: {
  initialName: string;
  initialGrade: string;
  initialBio: string;
  initialEducationLevel: EducationLevel | null;
  initialInstitutionName: string;
  initialQualifications: string[];
  initialWorkExperience: string[];
  initialSubjects: string[];
  initialLanguages: string[];
  initialDateOfBirth: string | null;
  initialLocation: string;
  initialLearningGoals: string;
  initialPreferredMode: PreferredMode | null;
  initialAchievements: string[];
  initialInterests: string[];
  initialAvailability: string;
}) {
  const t = useTranslations("studentDashboard.profile");
  const nameId = useId();
  const gradeId = useId();
  const dobId = useId();
  const locationId = useId();
  const bioId = useId();
  const learningGoalsId = useId();
  const institutionId = useId();
  const availabilityId = useId();
  const { refresh } = useDashboardRefresh();

  const [form, setForm] = useState({
    name: initialName,
    grade: initialGrade,
    dateOfBirth: initialDateOfBirth ?? "",
    location: initialLocation,
    bio: initialBio,
    learningGoals: initialLearningGoals,
    educationLevel: initialEducationLevel ?? ("" as EducationLevel | ""),
    institutionName: initialInstitutionName,
    preferredMode: initialPreferredMode ?? ("" as PreferredMode | ""),
    availability: initialAvailability,
  });
  const [qualifications, setQualifications] = useState(initialQualifications);
  const [workExperience, setWorkExperience] = useState(initialWorkExperience);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [languages, setLanguages] = useState(initialLanguages);
  const [achievements, setAchievements] = useState(initialAchievements);
  const [interests, setInterests] = useState(initialInterests);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(field: "name" | "grade" | "dateOfBirth" | "location" | "institutionName" | "availability") {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateStudentProfile({
      fullName: form.name,
      gradeLevel: form.grade,
      bio: form.bio,
      educationLevel: form.educationLevel,
      institutionName: form.institutionName,
      qualifications,
      workExperience,
      subjects,
      languages,
      dateOfBirth: form.dateOfBirth,
      location: form.location,
      learningGoals: form.learningGoals,
      preferredMode: form.preferredMode,
      achievements,
      interests,
      availability: form.availability,
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
        <SectionHeading icon={User}>{t("personalDetailsHeading")}</SectionHeading>
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
            <Label htmlFor={dobId} className="mb-1.5">
              {t("fields.dateOfBirth")}
            </Label>
            <Input id={dobId} type="date" value={form.dateOfBirth} onChange={update("dateOfBirth")} />
          </div>
          <div>
            <Label htmlFor={locationId} className="mb-1.5">
              {t("fields.location")}
            </Label>
            <Input
              id={locationId}
              value={form.location}
              onChange={update("location")}
              placeholder={t("locationPlaceholder")}
            />
          </div>
        </div>
      </div>

      <div className={panelClass}>
        <SectionHeading icon={FileText}>{t("aboutHeading")}</SectionHeading>
        <div className="flex flex-col gap-4">
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={learningGoalsId}>{t("fields.learningGoals")}</Label>
            <Input
              id={learningGoalsId}
              value={form.learningGoals}
              onChange={(e) => setForm((f) => ({ ...f, learningGoals: e.target.value }))}
              placeholder={t("learningGoalsPlaceholder")}
            />
          </div>
        </div>
      </div>

      <div className={panelClass}>
        <SectionHeading icon={GraduationCap}>{t("educationHeading")}</SectionHeading>
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
        </div>
      </div>

      <div className={panelClass}>
        <SectionHeading icon={Trophy}>{t("achievementsHeading")}</SectionHeading>
        <RepeatableListField
          label={t("fields.achievements")}
          items={achievements}
          onChange={setAchievements}
          placeholder={t("achievementPlaceholder")}
          addLabel={t("addAchievement")}
          removeLabel={t("removeAchievement")}
        />
      </div>

      <div className={panelClass}>
        <SectionHeading icon={Tags}>{t("tagsHeading")}</SectionHeading>
        <div className="flex flex-col gap-5">
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
          <RepeatableListField
            label={t("fields.interests")}
            items={interests}
            onChange={setInterests}
            placeholder={t("interestPlaceholder")}
            addLabel={t("addInterest")}
            removeLabel={t("removeInterest")}
          />
        </div>
      </div>

      <div className={panelClass}>
        <SectionHeading icon={Clock}>{t("preferencesHeading")}</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t("fields.preferredMode")}</Label>
            <Select
              value={form.preferredMode}
              onValueChange={(value) => setForm((f) => ({ ...f, preferredMode: (value as PreferredMode) ?? "" }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("preferredModePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {PREFERRED_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {t(`preferredModeOptions.${mode}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={availabilityId}>{t("fields.availability")}</Label>
            <Input
              id={availabilityId}
              value={form.availability}
              onChange={update("availability")}
              placeholder={t("availabilityPlaceholder")}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {t("saveChanges")}
        </Button>
        {saved && <span className="animate-in fade-in-0 text-sm font-medium text-success duration-200">{t("saved")}</span>}
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>
    </>
  );
}
