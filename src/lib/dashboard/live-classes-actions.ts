"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

const createLiveClassSchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  title: z.string().trim().min(2),
  mode: z.enum(["online", "physical"]),
  location: z.string().trim().optional(),
  scheduledAt: z.string().min(1),
  durationMinutes: z.coerce.number().int().min(1).default(60),
  joinLink: z.string().trim().optional(),
});

export async function createLiveClass(input: {
  ownerType: "teacher" | "class";
  title: string;
  mode: "online" | "physical";
  location: string;
  scheduledAt: string;
  durationMinutes: string;
  joinLink: string;
}): Promise<ActionResult> {
  const parsed = createLiveClassSchema.safeParse({
    ownerType: input.ownerType,
    title: input.title,
    mode: input.mode,
    location: input.location || undefined,
    scheduledAt: input.scheduledAt,
    durationMinutes: input.durationMinutes || undefined,
    joinLink: input.joinLink || undefined,
  });
  if (!parsed.success) {
    return { error: "Please check the class title, mode, and schedule." };
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
      return { error: "Save your institute details first." };
    }
    ownerId = classProfile.id;
  }

  const scheduledAtIso = new Date(parsed.data.scheduledAt).toISOString();

  const { data: liveClass, error: insertError } = await supabase
    .from("live_classes")
    .insert({
      owner_type: parsed.data.ownerType,
      owner_id: ownerId,
      title: parsed.data.title,
      mode: parsed.data.mode,
      location: parsed.data.mode === "physical" ? parsed.data.location || null : null,
      scheduled_at: scheduledAtIso,
      duration_minutes: parsed.data.durationMinutes,
    })
    .select("id")
    .single();
  if (insertError || !liveClass) {
    return { error: "Couldn't schedule this class. Please try again." };
  }

  if (parsed.data.mode === "online" && parsed.data.joinLink) {
    const { error: linkError } = await supabase
      .from("live_class_links")
      .insert({ live_class_id: liveClass.id, join_link: parsed.data.joinLink });
    if (linkError) {
      return { error: "Class was scheduled, but the join link couldn't be saved. Add it from the class list." };
    }
  }

  return {};
}

export async function updateLiveClassLink(input: { liveClassId: string; joinLink: string }): Promise<ActionResult> {
  const joinLink = input.joinLink.trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  if (!joinLink) {
    const { error } = await supabase.from("live_class_links").delete().eq("live_class_id", input.liveClassId);
    if (error) {
      return { error: "Couldn't clear the join link. Please try again." };
    }
    return {};
  }

  const { error } = await supabase
    .from("live_class_links")
    .upsert({ live_class_id: input.liveClassId, join_link: joinLink }, { onConflict: "live_class_id" });
  if (error) {
    return { error: "Couldn't save the join link. Please try again." };
  }
  return {};
}

/** Student clicking "Join" — marks themself present. RLS requires they're
 * actually enrolled with this live class's owner (0033). */
export async function markAttendance(input: { liveClassId: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("attendance_records").upsert(
    { live_class_id: input.liveClassId, student_id: user.id, status: "present" },
    { onConflict: "live_class_id,student_id", ignoreDuplicates: true },
  );
  if (error) {
    return { error: "Couldn't mark attendance. Please try again." };
  }
  return {};
}

/** Teacher/institute manually setting a student's attendance status. */
export async function setAttendanceStatus(input: {
  liveClassId: string;
  studentId: string;
  status: "present" | "absent" | "late";
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("attendance_records")
    .upsert(
      { live_class_id: input.liveClassId, student_id: input.studentId, status: input.status },
      { onConflict: "live_class_id,student_id" },
    );
  if (error) {
    return { error: "Couldn't update attendance. Please try again." };
  }
  return {};
}
