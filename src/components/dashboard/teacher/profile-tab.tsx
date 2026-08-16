"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { avatarGradientClass } from "@/lib/avatar-color";
import { updateTeacherProfile } from "@/lib/dashboard/actions";

const panelClass = "rounded-lg border border-border bg-white p-5";
type ClassType = "physical" | "online" | "both";

export function ProfileTab({
  initialQualifications,
  initialExperienceYears,
  initialLocation,
  initialClassType,
  initialHourlyRate,
  initialMonthlyRate,
  teacherName,
}: {
  initialQualifications: string;
  initialExperienceYears: string;
  initialLocation: string;
  initialClassType: ClassType;
  initialHourlyRate: string;
  initialMonthlyRate: string;
  teacherName: string;
}) {
  const t = useTranslations("teacherDashboard.profile");
  const tc = useTranslations("teacherDashboard.common");

  // "Subjects" is a real many-to-many relation (subject_links) rather than
  // free text, and "grade levels" has no backing column at all — both kept
  // as local-only until there's a subject-picker UI / schema decision.
  const [form, setForm] = useState({
    qualifications: initialQualifications,
    experience: initialExperienceYears,
    subjects: "",
    gradeLevels: "",
    location: initialLocation,
    classType: initialClassType,
    hourlyRate: initialHourlyRate,
    monthlyRate: initialMonthlyRate,
  });

  const [photoSaved, setPhotoSaved] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(
    field: "qualifications" | "experience" | "subjects" | "gradeLevels" | "location" | "hourlyRate" | "monthlyRate",
  ) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleUploadPhoto() {
    setPhotoSaved(true);
    setTimeout(() => setPhotoSaved(false), 2500);
  }

  async function handleSaveChanges() {
    setSaving(true);
    setError(null);
    const result = await updateTeacherProfile({
      qualifications: form.qualifications,
      experienceYears: form.experience,
      location: form.location,
      classType: form.classType,
      hourlyRate: form.hourlyRate,
      monthlyRate: form.monthlyRate,
    });
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

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("photoHeading")}</h3>
        <div className="flex items-center gap-4">
          <div
            className={`flex size-[76px] shrink-0 items-center justify-center rounded-full font-display text-2xl font-bold text-white shadow-sm ${avatarGradientClass(teacherName)}`}
          >
            {teacherName.charAt(0).toUpperCase()}
          </div>
          <Button type="button" variant="outline" onClick={handleUploadPhoto}>
            {t("uploadPhoto")}
          </Button>
          {photoSaved && <span className="text-sm font-medium text-success">{tc("saved")}</span>}
        </div>
      </div>

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("qualificationsHeading")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="degree">{t("fields.degree")}</Label>
            <Input id="degree" value={form.qualifications} onChange={update("qualifications")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="experience">{t("fields.experience")}</Label>
            <Input id="experience" type="number" min={0} value={form.experience} onChange={update("experience")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subjects">{t("fields.subjects")}</Label>
            <Input id="subjects" value={form.subjects} onChange={update("subjects")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gradeLevels">{t("fields.gradeLevels")}</Label>
            <Input id="gradeLevels" value={form.gradeLevels} onChange={update("gradeLevels")} />
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
      </div>
    </div>
  );
}
