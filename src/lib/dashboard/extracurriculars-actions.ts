"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

async function resolveInstituteId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("class_profiles").select("id").eq("owner_id", userId).maybeSingle();
  return data?.id ?? null;
}

export async function createActivity(input: { name: string; description: string; scheduleNote: string }): Promise<ActionResult> {
  if (!input.name.trim()) return { error: "Enter an activity name." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) return { error: "Save your institute details first." };

  const { error } = await supabase.from("extracurricular_activities").insert({
    owner_type: "class",
    owner_id: instituteId,
    name: input.name.trim(),
    description: input.description.trim() || null,
    schedule_note: input.scheduleNote.trim() || null,
  });
  if (error) return { error: "Couldn't create this activity. Please try again." };
  return {};
}

export async function deleteActivity(activityId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("extracurricular_activities").delete().eq("id", activityId);
  if (error) return { error: "Couldn't delete this activity. Please try again." };
  return {};
}

export async function enrollStudent(activityId: string, studentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) return { error: "Save your institute details first." };

  const { error } = await supabase.from("extracurricular_participants").insert({
    activity_id: activityId,
    owner_type: "class",
    owner_id: instituteId,
    student_id: studentId,
  });
  if (error) {
    if (error.code === "23505") return { error: "This student is already enrolled in this activity." };
    return { error: "Couldn't enroll this student. Please try again." };
  }
  return {};
}

export async function removeParticipant(participantId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("extracurricular_participants").delete().eq("id", participantId);
  if (error) return { error: "Couldn't remove this student. Please try again." };
  return {};
}

export async function toggleCertificateIssued(participantId: string, issued: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("extracurricular_participants").update({ certificate_issued: issued }).eq("id", participantId);
  if (error) return { error: "Couldn't update this record. Please try again." };
  return {};
}
