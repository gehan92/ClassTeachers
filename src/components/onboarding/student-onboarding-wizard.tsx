"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateStudentProfile } from "@/lib/dashboard/actions";
import { uploadAvatar } from "@/lib/dashboard/avatar-actions";
import { completeOnboarding } from "@/lib/onboarding/actions";
import { WizardShell } from "./wizard-shell";

const textareaClass =
  "min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type EducationLevel = "school" | "campus" | "graduated";
const EDUCATION_LEVELS: EducationLevel[] = ["school", "campus", "graduated"];
type PreferredMode = "online" | "in_person" | "both";
const PREFERRED_MODES: PreferredMode[] = ["online", "in_person", "both"];

export type StudentOnboardingInitial = {
  fullName: string;
  dateOfBirth: string;
  educationLevel: EducationLevel | "";
  gradeLevel: string;
  location: string;
  preferredMode: PreferredMode | "";
  subjects: string;
  learningGoals: string;
  languages: string;
  achievements: string;
  interests: string;
};

const STEP_COUNT = 4;

/**
 * Fields the wizard doesn't ask (bio, institutionName, qualifications,
 * workExperience, availability) stay empty until the student fills them in
 * later via the regular Profile tab — updateStudentProfile requires the
 * full shape on every call, so this just carries those through as empty
 * rather than expanding the wizard to cover every field the profile table
 * has room for.
 */
export function StudentOnboardingWizard({ initial }: { initial: StudentOnboardingInitial }) {
  const t = useTranslations("onboarding.student");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth);
  const [educationLevel, setEducationLevel] = useState<EducationLevel | "">(initial.educationLevel);
  const [gradeLevel, setGradeLevel] = useState(initial.gradeLevel);
  const [location, setLocation] = useState(initial.location);
  const [preferredMode, setPreferredMode] = useState<PreferredMode | "">(initial.preferredMode);
  const [subjects, setSubjects] = useState(initial.subjects);
  const [learningGoals, setLearningGoals] = useState(initial.learningGoals);
  const [languages, setLanguages] = useState(initial.languages);
  const [achievements, setAchievements] = useState(initial.achievements);
  const [interests, setInterests] = useState(initial.interests);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  function toList(v: string) {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function persist() {
    return updateStudentProfile({
      fullName: initial.fullName,
      gradeLevel,
      bio: "",
      educationLevel,
      institutionName: "",
      qualifications: [],
      workExperience: [],
      subjects: toList(subjects),
      languages: toList(languages),
      dateOfBirth,
      location,
      learningGoals,
      preferredMode,
      achievements: toList(achievements),
      interests: toList(interests),
      availability: "",
    });
  }

  async function handleNext() {
    setSaving(true);
    setError(null);
    const result = await persist();
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (step < STEP_COUNT - 1) {
      setStep((s) => s + 1);
      return;
    }
    const finishResult = await completeOnboarding();
    if (finishResult.error) {
      setError(finishResult.error);
      return;
    }
    router.refresh();
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("ownerType", "student");
    const result = await uploadAvatar(formData);
    setPhotoUploading(false);
    if (result.error || !result.url) {
      setError(result.error ?? "Couldn't upload the image. Please try again.");
      return;
    }
    setPhotoUrl(result.url);
  }

  const stepDefs = [
    {
      title: t("step1.title"),
      nextDisabled: !dateOfBirth || !educationLevel || (educationLevel === "school" && !gradeLevel.trim()),
      body: (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="dob">{t("step1.dobLabel")}</Label>
            <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edu-level">{t("step1.educationLabel")}</Label>
            <Select value={educationLevel} onValueChange={(v) => setEducationLevel((v as EducationLevel) ?? "")}>
              <SelectTrigger id="edu-level" className="w-full">
                <SelectValue placeholder={t("step1.educationPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {t(`educationLevels.${level}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {educationLevel === "school" && (
            <div className="grid gap-1.5">
              <Label htmlFor="grade">{t("step1.gradeLabel")}</Label>
              <Input
                id="grade"
                placeholder={t("step1.gradePlaceholder")}
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
              />
            </div>
          )}
        </>
      ),
    },
    {
      title: t("step2.title"),
      nextDisabled: !location.trim() || !preferredMode,
      body: (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="location">{t("step2.locationLabel")}</Label>
            <Input
              id="location"
              placeholder={t("step2.locationPlaceholder")}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mode">{t("step2.modeLabel")}</Label>
            <Select value={preferredMode} onValueChange={(v) => setPreferredMode((v as PreferredMode) ?? "")}>
              <SelectTrigger id="mode" className="w-full">
                <SelectValue placeholder={t("step2.modePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {PREFERRED_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {t(`preferredModes.${mode}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ),
    },
    {
      title: t("step3.title"),
      nextDisabled: !subjects.trim() || !learningGoals.trim(),
      body: (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="subjects">{t("step3.subjectsLabel")}</Label>
            <Input
              id="subjects"
              placeholder={t("step3.subjectsPlaceholder")}
              value={subjects}
              onChange={(e) => setSubjects(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="goals">{t("step3.goalsLabel")}</Label>
            <textarea
              id="goals"
              className={textareaClass}
              placeholder={t("step3.goalsPlaceholder")}
              value={learningGoals}
              onChange={(e) => setLearningGoals(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="languages">{t("step3.languagesLabel")}</Label>
            <Input
              id="languages"
              placeholder={t("step3.languagesPlaceholder")}
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
            />
          </div>
        </>
      ),
    },
    {
      title: t("step4.title"),
      nextDisabled: false,
      body: (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="achievements">{t("step4.achievementsLabel")}</Label>
            <Input
              id="achievements"
              placeholder={t("step4.achievementsPlaceholder")}
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="interests">{t("step4.interestsLabel")}</Label>
            <Input
              id="interests"
              placeholder={t("step4.interestsPlaceholder")}
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("step4.photoLabel")}</Label>
            <div className="flex items-center gap-3">
              {photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
              )}
              <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input px-3.5 py-1.75 text-sm font-semibold text-primary hover:bg-secondary">
                {photoUploading ? t("step4.uploading") : t("step4.uploadPhoto")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoSelected}
                  disabled={photoUploading}
                />
              </label>
            </div>
          </div>
        </>
      ),
    },
  ];

  const current = stepDefs[step];

  return (
    <WizardShell
      stepIndex={step}
      stepCount={STEP_COUNT}
      title={current.title}
      subtitle={t("subtitle")}
      onNext={handleNext}
      onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
      nextDisabled={current.nextDisabled || photoUploading}
      saving={saving}
      error={error}
      isLastStep={step === STEP_COUNT - 1}
    >
      {current.body}
    </WizardShell>
  );
}
