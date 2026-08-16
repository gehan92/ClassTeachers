"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Shown only when "class" is picked in RoleSelect — see signup/page.tsx.
 * institute name/location/class_type map straight onto class_profiles
 * (class_type is new, supabase/migrations/0023); subject links into the
 * subjects taxonomy the same way teacher/lecturer-fields.tsx do, via
 * resolve_subject (0022).
 */
export function InstituteFields() {
  const t = useTranslations("signup.instituteFields");
  const instituteNameId = useId();
  const subjectId = useId();
  const locationId = useId();

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <div className="mb-3 font-mono text-[11px] tracking-wide text-accent-deep uppercase">{t("heading")}</div>

      <div className="space-y-3.5">
        <div className="grid gap-1.5">
          <Label htmlFor={instituteNameId}>{t("instituteNameLabel")}</Label>
          <Input
            id={instituteNameId}
            name="instituteName"
            placeholder={t("instituteNamePlaceholder")}
            required
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={subjectId}>{t("subjectLabel")}</Label>
          <Input id={subjectId} name="subject" placeholder={t("subjectPlaceholder")} required />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={locationId}>{t("locationLabel")}</Label>
          <Input id={locationId} name="location" placeholder={t("locationPlaceholder")} required />
        </div>

        <div className="grid gap-1.5">
          <Label>{t("classTypeLabel")}</Label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-normal text-foreground/80">
              <Checkbox name="physical" />
              {t("physical")}
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
