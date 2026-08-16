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

  const metadata = user.user_metadata as { full_name?: string; role?: UserRole; phone?: string | null };
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
  });
  if (!parsed.success) {
    console.error(
      "[signUpAction] validation failed on fields:",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
    return { error: t("generic") };
  }

  const { fullName, email, phone, password, role } = parsed.data;
  // The role picker's "lecturer" option is a campus lecturer under the hood
  // (same dashboard as a teacher, see types/dashboard.ts's DemoRole comment).
  const dbRole: UserRole = role === "lecturer" ? "campus_lecturer" : role;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone: phone ?? null, role: dbRole } },
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
