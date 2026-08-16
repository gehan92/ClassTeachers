"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

const updateOwnProfileAdSchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  content: z.string().trim().min(1),
});

/**
 * The teacher/institute Ads tab manages a single `own_profile` promotion —
 * no plan/placement picker in the UI yet (that's the paid /advertise flow,
 * out of scope here), so this defaults plan to 'basic' and title to a
 * fixed label rather than exposing fields the UI doesn't have.
 */
export async function updateOwnProfileAd(input: {
  ownerType: "teacher" | "class";
  content: string;
}): Promise<ActionResult> {
  const parsed = updateOwnProfileAdSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please write some promotion text first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  let ownerId = user.id;
  if (parsed.data.ownerType === "class") {
    const { data: classProfile } = await supabase
      .from("class_profiles")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!classProfile) {
      return { error: "No institute profile found for this account." };
    }
    ownerId = classProfile.id;
  }

  const { data: existing } = await supabase
    .from("advertisements")
    .select("id")
    .eq("owner_type", parsed.data.ownerType)
    .eq("owner_id", ownerId)
    .eq("placement", "own_profile")
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("advertisements").update({ content: parsed.data.content }).eq("id", existing.id)
    : await supabase.from("advertisements").insert({
        owner_type: parsed.data.ownerType,
        owner_id: ownerId,
        title: "Profile promotion",
        content: parsed.data.content,
        placement: "own_profile",
        plan: "basic",
      });
  if (error) {
    return { error: "Couldn't save your promotion. Please try again." };
  }
  return {};
}
