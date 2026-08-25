"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

const createLiveClassSchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  title: z.string().trim().min(2),
  mode: z.enum(["online", "physical"]),
  location: z.string().trim().optional(),
  batchId: z.string().uuid().optional(),
  // Must already be a UTC ISO string (Date#toISOString()) computed in the
  // browser — a bare "YYYY-MM-DDTHH:mm" datetime-local value has no
  // timezone of its own, so converting it with `new Date(...)` has to
  // happen where "local" actually means something. Doing that conversion
  // here instead (a "use server" action runs on Vercel, in UTC) would
  // silently reinterpret the teacher's local wall-clock digits as UTC,
  // shifting the real scheduled moment by their timezone offset.
  scheduledAt: z.iso.datetime(),
  durationMinutes: z.coerce.number().int().min(1).default(60),
});

export async function createLiveClass(input: {
  ownerType: "teacher" | "class";
  title: string;
  mode: "online" | "physical";
  location: string;
  scheduledAt: string;
  durationMinutes: string;
  batchId?: string;
}): Promise<ActionResult> {
  const parsed = createLiveClassSchema.safeParse({
    ownerType: input.ownerType,
    title: input.title,
    mode: input.mode,
    location: input.location || undefined,
    scheduledAt: input.scheduledAt,
    durationMinutes: input.durationMinutes || undefined,
    batchId: input.batchId || undefined,
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

  const { data: liveClass, error: insertError } = await supabase
    .from("live_classes")
    .insert({
      owner_type: parsed.data.ownerType,
      owner_id: ownerId,
      batch_id: parsed.data.batchId ?? null,
      title: parsed.data.title,
      mode: parsed.data.mode,
      location: parsed.data.mode === "physical" ? parsed.data.location || null : null,
      scheduled_at: parsed.data.scheduledAt,
      duration_minutes: parsed.data.durationMinutes,
    })
    .select("id")
    .single();
  if (insertError || !liveClass) {
    return { error: "Couldn't schedule this class. Please try again." };
  }

  if (parsed.data.mode === "online") {
    // Room name is a fresh random id, never derived from live_class.id —
    // that id is public (live_classes' own SELECT policy is `using (true)`,
    // so anyone can list scheduled classes), while this room URL stays
    // gated behind live_class_links' owner/enrolled/admin policy (0012).
    // Deriving it from the public id would let anyone who can see the
    // schedule guess their way into the call.
    const roomUrl = `https://meet.jit.si/ClassPortals-${crypto.randomUUID()}`;
    const { error: linkError } = await supabase
      .from("live_class_links")
      .insert({ live_class_id: liveClass.id, join_link: roomUrl });
    if (linkError) {
      return { error: "Class was scheduled, but the video room couldn't be created. Please try again." };
    }
  }

  return {};
}

/** live_class_links and attendance_records both cascade-delete on
 * live_classes (0012, 0033) — the video room and any attendance already
 * taken go with it, no manual cleanup needed. */
export async function deleteLiveClass(liveClassId: string): Promise<ActionResult> {
  if (!liveClassId) {
    return { error: "Invalid class." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("live_classes").delete().eq("id", liveClassId);
  if (error) {
    return { error: "Couldn't delete this class. Please try again." };
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
