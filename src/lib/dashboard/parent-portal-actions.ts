"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

async function resolveInstituteId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("class_profiles").select("id").eq("owner_id", userId).maybeSingle();
  return data?.id ?? null;
}

export async function upsertGuardianContact(input: {
  studentId: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  note: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) return { error: "Save your institute details first." };

  const { error } = await supabase.from("student_guardians").upsert(
    {
      owner_type: "class",
      owner_id: instituteId,
      student_id: input.studentId,
      guardian_name: input.guardianName.trim() || null,
      guardian_phone: input.guardianPhone.trim() || null,
      guardian_email: input.guardianEmail.trim() || null,
      note: input.note.trim() || null,
    },
    { onConflict: "owner_id,student_id" },
  );
  if (error) return { error: "Couldn't save this contact. Please try again." };
  return {};
}
