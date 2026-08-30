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
 * Still "find by email" rather than a search picker (see 0035's comment) —
 * but no longer an instant link. This inserts a pending row; the teacher
 * or lecturer has to accept it themselves (respondToRosterInvite) before
 * they're actually on the roster. 0091 added the status column and the
 * trigger that stops this from being anything other than a proposal until
 * then; 0100 widened find_teacher_by_email to match campus_lecturer
 * accounts too, since a lecturer already gets the same teacher_profiles
 * row a regular teacher does.
 */
export async function inviteTeacherToRoster(email: string): Promise<ActionResult> {
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
    return { error: "No teacher or lecturer account found with that email. They need to sign up first." };
  }

  const { error } = await supabase
    .from("class_teachers")
    .insert({ class_id: instituteId, teacher_id: teacher.id, status: "pending" });
  if (error) {
    if (error.code === "23505") {
      return { error: "This teacher is already linked to your institute (or already invited)." };
    }
    return { error: "Couldn't send the invite. Please try again." };
  }
  return {};
}

/**
 * Teacher-side response to an institute's roster invite. RLS (0091) already
 * confines this to the caller's own row and to a pending -> accepted/
 * declined transition — the ownership check here is just for a clean error
 * message, not the actual security boundary.
 */
export async function respondToRosterInvite(classId: string, accept: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("class_teachers")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("class_id", classId)
    .eq("teacher_id", user.id);
  if (error) {
    return { error: "Couldn't respond to this invite. Please try again." };
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
