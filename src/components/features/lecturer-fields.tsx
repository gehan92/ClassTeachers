"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { academicTitles } from "@/types/academic-title";

/**
 * Shown only when "lecturer" is picked in RoleSelect — see signup/page.tsx.
 * Every field here reuses a column/concept that already exists on
 * teacher_profiles (qualifications, class_type) or the subjects taxonomy
 * (via resolve_subject, supabase/migrations/0022), just collected at signup
 * instead of left empty until the teacher dashboard is edited later.
 */
export function LecturerFields() {
  const t = useTranslations("signup.lecturerFields");
  const institutionId = useId();
  const academicTitleId = useId();
  const qualificationId = useId();
  const subjectId = useId();

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <div className="mb-3 font-mono text-[11px] tracking-wide text-accent-deep uppercase">{t("heading")}</div>

      <div className="space-y-3.5">
        <div className="grid gap-1.5">
          <Label htmlFor={institutionId}>{t("institutionLabel")}</Label>
          <Input id={institutionId} name="institution" placeholder={t("institutionPlaceholder")} required />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={academicTitleId}>{t("academicTitleLabel")}</Label>
            <select
              id={academicTitleId}
              name="academicTitle"
              required
              defaultValue=""
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="" disabled>
                {t("academicTitlePlaceholder")}
              </option>
              {academicTitles.map((title) => (
                <option key={title} value={title}>
                  {t(`academicTitles.${title}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={qualificationId}>{t("qualificationLabel")}</Label>
            <Input id={qualificationId} name="qualification" placeholder={t("qualificationPlaceholder")} required />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={subjectId}>{t("subjectLabel")}</Label>
          <Input id={subjectId} name="subject" placeholder={t("subjectPlaceholder")} required />
        </div>

        <div className="grid gap-1.5">
          <Label>{t("teachingModeLabel")}</Label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-normal text-foreground/80">
              <Checkbox name="onCampus" />
              {t("onCampus")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-normal text-foreground/80">
              <Checkbox name="online" />
              {t("online")}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
