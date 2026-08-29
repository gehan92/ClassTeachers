"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

const createAnnouncementSchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(1).max(2000),
});

export async function createAnnouncement(input: {
  ownerType: "teacher" | "class";
  title: string;
  body: string;
}): Promise<ActionResult> {
  const parsed = createAnnouncementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please add a title and a message, then try again." };
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

  const { error } = await supabase.from("announcements").insert({
    owner_type: parsed.data.ownerType,
    owner_id: ownerId,
    title: parsed.data.title,
    body: parsed.data.body,
  });
  if (error) {
    return { error: "Couldn't post this announcement. Please try again." };
  }
  return {};
}

export async function deleteAnnouncement(announcementId: string): Promise<ActionResult> {
  if (!announcementId) {
    return { error: "Invalid announcement." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("announcements").delete().eq("id", announcementId);
  if (error) {
    return { error: "Couldn't delete this announcement. Please try again." };
  }
  return {};
}
