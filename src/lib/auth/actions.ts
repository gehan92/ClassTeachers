"use server";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema } from "./schemas";
import { roleDashboardPath, type UserRole } from "./routes";
import type { Database } from "@/types/database";

export type AuthActionState =
  | { error: string; pendingConfirmationEmail?: undefined }
  | { pendingConfirmationEmail: string; error?: undefined }
  | undefined;

type SignupMetadata = {
  full_name?: string;
  role?: UserRole;
  phone?: string | null;
  // Teacher signup (src/components/features/teacher-fields.tsx)
  headline?: string;
  bio?: string;
  // Campus Lecturer signup (src/components/features/lecturer-fields.tsx)
  institution?: string;
  academic_title?: string;
  qualifications?: string;
  // Class/Institute signup (src/components/features/institute-fields.tsx)
  institute_name?: string;
  location?: string;
  // Shared across roles — teacher_profiles/class_profiles.class_type and
  // the subjects taxonomy
  subject?: string;
  class_type?: "physical" | "online" | "both";
};

/**
 * Materializes the Teacher/Campus Lecturer signup steps' extra fields onto
 * teacher_profiles, and links the free-text subject into the subjects
 * taxonomy via resolve_subject (supabase/migrations/0022) — the same
 * SECURITY DEFINER pattern as get_teacher_contact, since inserting into
 * subjects is otherwise admin-only (0007). Lecturer-only columns
 * (institution/academic_title) simply stay null for a plain teacher.
 */
async function ensureTeacherProfileRow(
  supabase: SupabaseClient<Database>,
  userId: string,
  metadata: SignupMetadata,
): Promise<void> {
  const { error: profileError } = await supabase.from("teacher_profiles").upsert(
    {
      id: userId,
      headline: metadata.headline ?? null,
      bio: metadata.bio ?? null,
      institution: metadata.institution ?? null,
      academic_title: metadata.academic_title ?? null,
      qualifications: metadata.qualifications ?? null,
      class_type: metadata.class_type ?? "both",
    },
    { onConflict: "id" },
  );
  if (profileError) {
    throw profileError;
  }

  if (!metadata.subject) {
    return;
  }

  const { data: subjectId, error: subjectError } = await supabase.rpc("resolve_subject", {
    subject_name: metadata.subject,
  });
  if (subjectError || !subjectId) {
    console.error("[ensureTeacherProfileRow] resolve_subject failed:", subjectError?.message);
    return;
  }

  const { error: linkError } = await supabase
    .from("subject_links")
    .upsert({ owner_type: "teacher", owner_id: userId, subject_id: subjectId }, { onConflict: "owner_type,owner_id,subject_id" });
  if (linkError) {
    console.error("[ensureTeacherProfileRow] subject_links upsert failed:", linkError.message);
  }
}

/**
 * Materializes the Class/Institute signup step's extra fields onto
 * class_profiles, and links its subject the same way
 * ensureTeacherProfileRow does. class_profiles has no unique constraint on
 * owner_id (its id is a separate generated uuid, unlike teacher_profiles
 * whose id *is* the owner), so this can't be a plain upsert — same
 * select-then-insert-or-update shape as updateInstituteProfile in
 * src/lib/dashboard/actions.ts.
 */
async function ensureInstituteProfileRow(
  supabase: SupabaseClient<Database>,
  userId: string,
  metadata: SignupMetadata,
): Promise<void> {
  if (!metadata.institute_name) {
    return;
  }

  const { data: existing } = await supabase.from("class_profiles").select("id").eq("owner_id", userId).maybeSingle();

  let classId = existing?.id;
  if (classId) {
    const { error: classError } = await supabase
      .from("class_profiles")
      .update({
        name: metadata.institute_name,
        location: metadata.location ?? null,
        class_type: metadata.class_type ?? "both",
      })
      .eq("id", classId);
    if (classError) {
      throw classError;
    }
  } else {
    const { data: inserted, error: classError } = await supabase
      .from("class_profiles")
      .insert({
        owner_id: userId,
        name: metadata.institute_name,
        location: metadata.location ?? null,
        class_type: metadata.class_type ?? "both",
      })
      .select("id")
      .single();
    if (classError || !inserted) {
      throw classError ?? new Error("class_profiles insert returned no row");
    }
    classId = inserted.id;
  }

  if (!metadata.subject) {
    return;
  }

  const { data: subjectId, error: subjectError } = await supabase.rpc("resolve_subject", {
    subject_name: metadata.subject,
  });
  if (subjectError || !subjectId) {
    console.error("[ensureInstituteProfileRow] resolve_subject failed:", subjectError?.message);
    return;
  }

  const { error: linkError } = await supabase
    .from("subject_links")
    .upsert({ owner_type: "class", owner_id: classId, subject_id: subjectId }, { onConflict: "owner_type,owner_id,subject_id" });
  if (linkError) {
    console.error("[ensureInstituteProfileRow] subject_links upsert failed:", linkError.message);
  }
}

/**
 * Every table in supabase/migrations relies on a profiles row existing for
 * the current auth.uid() (RLS policies check it, get_teacher_contact() joins
 * through it, etc). There's no database trigger creating that row — instead
 * whichever code path first sees an authenticated session with no matching
 * profile creates one from the full_name/role/phone stashed on signup as
 * auth user_metadata. That covers both signup-with-instant-session (email
 * confirmation off) and signup-then-first-login (email confirmation on).
 */
async function ensureProfile(supabase: SupabaseClient<Database>, user: User): Promise<UserRole> {
  const { data: existing } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (existing) {
    return existing.role;
  }

  const metadata = user.user_metadata as SignupMetadata;
  const role = metadata.role ?? "student";

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    role,
    full_name: metadata.full_name ?? user.email ?? "New user",
    phone: metadata.phone ?? null,
  });
  if (error) {
    throw error;
  }

  if (role === "class" && metadata.institute_name) {
    await ensureInstituteProfileRow(supabase, user.id, metadata);
  } else if ((role === "teacher" && metadata.headline) || (role === "campus_lecturer" && metadata.institution)) {
    await ensureTeacherProfileRow(supabase, user.id, metadata);
  }

  return role;
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "authErrors" });

  if (formData.get("agree") !== "on") {
    console.error("[signUpAction] rejected: agree checkbox was not checked");
    return { error: t("agreeRequired") };
  }

  const parsed = signupSchema.safeParse({
    fullName: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
    role: formData.get("role"),
    subject: formData.get("subject") || undefined,
    headline: formData.get("headline") || undefined,
    description: formData.get("description") || undefined,
    inPerson: formData.get("inPerson") === "on",
    online: formData.get("online") === "on",
    institution: formData.get("institution") || undefined,
    academicTitle: formData.get("academicTitle") || undefined,
    qualification: formData.get("qualification") || undefined,
    onCampus: formData.get("onCampus") === "on",
    instituteName: formData.get("instituteName") || undefined,
    location: formData.get("location") || undefined,
    physical: formData.get("physical") === "on",
  });
  if (!parsed.success) {
    console.error(
      "[signUpAction] validation failed on fields:",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
    return { error: t("generic") };
  }

  const {
    fullName,
    email,
    phone,
    password,
    role,
    subject,
    headline,
    description,
    inPerson,
    online,
    institution,
    academicTitle,
    qualification,
    onCampus,
    instituteName,
    location,
    physical,
  } = parsed.data;
  // The role picker's "lecturer" option is a campus lecturer under the hood
  // (same dashboard as a teacher, see types/dashboard.ts's DemoRole comment).
  const dbRole: UserRole = role === "lecturer" ? "campus_lecturer" : role;

  // Stashed on auth user_metadata rather than written straight to
  // teacher_profiles here: signUp doesn't always return a session (email
  // confirmation can be required), so materializing these has to wait for
  // ensureProfile — see its comment in src/lib/auth/actions.ts.
  let roleMetadata: Record<string, unknown> = {};
  if (role === "teacher") {
    roleMetadata = {
      headline,
      bio: description,
      subject,
      class_type: inPerson && online ? ("both" as const) : online ? ("online" as const) : ("physical" as const),
    };
  } else if (role === "lecturer") {
    roleMetadata = {
      institution,
      academic_title: academicTitle,
      qualifications: qualification,
      subject,
      class_type: onCampus && online ? ("both" as const) : online ? ("online" as const) : ("physical" as const),
    };
  } else if (role === "class") {
    roleMetadata = {
      institute_name: instituteName,
      location,
      subject,
      class_type: physical && online ? ("both" as const) : online ? ("online" as const) : ("physical" as const),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone: phone ?? null, role: dbRole, ...roleMetadata } },
  });

  if (error) {
    console.error("[signUpAction] supabase.auth.signUp failed:", error.message);
    return { error: /already registered/i.test(error.message) ? t("emailTaken") : t("generic") };
  }
  if (!data.user) {
    console.error("[signUpAction] signUp returned no user and no error");
    return { error: t("generic") };
  }
  if (!data.session) {
    // Email confirmation is required before Supabase issues a session — the
    // profile row gets created on first login instead (see ensureProfile).
    return { pendingConfirmationEmail: email };
  }

  let finalRole: UserRole;
  try {
    finalRole = await ensureProfile(supabase, data.user);
  } catch (err) {
    console.error("[signUpAction] ensureProfile failed:", err);
    return { error: t("generic") };
  }
  redirect(`/${locale}${roleDashboardPath[finalRole]}`);
}

export async function logInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "authErrors" });

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: t("invalidCredentials") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    console.error("[logInAction] supabase.auth.signInWithPassword failed:", error.message);
    return { error: t("invalidCredentials") };
  }

  let role: UserRole;
  try {
    role = await ensureProfile(supabase, data.user);
  } catch (err) {
    console.error("[logInAction] ensureProfile failed:", err);
    return { error: t("generic") };
  }
  redirect(`/${locale}${roleDashboardPath[role]}`);
}

export async function logOutAction(): Promise<void> {
  const locale = await getLocale();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/login`);
}
