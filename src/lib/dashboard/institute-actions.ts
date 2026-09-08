"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/dashboard/notify";

type ActionResult = { error: string } | { error?: undefined };

async function resolveInstituteId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("class_profiles").select("id").eq("owner_id", userId).maybeSingle();
  return data?.id ?? null;
}

async function resolveInstitute(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("class_profiles").select("id, name").eq("owner_id", userId).maybeSingle();
  return data;
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

  const institute = await resolveInstitute(supabase, user.id);
  if (!institute) {
    return { error: "Save your institute details first." };
  }

  const { data: found } = await supabase.rpc("find_teacher_by_email", { p_email: parsed.data.email });
  const teacher = found?.[0];
  if (!teacher) {
    return { error: "No teacher or lecturer account found with that email. They need to sign up first." };
  }

  const { error } = await supabase
    .from("class_teachers")
    .insert({ class_id: institute.id, teacher_id: teacher.id, status: "pending", requested_by: "institute" });
  if (error) {
    if (error.code === "23505") {
      return { error: "This teacher is already linked to your institute (or already invited)." };
    }
    return { error: "Couldn't send the invite. Please try again." };
  }
  await notify(supabase, teacher.id, "institute_invite_received", { instituteName: institute.name }, "institute");
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

  const [{ data: classProfile }, { data: profile }] = await Promise.all([
    supabase.from("class_profiles").select("owner_id, name").eq("id", classId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  await notify(
    supabase,
    classProfile?.owner_id,
    accept ? "institute_invite_accepted" : "institute_invite_declined",
    { teacherName: profile?.full_name ?? "—" },
    "teachers",
  );
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

/**
 * The reverse of inviteTeacherToRoster (0121) -- a teacher, browsing an
 * institute's public page, asks to join it instead of waiting to be
 * invited. Goes through the request_to_join_institute RPC (security
 * definer, mirrors request_to_join_class for a student's "join this
 * institute") since a teacher has no RLS insert grant on class_teachers.
 */
export async function requestToJoinInstitute(classId: string): Promise<ActionResult> {
  if (!classId) {
    return { error: "Invalid institute." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.rpc("request_to_join_institute", { p_class_id: classId });
  if (error) {
    if (error.message.includes("class_not_found")) {
      return { error: "That institute couldn't be found." };
    }
    if (error.message.includes("already_requested")) {
      return { error: "You've already contacted this institute." };
    }
    return { error: "Couldn't send your request. Please try again." };
  }
  return {};
}

/**
 * Institute-side approval of a teacher-initiated request (requestToJoinInstitute
 * above) -- distinct from respondToRosterInvite, which is the teacher's own
 * reply to an institute-sent invite. Named differently from batches-actions'
 * respondToJoinRequest (the student/enrollment equivalent) since both can be
 * imported side by side in the institute dashboard.
 */
export async function respondToTeacherJoinRequest(teacherId: string, accept: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const institute = await resolveInstitute(supabase, user.id);
  if (!institute) {
    return { error: "Save your institute details first." };
  }

  const { error } = await supabase
    .from("class_teachers")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("class_id", institute.id)
    .eq("teacher_id", teacherId)
    .eq("requested_by", "teacher");
  if (error) {
    return { error: "Couldn't respond to this request. Please try again." };
  }
  await notify(
    supabase,
    teacherId,
    accept ? "institute_join_request_accepted" : "institute_join_request_declined",
    { instituteName: institute.name },
    "institute",
  );
  return {};
}

/**
 * Backs the Institute tab's own "Find an institute" search (spec doc's
 * "Institute tab -> Request to Join", rather than only reachable from an
 * institute's public page) -- a plain SELECT, not an RPC, since approved
 * class_profiles are already public (0005's own select policy).
 */
export async function searchInstitutes(query: string): Promise<{ id: string; name: string; location: string | null }[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("class_profiles")
    .select("id, name, location")
    .eq("status", "approved")
    .ilike("name", `%${trimmed}%`)
    .limit(10);
  return data ?? [];
}
