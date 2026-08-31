"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTeacherProfile } from "@/lib/dashboard/actions";
import { uploadAvatar } from "@/lib/dashboard/avatar-actions";
import { uploadVerificationDocument } from "@/lib/dashboard/verification-actions";
import { completeOnboarding } from "@/lib/onboarding/actions";
import { WizardShell } from "./wizard-shell";

export type TeacherOnboardingInitial = {
  headline: string;
  bio: string;
  classType: "physical" | "online" | "both";
  institution: string;
  academicTitle: string;
  qualifications: string;
  workExperience: string;
  publications: string;
  experienceYears: string;
  location: string;
  languages: string;
  hourlyRate: string;
  monthlyRate: string;
};

/**
 * Covers both plain teachers (3 steps) and campus lecturers (4 steps, with
 * an extra verification-document step) — same teacher_profiles row and
 * dashboard either way, matching how the rest of the codebase treats
 * campus_lecturer as "a teacher account with extra academic fields," not a
 * separate role's worth of duplicated components.
 */
export function TeacherOnboardingWizard({
  initial,
  isCampusLecturer,
}: {
  initial: TeacherOnboardingInitial;
  isCampusLecturer: boolean;
}) {
  const t = useTranslations("onboarding.teacher");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [qualifications, setQualifications] = useState(initial.qualifications);
  const [experienceYears, setExperienceYears] = useState(initial.experienceYears);
  const [workExperience, setWorkExperience] = useState(initial.workExperience);
  const [publications, setPublications] = useState(initial.publications);
  const [location, setLocation] = useState(initial.location);
  const [languages, setLanguages] = useState(initial.languages);
  const [hasDocument, setHasDocument] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(initial.hourlyRate);
  const [monthlyRate, setMonthlyRate] = useState(initial.monthlyRate);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  function toList(v: string) {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function persist() {
    return updateTeacherProfile({
      headline: initial.headline,
      bio: initial.bio,
      qualifications: toList(qualifications),
      workExperience: toList(workExperience),
      experienceYears,
      location,
      classType: initial.classType,
      hourlyRate,
      monthlyRate,
      languages: toList(languages),
      institution: isCampusLecturer ? initial.institution : undefined,
      academicTitle: isCampusLecturer ? initial.academicTitle : undefined,
      publications: isCampusLecturer ? toList(publications) : undefined,
    });
  }

  const stepDefs = [
    {
      title: isCampusLecturer ? t("step1.titleCampus") : t("step1.title"),
      nextDisabled: !qualifications.trim() || !experienceYears.trim(),
      body: (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="qualifications">{t("step1.qualificationsLabel")}</Label>
            <Input
              id="qualifications"
              placeholder={t("step1.qualificationsPlaceholder")}
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="experience">{t("step1.experienceLabel")}</Label>
            <Input
              id="experience"
              type="number"
              min={0}
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
            />
          </div>
          {isCampusLecturer ? (
            <div className="grid gap-1.5">
              <Label htmlFor="publications">{t("step1.publicationsLabel")}</Label>
              <Input
                id="publications"
                placeholder={t("step1.publicationsPlaceholder")}
                value={publications}
                onChange={(e) => setPublications(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="work-experience">{t("step1.workExperienceLabel")}</Label>
              <Input
                id="work-experience"
                placeholder={t("step1.workExperiencePlaceholder")}
                value={workExperience}
                onChange={(e) => setWorkExperience(e.target.value)}
              />
            </div>
          )}
        </>
      ),
    },
    {
      title: t("step2.title"),
      nextDisabled: !location.trim(),
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
            <Label htmlFor="languages">{t("step2.languagesLabel")}</Label>
            <Input
              id="languages"
              placeholder={t("step2.languagesPlaceholder")}
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
            />
          </div>
        </>
      ),
    },
    ...(isCampusLecturer
      ? [
          {
            title: t("stepVerification.title"),
            nextDisabled: !hasDocument,
            body: (
              <div className="grid gap-1.5">
                <Label>{t("stepVerification.documentLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("stepVerification.documentHint")}</p>
                <label className="mt-1 inline-flex w-fit cursor-pointer items-center justify-center rounded-md border border-input px-3.5 py-1.75 text-sm font-semibold text-primary hover:bg-secondary">
                  {docUploading ? t("stepVerification.uploading") : hasDocument ? t("stepVerification.uploaded") : t("stepVerification.upload")}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={docUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      setDocUploading(true);
                      setError(null);
                      const formData = new FormData();
                      formData.set("file", file);
                      const result = await uploadVerificationDocument("teacher", formData);
                      setDocUploading(false);
                      if (result.error) {
                        setError(result.error);
                        return;
                      }
                      setHasDocument(true);
                    }}
                  />
                </label>
              </div>
            ),
          },
        ]
      : []),
    {
      title: t("step3.title"),
      nextDisabled: (!hourlyRate.trim() && !monthlyRate.trim()) || !photoUrl,
      body: (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="hourly">{t("step3.hourlyLabel")}</Label>
              <Input id="hourly" type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="monthly">{t("step3.monthlyLabel")}</Label>
              <Input id="monthly" type="number" min={0} value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} />
            </div>
          </div>
          <p className="-mt-1.5 text-xs text-muted-foreground">{t("step3.rateHint")}</p>
          <div className="grid gap-1.5">
            <Label>{t("step3.photoLabel")}</Label>
            <div className="flex items-center gap-3">
              {photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
              )}
              <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input px-3.5 py-1.75 text-sm font-semibold text-primary hover:bg-secondary">
                {photoUploading ? t("step3.uploading") : t("step3.uploadPhoto")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={photoUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setPhotoUploading(true);
                    setError(null);
                    const formData = new FormData();
                    formData.set("file", file);
                    formData.set("ownerType", "teacher");
                    const result = await uploadAvatar(formData);
                    setPhotoUploading(false);
                    if (result.error || !result.url) {
                      setError(result.error ?? "Couldn't upload the image. Please try again.");
                      return;
                    }
                    setPhotoUrl(result.url);
                  }}
                />
              </label>
            </div>
          </div>
        </>
      ),
    },
  ];

  const stepCount = stepDefs.length;
  const current = stepDefs[step];

  async function handleNext() {
    setSaving(true);
    setError(null);
    const result = await persist();
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (step < stepCount - 1) {
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

  return (
    <WizardShell
      stepIndex={step}
      stepCount={stepCount}
      title={current.title}
      subtitle={isCampusLecturer ? t("subtitleCampus") : t("subtitle")}
      onNext={handleNext}
      onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
      nextDisabled={current.nextDisabled || photoUploading || docUploading}
      saving={saving}
      error={error}
      isLastStep={step === stepCount - 1}
    >
      {current.body}
    </WizardShell>
  );
}
