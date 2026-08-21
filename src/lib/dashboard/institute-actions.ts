"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

async function resolveInstituteId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("class_profiles").select("id").eq("owner_id", userId).maybeSingle();
  return data?.id ?? null;
}

const addTeacherSchema = z.object({ email: z.string().trim().email() });

/**
 * "Add by email" instead of a real invite flow — see 0035's comment. Only
 * succeeds if the email belongs to an existing teacher account (teacher_id
 * FKs teacher_profiles, not just profiles), so there's nothing to send and
 * nothing pending — either it's linked immediately, or it errors.
 */
export async function addTeacherToRoster(email: string): Promise<ActionResult> {
  const parsed = addTeacherSchema.safeParse({ email });
  if (!parsed.success) {
    return { error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) {
    return { error: "Save your institute details first." };
  }

  const { data: found } = await supabase.rpc("find_teacher_by_email", { p_email: parsed.data.email });
  const teacher = found?.[0];
  if (!teacher) {
    return { error: "No teacher account found with that email. They need to sign up as a teacher first." };
  }

  const { error } = await supabase
    .from("class_teachers")
    .insert({ class_id: instituteId, teacher_id: teacher.id });
  if (error) {
    if (error.code === "23505") {
      return { error: "This teacher is already linked to your institute." };
    }
    return { error: "Couldn't add this teacher. Please try again." };
  }
  return {};
}

export async function setTeacherVisibility(teacherId: string, visible: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) {
    return { error: "Save your institute details first." };
  }

  const { error } = await supabase
    .from("class_teachers")
    .update({ is_visible: visible })
    .eq("class_id", instituteId)
    .eq("teacher_id", teacherId);
  if (error) {
    return { error: "Couldn't update visibility. Please try again." };
  }
  return {};
}

export async function removeTeacherFromRoster(teacherId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) {
    return { error: "Save your institute details first." };
  }

  const { error } = await supabase
    .from("class_teachers")
    .delete()
    .eq("class_id", instituteId)
    .eq("teacher_id", teacherId);
  if (error) {
    return { error: "Couldn't remove this teacher. Please try again." };
  }
  return {};
}
