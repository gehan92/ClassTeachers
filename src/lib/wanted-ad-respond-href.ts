import type { createClient } from "@/lib/supabase/server";

/**
 * Sends a teacher/institute straight to where they can actually respond
 * (their own dashboard's Student Requests tab) instead of a generic
 * sign-in page when they're already signed in as the right kind of
 * account — same "don't make someone re-discover the real feature"
 * reasoning as the /advertise page's CTAs. Shared between /requests and
 * /requests/[id] so the rule only lives in one place.
 */
export async function getWantedAdRespondHref(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | undefined,
): Promise<string> {
  if (!userId) return "/login";

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role === "teacher") return "/teacher?tab=studentRequests";
  if (profile?.role === "class") return "/institute?tab=studentRequests";
  return "/login";
}
