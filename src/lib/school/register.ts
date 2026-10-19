import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SchoolMedium, SchoolType } from "@/types/database";
import { SCHOOL_DISTRICTS, SCHOOL_MEDIUMS, SCHOOL_TYPES } from "@/lib/school/catalog";
import { roleDashboardPath, type UserRole } from "@/lib/auth/routes";

/** What the School option on the sign-up form stashes on auth user_metadata. */
export type SchoolSignupMetadata = {
  institute_kind?: "tuition" | "school";
  school_name?: string;
  school_type?: string;
  district?: string;
  registration_number?: string | null;
  mediums?: string[];
  grade_from?: number;
  grade_to?: number;
  phone?: string | null;
};

export function isSchoolSignup(metadata: unknown): boolean {
  return (metadata as SchoolSignupMetadata | null)?.institute_kind === "school";
}

/**
 * Creates the `schools` row (plus the Principal's staff record and the
 * built-in roles) from what was typed on the sign-up form. register_school
 * returns the existing school when there already is one, so this is safe to
 * call on every sign-in until it has worked once — the /school page does
 * exactly that, in case it failed during sign-up.
 */
export async function registerSchoolFromMetadata(
  supabase: SupabaseClient<Database>,
  metadata: unknown,
): Promise<{ schoolId: string | null; error?: string }> {
  const m = (metadata ?? {}) as SchoolSignupMetadata;
  const schoolType = SCHOOL_TYPES.find((type) => type === m.school_type) as SchoolType | undefined;
  const district = SCHOOL_DISTRICTS.find((d) => d === m.district);
  const mediums = (m.mediums ?? []).filter((x): x is SchoolMedium => (SCHOOL_MEDIUMS as readonly string[]).includes(x));
  if (!m.school_name || !schoolType || !district || mediums.length === 0 || !m.phone) {
    return { schoolId: null, error: "missing_details" };
  }
  const { data, error } = await supabase.rpc("register_school", {
    p_name: m.school_name,
    p_school_type: schoolType,
    p_district: district,
    p_mediums: mediums,
    p_grade_from: m.grade_from ?? 1,
    p_grade_to: m.grade_to ?? 13,
    p_registration_number: m.registration_number ?? null,
    p_contact_phone: m.phone,
  });
  if (error || !data) {
    console.error("[registerSchoolFromMetadata] register_school failed:", error?.message);
    return { schoolId: null, error: error?.message ?? "no_id" };
  }
  return { schoolId: data };
}

/**
 * Where a user lands after sign-in. A School's Principal is an Institute
 * account (role "class") but works in /school, not /institute.
 */
export async function dashboardPathFor(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: UserRole,
  metadata: unknown,
): Promise<string> {
  if (role !== "class") return roleDashboardPath[role];
  if (isSchoolSignup(metadata)) return "/school";
  // Before migration 0166 runs this query errors and the account simply
  // keeps landing on /institute.
  const { data } = await supabase.from("schools").select("id").eq("owner_id", userId).maybeSingle();
  return data ? "/school" : roleDashboardPath.class;
}
