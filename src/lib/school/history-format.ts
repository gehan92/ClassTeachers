import "server-only";
import { getTranslations } from "next-intl/server";
import type { Json } from "@/types/database";
import type { SchoolHistoryRow } from "@/types/school";
import { createDateTimeFormatter } from "@/lib/format-date";

type RawHistoryRow = {
  id: number;
  area: string;
  event: string;
  entity_label: string | null;
  old_value: Json | null;
  new_value: Json | null;
  actor_name: string;
  created_at: string;
};

const FIELD_KEYS = [
  "name",
  "school_type",
  "district",
  "address",
  "registration_number",
  "mediums",
  "grade_from",
  "grade_to",
  "contact_phone",
  "contact_email",
  "website",
  "logo_url",
] as const;

/** Built-in roles are stored with their English name; show them in the viewer's language. */
const SYSTEM_ROLE_BY_NAME: Record<string, string> = {
  Principal: "principal",
  "Vice Principal": "vice_principal",
  "Sectional Head": "sectional_head",
  "Subject Head": "subject_head",
  "Class Teacher": "class_teacher",
  "Subject Teacher": "subject_teacher",
};

function asObject(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asStringList(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Turns change-log rows into what the History tab shows: the event as a
 * sentence key plus readable "field: before → after" lines, in the
 * viewer's language. Permission lists ("fees.create*") become "Fees ·
 * Create (needs approval)".
 */
export async function formatSchoolHistory(rows: RawHistoryRow[], locale: string): Promise<SchoolHistoryRow[]> {
  const t = await getTranslations({ locale, namespace: "school" });
  const formatter = createDateTimeFormatter(locale);

  const permissionLabel = (entry: string) => {
    const approval = entry.endsWith("*");
    const [area, action] = entry.replace("*", "").split(".");
    const areaLabel = t.has(`areas.${area}.label`) ? t(`areas.${area}.label`) : area;
    const actionLabel = t.has(`actions.${action}`) ? t(`actions.${action}`) : action;
    return `${areaLabel} · ${actionLabel}${approval ? ` (${t("roles.needsApprovalShort")})` : ""}`;
  };

  const valueLabel = (field: string, value: Json | undefined): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "mediums") return asStringList(value).map((m) => t(`mediums.${m}`)).join(", ");
    if (field === "school_type" && typeof value === "string") return t.has(`types.${value}`) ? t(`types.${value}`) : value;
    if (field === "district" && typeof value === "string") return t.has(`districts.${value}`) ? t(`districts.${value}`) : value;
    if ((field === "grade_from" || field === "grade_to") && typeof value === "number") return t("gradeN", { n: value });
    return typeof value === "string" ? value : JSON.stringify(value);
  };

  return rows.map((row) => {
    const oldValue = asObject(row.old_value);
    const newValue = asObject(row.new_value);
    const changes: SchoolHistoryRow["changes"] = [];

    if (row.event === "role.updated") {
      const before = new Set(asStringList(oldValue.permissions));
      const after = new Set(asStringList(newValue.permissions));
      const added = [...after].filter((p) => !before.has(p));
      const removed = [...before].filter((p) => !after.has(p));
      if (added.length) changes.push({ field: t("history.added"), from: "", to: added.map(permissionLabel).join(", ") });
      if (removed.length) changes.push({ field: t("history.removed"), from: "", to: removed.map(permissionLabel).join(", ") });
    } else if (row.event === "role.created") {
      const list = asStringList(newValue.permissions);
      changes.push({ field: t("history.permissions"), from: "", to: list.length ? list.map(permissionLabel).join(", ") : "—" });
    } else if (row.event === "school.updated") {
      for (const field of FIELD_KEYS) {
        if (!(field in newValue)) continue;
        changes.push({
          field: t(`history.fields.${field}`),
          from: valueLabel(field, oldValue[field]),
          to: valueLabel(field, newValue[field]),
        });
      }
    } else {
      if (typeof newValue.reason === "string") changes.push({ field: t("history.reason"), from: "", to: newValue.reason });
      if (typeof newValue.note === "string") changes.push({ field: t("history.note"), from: "", to: newValue.note });
    }

    return {
      id: row.id,
      area: row.area,
      event: row.event,
      entityLabel:
        row.event.startsWith("role.") && row.entity_label && SYSTEM_ROLE_BY_NAME[row.entity_label]
          ? t(`roles.system.${SYSTEM_ROLE_BY_NAME[row.entity_label]}.name`)
          : (row.entity_label ?? ""),
      changes,
      actorName: row.actor_name || t("history.system"),
      createdAt: formatter.format(new Date(row.created_at)),
      createdAtIso: row.created_at,
    };
  });
}
