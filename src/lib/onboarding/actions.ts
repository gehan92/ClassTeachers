"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

/**
 * Marks onboarding done for the current account, regardless of role —
 * profile_completed_at lives on `profiles` alone (0107), so this is the one
 * action every onboarding wizard's final step calls after saving its last
 * batch of fields via the existing updateStudentProfile/updateTeacherProfile/
 * updateInstituteProfile actions. Deliberately never touches
 * teacher_profiles.status/class_profiles.status (admin approval) or
 * owner_published (public visibility) — this only unlocks the owner's own
 * dashboard.
 */
export async function completeOnboarding(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ profile_completed_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) {
    return { error: "Couldn't finish setting up your profile. Please try again." };
  }
  return {};
}
