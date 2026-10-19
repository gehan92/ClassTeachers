"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Building2, School } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/school/native-select";
import { SCHOOL_DISTRICTS, SCHOOL_GRADES, SCHOOL_MEDIUMS, SCHOOL_TYPES } from "@/lib/school/catalog";
import { cn } from "@/lib/utils";

export type InstituteKind = "tuition" | "school";

/**
 * Shown only when "class" is picked in RoleSelect — see signup/page.tsx.
 * First asks what kind of institute this is: a tuition institute (classes,
 * batches and ads, mapped onto class_profiles — 0023) or a School (School
 * Mode, 0166 — grades, staff roles and approvals, stored in `schools` and
 * checked by the admin before it goes live). The choice is permanent; only
 * an admin can change it later.
 */
export function InstituteFields({ kind, onKindChange }: { kind: InstituteKind; onKindChange: (kind: InstituteKind) => void }) {
  const t = useTranslations("signup.instituteFields");

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <fieldset>
        <legend className="mb-2.5 font-mono text-[11px] tracking-wide text-accent-deep uppercase">{t("kindHeading")}</legend>
        <input type="hidden" name="instituteKind" value={kind} />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup">
          <KindOption
            selected={kind === "tuition"}
            onSelect={() => onKindChange("tuition")}
            icon={<Building2 className="size-5" />}
            title={t("kindTuition")}
            hint={t("kindTuitionHint")}
          />
          <KindOption
            selected={kind === "school"}
            onSelect={() => onKindChange("school")}
            icon={<School className="size-5" />}
            title={t("kindSchool")}
            hint={t("kindSchoolHint")}
          />
        </div>
      </fieldset>

      <div className="mt-4 border-t border-border pt-4">{kind === "school" ? <SchoolFields /> : <TuitionFields />}</div>
    </div>
  );
}

function KindOption({
  selected,
  onSelect,
  icon,
  title,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-white p-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function TuitionFields() {
  const t = useTranslations("signup.instituteFields");
  const instituteNameId = useId();
  const subjectId = useId();
  const locationId = useId();

  return (
    <div className="space-y-3.5">
      <div className="grid gap-1.5">
        <Label htmlFor={instituteNameId}>{t("instituteNameLabel")}</Label>
        <Input id={instituteNameId} name="instituteName" placeholder={t("instituteNamePlaceholder")} required />
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
  );
}

function SchoolFields() {
  const t = useTranslations("signup.schoolFields");
  const ts = useTranslations("school");
  const nameId = useId();
  const typeId = useId();
  const districtId = useId();
  const registrationId = useId();
  const gradeFromId = useId();
  const gradeToId = useId();

  return (
    <div className="space-y-3.5">
      <div className="grid gap-1.5">
        <Label htmlFor={nameId}>{t("nameLabel")}</Label>
        <Input id={nameId} name="schoolName" placeholder={t("namePlaceholder")} required minLength={2} maxLength={160} />
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={typeId}>{t("typeLabel")}</Label>
          <NativeSelect id={typeId} name="schoolType" required defaultValue="">
            <option value="" disabled>
              {t("choose")}
            </option>
            {SCHOOL_TYPES.map((type) => (
              <option key={type} value={type}>
                {ts(`types.${type}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={districtId}>{t("districtLabel")}</Label>
          <NativeSelect id={districtId} name="district" required defaultValue="">
            <option value="" disabled>
              {t("choose")}
            </option>
            {SCHOOL_DISTRICTS.map((district) => (
              <option key={district} value={district}>
                {ts(`districts.${district}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={registrationId}>
          {t("registrationLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Input id={registrationId} name="registrationNumber" placeholder={t("registrationPlaceholder")} maxLength={60} />
        <p className="text-xs text-muted-foreground">{t("registrationHint")}</p>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("gradesLabel")}</Label>
        <div className="flex items-center gap-2">
          <NativeSelect id={gradeFromId} name="gradeFrom" defaultValue="1" aria-label={t("gradeFrom")}>
            {SCHOOL_GRADES.map((g) => (
              <option key={g} value={g}>
                {ts("gradeN", { n: g })}
              </option>
            ))}
          </NativeSelect>
          <span className="shrink-0 text-sm text-muted-foreground">{t("to")}</span>
          <NativeSelect id={gradeToId} name="gradeTo" defaultValue="13" aria-label={t("gradeTo")}>
            {SCHOOL_GRADES.map((g) => (
              <option key={g} value={g}>
                {ts("gradeN", { n: g })}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("mediumsLabel")}</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {SCHOOL_MEDIUMS.map((medium) => (
            <label key={medium} className="flex cursor-pointer items-center gap-2 text-sm font-normal text-foreground/80">
              <Checkbox name="medium" value={medium} />
              {ts(`mediums.${medium}`)}
            </label>
          ))}
        </div>
      </div>

      <p className="rounded-md bg-white/70 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{t("approvalNote")}</p>
    </div>
  );
}
