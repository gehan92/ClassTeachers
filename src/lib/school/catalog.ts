/**
 * School Mode constants shared by the server actions and the screens.
 *
 * SCHOOL_AREAS must match school_permission_catalog() in
 * supabase/migrations/0166_school_mode_foundations.sql exactly — the
 * database drops any pair that isn't in its own copy, so a mismatch shows
 * up as a permission that silently won't save.
 */

import type { SchoolMedium, SchoolScopeKind, SchoolType } from "@/types/database";

export const SCHOOL_ACTIONS = ["view", "create", "edit", "delete", "approve", "export"] as const;
export type SchoolAction = (typeof SCHOOL_ACTIONS)[number];

/** Only changes can be sent for approval — never viewing or exporting. */
export const APPROVABLE_ACTIONS: readonly SchoolAction[] = ["create", "edit", "delete"];

export const SCHOOL_AREAS = {
  settings: ["view", "edit"],
  roles: ["view"],
  staff: ["view", "create", "edit", "delete", "approve", "export"],
  students: ["view", "create", "edit", "delete", "approve", "export"],
  timetable: ["view", "create", "edit", "delete", "approve"],
  attendance: ["view", "create", "edit", "approve", "export"],
  lessons: ["view", "create", "edit", "delete", "approve"],
  exams: ["view", "create", "edit", "delete", "approve", "export"],
  marks: ["view", "create", "edit", "approve", "export"],
  report_cards: ["view", "create", "edit", "approve", "export"],
  fees: ["view", "create", "edit", "delete", "approve", "export"],
  notices: ["view", "create", "edit", "delete", "approve"],
  discipline: ["view", "create", "edit", "approve", "export"],
  counseling: ["view", "create", "edit"],
  library: ["view", "create", "edit", "delete"],
  history: ["view", "export"],
} as const satisfies Record<string, readonly SchoolAction[]>;

export type SchoolArea = keyof typeof SCHOOL_AREAS;
export const SCHOOL_AREA_KEYS = Object.keys(SCHOOL_AREAS) as SchoolArea[];

/** How the permission screen groups the areas. */
export const SCHOOL_AREA_GROUPS: { key: string; areas: SchoolArea[] }[] = [
  { key: "people", areas: ["settings", "roles", "staff", "students"] },
  { key: "daily", areas: ["timetable", "attendance", "notices"] },
  { key: "teaching", areas: ["lessons", "exams", "marks", "report_cards", "library"] },
  { key: "care", areas: ["discipline", "counseling", "fees"] },
  { key: "records", areas: ["history"] },
];

export function isCatalogPair(area: string, action: string): boolean {
  const actions = (SCHOOL_AREAS as Record<string, readonly string[]>)[area];
  return Boolean(actions?.includes(action));
}

export const SCHOOL_TYPES = ["government", "private", "international", "pirivena"] as const satisfies readonly SchoolType[];
export const SCHOOL_MEDIUMS = ["si", "ta", "en"] as const satisfies readonly SchoolMedium[];
export const SCHOOL_SCOPE_KINDS = ["school", "grades", "sections", "subjects", "own"] as const satisfies readonly SchoolScopeKind[];
export const SCHOOL_GRADES = Array.from({ length: 13 }, (_, i) => i + 1);

/** Sri Lanka's 25 administrative districts — stored by key, shown translated. */
export const SCHOOL_DISTRICTS = [
  "ampara",
  "anuradhapura",
  "badulla",
  "batticaloa",
  "colombo",
  "galle",
  "gampaha",
  "hambantota",
  "jaffna",
  "kalutara",
  "kandy",
  "kegalle",
  "kilinochchi",
  "kurunegala",
  "mannar",
  "matale",
  "matara",
  "monaragala",
  "mullaitivu",
  "nuwara_eliya",
  "polonnaruwa",
  "puttalam",
  "ratnapura",
  "trincomalee",
  "vavuniya",
] as const;
export type SchoolDistrict = (typeof SCHOOL_DISTRICTS)[number];

export const SYSTEM_ROLE_KEYS = [
  "principal",
  "vice_principal",
  "sectional_head",
  "subject_head",
  "class_teacher",
  "subject_teacher",
] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export function isSystemRoleKey(key: string): key is SystemRoleKey {
  return (SYSTEM_ROLE_KEYS as readonly string[]).includes(key);
}

/** One permission as the role editor holds it. */
export type PermissionGrant = { area: SchoolArea; action: SchoolAction; needsApproval: boolean };

/** "fees.view", "fees.create*" (* = needs approval) → grants. */
function grants(list: string[]): PermissionGrant[] {
  return list.map((entry) => {
    const needsApproval = entry.endsWith("*");
    const [area, action] = entry.replace("*", "").split(".") as [SchoolArea, SchoolAction];
    return { area, action, needsApproval };
  });
}

/** Starting points for custom roles — the Principal can change anything before saving. */
export const CUSTOM_ROLE_TEMPLATES: { key: string; scopeKind: SchoolScopeKind; permissions: PermissionGrant[] }[] = [
  {
    key: "accountant",
    scopeKind: "school",
    permissions: grants(["students.view", "fees.view", "fees.create", "fees.edit", "fees.delete*", "fees.export"]),
  },
  {
    key: "exam_coordinator",
    scopeKind: "school",
    permissions: grants([
      "students.view",
      "timetable.view",
      "exams.view",
      "exams.create",
      "exams.edit",
      "exams.export",
      "marks.view",
      "marks.export",
      "report_cards.view",
      "report_cards.export",
    ]),
  },
  {
    key: "admissions_officer",
    scopeKind: "school",
    permissions: grants(["students.view", "students.create", "students.edit", "students.delete*", "students.export"]),
  },
  {
    key: "librarian",
    scopeKind: "school",
    permissions: grants(["students.view", "library.view", "library.create", "library.edit", "library.delete"]),
  },
  {
    key: "sports_coordinator",
    scopeKind: "school",
    permissions: grants(["students.view", "timetable.view", "notices.view", "notices.create", "attendance.view"]),
  },
  {
    key: "counselor",
    scopeKind: "school",
    permissions: grants([
      "students.view",
      "attendance.view",
      "marks.view",
      "discipline.view",
      "counseling.view",
      "counseling.create",
      "counseling.edit",
    ]),
  },
];

/** Every RPC error code the School Mode functions raise. */
export const SCHOOL_ERROR_CODES = [
  "not_signed_in",
  "school_not_institute_account",
  "school_already_tuition",
  "school_invalid_name",
  "school_invalid_type",
  "school_invalid_district",
  "school_invalid_mediums",
  "school_invalid_grades",
  "school_invalid_registration",
  "school_invalid_phone",
  "school_invalid_email",
  "school_invalid_website",
  "school_invalid_address",
  "school_not_allowed",
  "school_invalid_decision",
  "school_reason_required",
  "school_not_found",
  "school_invalid_permissions",
  "school_invalid_description",
  "school_invalid_role_name",
  "school_invalid_scope",
  "school_too_many_roles",
  "school_role_name_taken",
  "school_role_not_found",
  "school_principal_locked",
  "school_system_role",
  "school_role_in_use",
  "school_approval_not_needed",
  "school_too_many_requests",
  "school_request_not_found",
  "school_request_closed",
  "school_own_request",
  "school_invalid_note",
] as const;
export type SchoolErrorCode = (typeof SCHOOL_ERROR_CODES)[number];

/** Finds our error code inside a Postgres error message, if there is one. */
export function schoolErrorCode(message: string | undefined): SchoolErrorCode | null {
  if (!message) return null;
  const exact = SCHOOL_ERROR_CODES.find((code) => message === code);
  if (exact) return exact;
  // Longest first, so a short code never matches inside a longer one.
  return [...SCHOOL_ERROR_CODES].sort((a, b) => b.length - a.length).find((code) => message.includes(code)) ?? null;
}
