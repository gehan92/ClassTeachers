"use server";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveBatchOwner } from "@/lib/dashboard/resolve-batch-owner";
import { notifyContentAudience } from "@/lib/dashboard/notify";
import type { Database } from "@/types/database";

type ActionResult = { error: string } | { error?: undefined };

const createLiveClassSchema = z.object({
  title: z.string().trim().min(2),
  mode: z.enum(["online", "physical"]),
  location: z.string().trim().optional(),
  batchId: z.string().uuid().optional(),
  // Present only when the teacher deliberately excluded someone from the
  // full batch/all-students pool — see the comment on live_class_participants
  // (0055) for why an "include everyone" selection is sent as nothing at all.
  participantStudentIds: z.array(z.string().uuid()).optional(),
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
  title: string;
  mode: "online" | "physical";
  location: string;
  scheduledAt: string;
  durationMinutes: string;
  batchId?: string;
  participantStudentIds?: string[];
}): Promise<ActionResult> {
  const parsed = createLiveClassSchema.safeParse({
    title: input.title,
    mode: input.mode,
    location: input.location || undefined,
    scheduledAt: input.scheduledAt,
    durationMinutes: input.durationMinutes || undefined,
    batchId: input.batchId || undefined,
    participantStudentIds: input.participantStudentIds?.length ? input.participantStudentIds : undefined,
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

  const target = await resolveBatchOwner(supabase, user.id, parsed.data.batchId);
  if ("error" in target) {
    return target;
  }

  const { data: liveClass, error: insertError } = await supabase
    .from("live_classes")
    .insert({
      owner_type: target.ownerType,
      owner_id: target.ownerId,
      batch_id: target.batchId,
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

  if (parsed.data.participantStudentIds) {
    const { error: participantsError } = await supabase.from("live_class_participants").insert(
      parsed.data.participantStudentIds.map((studentId) => ({ live_class_id: liveClass.id, student_id: studentId })),
    );
    if (participantsError) {
      return { error: "Class was scheduled, but the student list couldn't be saved. Please try again." };
    }
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

  await notifyContentAudience(
    supabase,
    target,
    parsed.data.participantStudentIds ?? null,
    "new_live_class",
    { title: parsed.data.title, liveClassId: liveClass.id },
    "classes",
    "newClassContent",
  );

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

/** Owner nudging a specific student who hasn't joined — purely an in-app
 * banner (see 0056's comment: no email/SMS/push pipeline exists here), so
 * this just upserts a row the student's own dashboard reads. Upsert so
 * clicking "Remind" again on the same student refreshes created_at instead
 * of erroring on the existing primary key. */
export async function sendLiveClassReminder(input: { liveClassId: string; studentId: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("live_class_reminders")
    .upsert(
      { live_class_id: input.liveClassId, student_id: input.studentId, created_at: new Date().toISOString() },
      { onConflict: "live_class_id,student_id" },
    );
  if (error) {
    return { error: "Couldn't send the reminder. Please try again." };
  }
  return {};
}

/** Student dismissing their own reminder banner (or it clears itself once
 * they join — see the student Live Classes tab). */
export async function dismissLiveClassReminder(input: { liveClassId: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("live_class_reminders")
    .delete()
    .eq("live_class_id", input.liveClassId)
    .eq("student_id", user.id);
  if (error) {
    return { error: "Couldn't dismiss the reminder." };
  }
  return {};
}

/** Shared lookup for the two notifications below — both need the same
 * owner/batch/participant audience, just a different `type`. Tab is
 * "classes", same as new_live_class above now uses: the point of all three
 * is to land the student inside the specific class's own Live Class section
 * (My Learning → Open class), never the flat history tab. */
async function notifyLiveClassAudience(
  supabase: SupabaseClient<Database>,
  liveClassId: string,
  type: "live_class_started" | "live_class_ended",
): Promise<void> {
  const { data: liveClass } = await supabase
    .from("live_classes")
    .select("owner_type, owner_id, batch_id, title")
    .eq("id", liveClassId)
    .maybeSingle();
  if (!liveClass) return;
  const { data: participants } = await supabase
    .from("live_class_participants")
    .select("student_id")
    .eq("live_class_id", liveClassId);
  await notifyContentAudience(
    supabase,
    { ownerType: liveClass.owner_type as "teacher" | "class", ownerId: liveClass.owner_id, batchId: liveClass.batch_id },
    participants && participants.length > 0 ? participants.map((p) => p.student_id) : null,
    type,
    { title: liveClass.title, liveClassId },
    "classes",
    "newClassContent",
  );
}

/** Fired the moment the teacher actually starts the call (see
 * handleStartCall in the teacher Live Classes tab) — distinct from
 * new_live_class above, which fires at scheduling time, often well before
 * the class is actually about to happen. */
export async function notifyLiveClassStarted(liveClassId: string): Promise<ActionResult> {
  if (!liveClassId) {
    return { error: "Invalid class." };
  }
  const supabase = await createClient();
  await notifyLiveClassAudience(supabase, liveClassId, "live_class_started");
  return {};
}

/** Fired when the host (teacher) leaves the call — see the shared
 * handleLeaveCall wrapper in dashboard-shell.tsx, the only place this is
 * called from. A student leaving never fires this; only the host actually
 * ending the session for everyone counts as "class ended". */
export async function notifyLiveClassEnded(liveClassId: string): Promise<ActionResult> {
  if (!liveClassId) {
    return { error: "Invalid class." };
  }
  const supabase = await createClient();
  await notifyLiveClassAudience(supabase, liveClassId, "live_class_ended");
  return {};
}
