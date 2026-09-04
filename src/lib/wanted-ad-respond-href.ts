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

/**
 * Resolves the (responder_type, responder_id) pair `wanted_ad_responses`
 * rows are actually keyed by — same role/class_profile lookup
 * `respondToWantedAd` (wanted-ads-actions.ts) does inline, pulled out here
 * so a second caller (the request detail page, checking whether the viewer
 * already responded to *this* ad) doesn't have to re-derive it. Returns
 * null for anyone who isn't a signed-in teacher/institute account, which
 * callers should treat as "not a possible responder" rather than an error.
 */
export async function resolveWantedAdResponder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | undefined,
): Promise<{ responderType: "teacher" | "class"; responderId: string } | null> {
  if (!userId) return null;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role === "teacher") return { responderType: "teacher", responderId: userId };
  if (profile?.role === "class") {
    const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", userId).maybeSingle();
    if (classProfile) return { responderType: "class", responderId: classProfile.id };
  }
  return null;
}
