"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Shown only when "teacher" is picked in RoleSelect — see signup/page.tsx.
 * Every field here reuses a column that already exists on teacher_profiles
 * (headline, bio, class_type) or the subjects taxonomy (via resolve_subject,
 * supabase/migrations/0022) — the same mapping lecturer-fields.tsx uses.
 */
export function TeacherFields() {
  const t = useTranslations("signup.teacherFields");
  const subjectId = useId();
  const headlineId = useId();
  const descriptionId = useId();

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <div className="mb-3 font-mono text-[11px] tracking-wide text-accent-deep uppercase">{t("heading")}</div>

      <div className="space-y-3.5">
        <div className="grid gap-1.5">
          <Label>{t("lessonFormatLabel")}</Label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-normal text-foreground/80">
              <Checkbox name="inPerson" />
              {t("inPerson")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-normal text-foreground/80">
              <Checkbox name="online" />
              {t("online")}
            </label>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={subjectId}>{t("subjectLabel")}</Label>
          <Input id={subjectId} name="subject" placeholder={t("subjectPlaceholder")} required />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={headlineId}>{t("headlineLabel")}</Label>
          <Input id={headlineId} name="headline" placeholder={t("headlinePlaceholder")} required />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={descriptionId}>{t("descriptionLabel")}</Label>
          <textarea
            id={descriptionId}
            name="description"
            rows={4}
            placeholder={t("descriptionPlaceholder")}
            required
            className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>
    </div>
  );
}
