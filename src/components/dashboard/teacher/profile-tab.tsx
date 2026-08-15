"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { avatarGradientClass } from "@/lib/avatar-color";

const panelClass = "rounded-lg border border-border bg-white p-5";

export function ProfileTab() {
  const t = useTranslations("teacherDashboard.profile");
  const tc = useTranslations("teacherDashboard.common");

  const [form, setForm] = useState({
    degree: "BSc (Hons) Mathematics, University of Colombo",
    experience: "11 years",
    subjects: "Combined Maths, Physics",
    gradeLevels: "Grade 12–13 (A/L)",
    location: "Galle",
    classType: "Online & physical",
    hourlyRate: "1500",
    monthlyRate: "5500",
  });

  const [photoSaved, setPhotoSaved] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleUploadPhoto() {
    setPhotoSaved(true);
    setTimeout(() => setPhotoSaved(false), 2500);
  }

  function handleSaveChanges() {
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
            className={`flex size-[76px] shrink-0 items-center justify-center rounded-full font-display text-2xl font-bold text-white shadow-sm ${avatarGradientClass("Piyal Kumara")}`}
          >
            P
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
            <Input id="degree" value={form.degree} onChange={update("degree")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="experience">{t("fields.experience")}</Label>
            <Input id="experience" value={form.experience} onChange={update("experience")} />
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
            <Input id="classType" value={form.classType} onChange={update("classType")} />
          </div>
        </div>
      </div>

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("pricingHeading")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hourlyRate">{t("fields.hourlyRate")}</Label>
            <Input id="hourlyRate" value={form.hourlyRate} onChange={update("hourlyRate")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="monthlyRate">{t("fields.monthlyRate")}</Label>
            <Input id="monthlyRate" value={form.monthlyRate} onChange={update("monthlyRate")} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSaveChanges}>
          {t("saveChanges")}
        </Button>
        {saved && <span className="text-sm font-medium text-success">{tc("saved")}</span>}
      </div>
    </div>
  );
}
