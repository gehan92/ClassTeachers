"use server";

import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  SCHOOL_AREA_KEYS,
  SCHOOL_ACTIONS,
  SCHOOL_DISTRICTS,
  SCHOOL_MEDIUMS,
  SCHOOL_SCOPE_KINDS,
  SCHOOL_TYPES,
  isCatalogPair,
  schoolErrorCode,
} from "@/lib/school/catalog";
import { formatSchoolHistory } from "@/lib/school/history-format";
import type { SchoolHistoryRow } from "@/types/school";
import type { SchoolStatus } from "@/types/database";

type ActionResult = { error: string } | { error?: undefined };

/** Turns a School Mode RPC error into a sentence in the viewer's language. */
async function errorMessage(message: string | undefined): Promise<string> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "school.errors" });
  const code = schoolErrorCode(message);
  return code && t.has(code) ? t(code) : t("generic");
}

async function signedInClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const detailsSchema = z
  .object({
    schoolId: z.uuid(),
    name: z.string().trim().min(2).max(160),
    schoolType: z.enum(SCHOOL_TYPES),
    district: z.string().refine((v) => (SCHOOL_DISTRICTS as readonly string[]).includes(v)),
    mediums: z.array(z.enum(SCHOOL_MEDIUMS)).min(1).max(3),
    gradeFrom: z.number().int().min(1).max(13),
    gradeTo: z.number().int().min(1).max(13),
    registrationNumber: optionalText(60),
    contactPhone: z.string().trim().min(7).max(30),
    address: optionalText(300),
    contactEmail: z
      .union([z.literal(""), z.email().max(160)])
      .optional()
      .transform((v) => (v ? v : null)),
    website: optionalText(200),
  })
  .refine((d) => d.gradeFrom <= d.gradeTo, { path: ["gradeTo"] });

export async function updateSchoolDetails(input: z.input<typeof detailsSchema>): Promise<{ error?: string; status?: SchoolStatus }> {
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const code =
      field === "gradeTo" || field === "gradeFrom"
        ? "school_invalid_grades"
        : field === "contactPhone"
          ? "school_invalid_phone"
          : field === "contactEmail"
            ? "school_invalid_email"
            : field === "mediums"
              ? "school_invalid_mediums"
              : field === "name"
                ? "school_invalid_name"
                : undefined;
    return { error: await errorMessage(code) };
  }
  const d = parsed.data;
  const { supabase } = await signedInClient();
  const { data, error } = await supabase.rpc("update_school_details", {
    p_school_id: d.schoolId,
    p_name: d.name,
    p_school_type: d.schoolType,
    p_district: d.district,
    p_mediums: d.mediums,
    p_grade_from: d.gradeFrom,
    p_grade_to: d.gradeTo,
    p_registration_number: d.registrationNumber,
    p_contact_phone: d.contactPhone,
    p_address: d.address,
    p_contact_email: d.contactEmail,
    p_website: d.website,
  });
  if (error) return { error: await errorMessage(error.message) };
  return { status: data ?? undefined };
}

const permissionSchema = z.object({
  area: z.enum(SCHOOL_AREA_KEYS as [string, ...string[]]),
  action: z.enum(SCHOOL_ACTIONS),
  needsApproval: z.boolean(),
});

const roleSchema = z.object({
  schoolId: z.uuid(),
  roleId: z.uuid().nullable(),
  name: z.string().trim().max(60),
  description: z.string().trim().max(300),
  scopeKind: z.enum(SCHOOL_SCOPE_KINDS),
  permissions: z.array(permissionSchema).max(200),
});

export async function saveSchoolRole(input: z.input<typeof roleSchema>): Promise<{ error?: string; roleId?: string }> {
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { error: await errorMessage("school_invalid_permissions") };
  const d = parsed.data;
  if (d.roleId === null && d.name.length < 2) return { error: await errorMessage("school_invalid_role_name") };
  const permissions = d.permissions.filter((p) => isCatalogPair(p.area, p.action));
  const { supabase } = await signedInClient();
  const { data, error } = await supabase.rpc("save_school_role", {
    p_school_id: d.schoolId,
    p_role_id: d.roleId,
    p_name: d.name,
    p_description: d.description || null,
    p_scope_kind: d.scopeKind,
    p_permissions: permissions,
  });
  if (error || !data) return { error: await errorMessage(error?.message) };
  return { roleId: data };
}

export async function deleteSchoolRole(roleId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(roleId).success) return { error: await errorMessage(undefined) };
  const { supabase } = await signedInClient();
  const { error } = await supabase.rpc("delete_school_role", { p_role_id: roleId });
  if (error) return { error: await errorMessage(error.message) };
  return {};
}

export async function resetSchoolRole(roleId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(roleId).success) return { error: await errorMessage(undefined) };
  const { supabase } = await signedInClient();
  const { error } = await supabase.rpc("reset_school_role", { p_role_id: roleId });
  if (error) return { error: await errorMessage(error.message) };
  return {};
}

const decisionSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).optional(),
});

/**
 * Approve or reject a queued change. Phase 0 has nothing that files
 * requests yet; the parts that do (timetable, marks, staff moves) apply the
 * approved change here, keyed by the request's `kind`.
 */
export async function decideSchoolApproval(input: z.input<typeof decisionSchema>): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { error: await errorMessage("school_invalid_note") };
  const { supabase } = await signedInClient();
  const { error } = await supabase.rpc("decide_school_approval", {
    p_request_id: parsed.data.id,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note || null,
  });
  if (error) return { error: await errorMessage(error.message) };
  return {};
}

export async function cancelSchoolApproval(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { error: await errorMessage(undefined) };
  const { supabase } = await signedInClient();
  const { error } = await supabase.rpc("cancel_school_approval", { p_request_id: id });
  if (error) return { error: await errorMessage(error.message) };
  return {};
}

const HISTORY_PAGE = 50;

/** One more page of the History tab, optionally for one area only. */
export async function loadSchoolHistory(input: {
  schoolId: string;
  area: string | null;
  offset: number;
}): Promise<{ rows: SchoolHistoryRow[]; hasMore: boolean; error?: string }> {
  const schoolId = z.uuid().safeParse(input.schoolId);
  if (!schoolId.success) return { rows: [], hasMore: false, error: await errorMessage(undefined) };
  const area = input.area && (SCHOOL_AREA_KEYS as string[]).includes(input.area) ? input.area : null;
  const offset = Math.max(0, Math.floor(input.offset) || 0);
  const { supabase } = await signedInClient();
  const { data, error } = await supabase.rpc("school_history", {
    p_school_id: schoolId.data,
    p_area: area,
    p_limit: HISTORY_PAGE + 1,
    p_offset: offset,
  });
  if (error) return { rows: [], hasMore: false, error: await errorMessage(error.message) };
  const rows = data ?? [];
  const locale = await getLocale();
  return { rows: await formatSchoolHistory(rows.slice(0, HISTORY_PAGE), locale), hasMore: rows.length > HISTORY_PAGE };
}
