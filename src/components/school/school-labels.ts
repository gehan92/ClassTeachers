"use client";

import { useTranslations } from "next-intl";
import { isSystemRoleKey } from "@/lib/school/catalog";
import type { SchoolDetails } from "@/types/school";

/** Built-in roles are named in the viewer's language; custom roles keep the name the Principal typed. */
export function useRoleName() {
  const t = useTranslations("school.roles");
  return (role: { key: string; name: string; isSystem: boolean }) =>
    role.isSystem && isSystemRoleKey(role.key) ? t(`system.${role.key}.name`) : role.name;
}

export function useRoleDescription() {
  const t = useTranslations("school.roles");
  return (role: { key: string; description: string; isSystem: boolean }) =>
    role.description || (role.isSystem && isSystemRoleKey(role.key) ? t(`system.${role.key}.description`) : "");
}

/** "Private school · Kandy · Grades 1–13 · Sinhala and English medium" */
export function useSchoolSummary() {
  const t = useTranslations("school");
  return (school: Pick<SchoolDetails, "schoolType" | "district" | "gradeFrom" | "gradeTo" | "mediums">) =>
    [
      t(`types.${school.schoolType}`),
      t.has(`districts.${school.district}`) ? t(`districts.${school.district}`) : school.district,
      t("gradeRange", { from: school.gradeFrom, to: school.gradeTo }),
      t("mediumLine", { mediums: school.mediums.map((m) => t(`mediums.${m}`)).join(", ") }),
    ].join(" · ");
}
