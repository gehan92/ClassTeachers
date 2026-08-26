"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

const educationLevels = ["school", "campus", "graduated"] as const;

const studentProfileSchema = z.object({
  fullName: z.string().trim().min(2),
  gradeLevel: z.string().trim().optional(),
  bio: z.string().trim().optional(),
  educationLevel: z.enum(educationLevels).optional(),
  institutionName: z.string().trim().optional(),
  qualifications: z.array(z.string().trim()).transform((arr) => arr.filter(Boolean)),
  workExperience: z.array(z.string().trim()).transform((arr) => arr.filter(Boolean)),
  subjects: z.array(z.string().trim()).transform((arr) => arr.filter(Boolean)),
  languages: z.array(z.string().trim()).transform((arr) => arr.filter(Boolean)),
});

export async function updateStudentProfile(input: {
  fullName: string;
  gradeLevel: string;
  bio: string;
  educationLevel: string;
  institutionName: string;
  qualifications: string[];
  workExperience: string[];
  subjects: string[];
  languages: string[];
}): Promise<ActionResult> {
  const parsed = studentProfileSchema.safeParse({
    fullName: input.fullName,
    gradeLevel: input.gradeLevel,
    bio: input.bio,
    educationLevel: input.educationLevel || undefined,
    institutionName: input.institutionName,
    qualifications: input.qualifications,
    workExperience: input.workExperience,
    subjects: input.subjects,
    languages: input.languages,
  });
  if (!parsed.success) {
    return { error: "Please check your name and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      grade_level: parsed.data.gradeLevel || null,
      bio: parsed.data.bio || null,
      education_level: parsed.data.educationLevel ?? null,
      institution_name: parsed.data.institutionName || null,
      qualifications: parsed.data.qualifications.length > 0 ? parsed.data.qualifications : null,
      work_experience: parsed.data.workExperience.length > 0 ? parsed.data.workExperience : null,
      subjects: parsed.data.subjects.length > 0 ? parsed.data.subjects : null,
      languages: parsed.data.languages.length > 0 ? parsed.data.languages : null,
    })
    .eq("id", user.id);
  if (error) {
    return { error: "Couldn't save your changes. Please try again." };
  }
  return {};
}

/**
 * One jsonb column backs both the student and teacher notification-toggle
 * sets (each is a different set of keys, but a profile row is only ever one
 * role, so there's no collision). Merges rather than overwrites so a caller
 * only needs to send the keys it actually renders.
 */
export async function updateNotificationPrefs(prefs: Record<string, boolean>): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", user.id)
    .single();

  const merged = { ...(existing?.notification_prefs as Record<string, boolean> | null), ...prefs };

  const { error } = await supabase.from("profiles").update({ notification_prefs: merged }).eq("id", user.id);
  if (error) {
    return { error: "Couldn't save your notification settings. Please try again." };
  }
  return {};
}

/**
 * Gates what get_roster_student_info (0069) returns to a student's
 * teachers/institutes — a student's own view of their own phone (this
 * form, the profile card) is never affected by this, only what a
 * teacher's roster shows.
 */
export async function updatePhoneSharingPref(shared: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ share_phone_with_teachers: shared })
    .eq("id", user.id);
  if (error) {
    return { error: "Couldn't save this setting. Please try again." };
  }
  return {};
}

const teacherProfileSchema = z.object({
  headline: z.string().trim().optional(),
  bio: z.string().trim().optional(),
  qualifications: z.array(z.string().trim().min(1)).optional(),
  workExperience: z.array(z.string().trim().min(1)).optional(),
  experienceYears: z.coerce.number().int().min(0).optional(),
  location: z.string().trim().optional(),
  classType: z.enum(["physical", "online", "both"]),
  hourlyRate: z.coerce.number().min(0).optional(),
  monthlyRate: z.coerce.number().min(0).optional(),
  languages: z.array(z.string().trim().min(1)).optional(),
});

export async function updateTeacherProfile(input: {
  headline: string;
  bio: string;
  qualifications: string[];
  workExperience: string[];
  experienceYears: string;
  location: string;
  classType: string;
  hourlyRate: string;
  monthlyRate: string;
  languages: string[];
}): Promise<ActionResult> {
  const parsed = teacherProfileSchema.safeParse({
    headline: input.headline,
    bio: input.bio,
    qualifications: input.qualifications.map((q) => q.trim()).filter(Boolean),
    workExperience: input.workExperience.map((w) => w.trim()).filter(Boolean),
    experienceYears: input.experienceYears || undefined,
    location: input.location,
    classType: input.classType,
    hourlyRate: input.hourlyRate || undefined,
    monthlyRate: input.monthlyRate || undefined,
    languages: input.languages.map((l) => l.trim()).filter(Boolean),
  });
  if (!parsed.success) {
    return { error: "Please check the highlighted fields and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  // No signup-time trigger creates a teacher_profiles row (see ensureProfile
  // in src/lib/auth/actions.ts) — a fresh account has none yet, so this must
  // upsert rather than update, or the first Save would silently no-op.
  const { error: profileError } = await supabase.from("teacher_profiles").upsert(
    {
      id: user.id,
      headline: parsed.data.headline || null,
      bio: parsed.data.bio || null,
      qualifications: parsed.data.qualifications && parsed.data.qualifications.length > 0 ? parsed.data.qualifications : null,
      work_experience: parsed.data.workExperience && parsed.data.workExperience.length > 0 ? parsed.data.workExperience : null,
      experience_years: parsed.data.experienceYears ?? null,
      location: parsed.data.location || null,
      class_type: parsed.data.classType,
      languages: parsed.data.languages && parsed.data.languages.length > 0 ? parsed.data.languages : null,
    },
    { onConflict: "id" },
  );
  if (profileError) {
    return { error: "Couldn't save your changes. Please try again." };
  }

  if (parsed.data.hourlyRate !== undefined || parsed.data.monthlyRate !== undefined) {
    const { error: priceError } = await supabase.from("prices").upsert(
      {
        owner_type: "teacher",
        owner_id: user.id,
        hourly_rate: parsed.data.hourlyRate ?? null,
        monthly_rate: parsed.data.monthlyRate ?? null,
      },
      { onConflict: "owner_type,owner_id" },
    );
    if (priceError) {
      return { error: "Couldn't save your rates. Please try again." };
    }
  }

  return {};
}

/**
 * `subjects` is an admin-curated taxonomy (0007) a teacher can't insert
 * into directly, so this reuses `resolve_subject()` (0022) — the same
 * find-or-create-by-English-name RPC signup already uses for a single
 * subject — for each name, then replaces the teacher's `subject_links` rows
 * to match. A teacher's grade band on their public profile (0021, 0026) is
 * derived from these links' subjects, not stored separately.
 */
export async function updateTeacherSubjects(subjectNames: string[]): Promise<ActionResult> {
  const names = [...new Set(subjectNames.map((n) => n.trim()).filter(Boolean))];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const subjectIds: string[] = [];
  for (const name of names) {
    const { data: subjectId, error: resolveError } = await supabase.rpc("resolve_subject", {
      subject_name: name,
    });
    if (resolveError || !subjectId) {
      return { error: `Couldn't save "${name}". Please try again.` };
    }
    subjectIds.push(subjectId);
  }

  const { error: deleteError } = await supabase
    .from("subject_links")
    .delete()
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id);
  if (deleteError) {
    return { error: "Couldn't save your subjects. Please try again." };
  }

  if (subjectIds.length > 0) {
    const { error: insertError } = await supabase
      .from("subject_links")
      .insert(subjectIds.map((subjectId) => ({ owner_type: "teacher" as const, owner_id: user.id, subject_id: subjectId })));
    if (insertError) {
      return { error: "Couldn't save your subjects. Please try again." };
    }
  }

  return {};
}

const teacherAccountSchema = z.object({
  phone: z.string().trim().optional(),
});

const studentAccountSchema = z.object({
  phone: z.string().trim().optional(),
});

export async function updateStudentAccount(input: { phone: string }): Promise<ActionResult> {
  const parsed = studentAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check the phone number and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ phone: parsed.data.phone || null })
    .eq("id", user.id);
  if (error) {
    return { error: "Couldn't save your changes. Please try again." };
  }
  return {};
}

export async function updateTeacherAccount(input: { phone: string }): Promise<ActionResult> {
  const parsed = teacherAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check the phone number and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ phone: parsed.data.phone || null })
    .eq("id", user.id);
  if (error) {
    return { error: "Couldn't save your changes. Please try again." };
  }
  return {};
}

/**
 * Lives on teacher_profiles, not profiles — it's specific to the teacher
 * role's contact reveal (get_teacher_contact, 0042), not a general account
 * setting. Upsert rather than update: a brand-new account may not have a
 * teacher_profiles row yet (same reasoning as updateTeacherProfile above).
 */
export async function updateContactMode(mode: "phone" | "messaging_only"): Promise<ActionResult> {
  if (mode !== "phone" && mode !== "messaging_only") {
    return { error: "Invalid contact preference." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("teacher_profiles")
    .upsert({ id: user.id, contact_mode: mode }, { onConflict: "id" });
  if (error) {
    return { error: "Couldn't save your changes. Please try again." };
  }
  return {};
}

const instituteSettingsSchema = z.object({
  name: z.string().trim().min(2),
  location: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  established: z.string().trim().optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
  monthlyRate: z.coerce.number().min(0).optional(),
});

export async function updateInstituteProfile(input: {
  name: string;
  location: string;
  phone: string;
  established: string;
  hourlyRate: string;
  monthlyRate: string;
}): Promise<ActionResult> {
  const parsed = instituteSettingsSchema.safeParse({
    name: input.name,
    location: input.location,
    phone: input.phone,
    established: input.established,
    hourlyRate: input.hourlyRate || undefined,
    monthlyRate: input.monthlyRate || undefined,
  });
  if (!parsed.success) {
    return { error: "Please check the highlighted fields and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  // No signup-time trigger creates a class_profiles row, and it has no
  // unique constraint on owner_id (unlike teacher_profiles, whose id *is*
  // the owner), so this can't be a simple upsert — insert on first save,
  // update on every one after.
  const { data: classProfile } = await supabase
    .from("class_profiles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  let instituteId = classProfile?.id;
  if (instituteId) {
    const { error: classError } = await supabase
      .from("class_profiles")
      .update({
        name: parsed.data.name,
        location: parsed.data.location || null,
        established: parsed.data.established || null,
      })
      .eq("id", instituteId);
    if (classError) {
      return { error: "Couldn't save your changes. Please try again." };
    }
  } else {
    const { data: inserted, error: classError } = await supabase
      .from("class_profiles")
      .insert({
        owner_id: user.id,
        name: parsed.data.name,
        location: parsed.data.location || null,
        established: parsed.data.established || null,
      })
      .select("id")
      .single();
    if (classError || !inserted) {
      return { error: "Couldn't save your changes. Please try again." };
    }
    instituteId = inserted.id;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ phone: parsed.data.phone || null })
    .eq("id", user.id);
  if (profileError) {
    return { error: "Couldn't save your phone number. Please try again." };
  }

  if (parsed.data.hourlyRate !== undefined || parsed.data.monthlyRate !== undefined) {
    const { error: priceError } = await supabase.from("prices").upsert(
      {
        owner_type: "class",
        owner_id: instituteId,
        hourly_rate: parsed.data.hourlyRate ?? null,
        monthly_rate: parsed.data.monthlyRate ?? null,
      },
      { onConflict: "owner_type,owner_id" },
    );
    if (priceError) {
      return { error: "Couldn't save your rates. Please try again." };
    }
  }

  return {};
}

/**
 * Owner-controlled visibility, independent of admin review. Only ever
 * touches owner_published (0036) — never status, which is admin-only via
 * resolveApproval (admin-actions.ts). A listing only shows up publicly when
 * status = 'approved' AND owner_published, so this errors out if the
 * listing hasn't been approved yet rather than silently no-opping (there'd
 * be nothing for the toggle to do until then).
 */
export async function setListingPublished(input: {
  kind: "teacher" | "class";
  published: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  if (input.kind === "teacher") {
    const { data: existing } = await supabase
      .from("teacher_profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();
    if (!existing) {
      return { error: "Save your profile details first." };
    }
    if (existing.status !== "approved") {
      return { error: "Your listing needs admin approval before you can publish it." };
    }
    const { error } = await supabase
      .from("teacher_profiles")
      .update({ owner_published: input.published })
      .eq("id", user.id);
    if (error) {
      return { error: "Couldn't update your listing visibility. Please try again." };
    }
    return {};
  }

  const { data: classProfile } = await supabase
    .from("class_profiles")
    .select("id, status")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!classProfile) {
    return { error: "Save your institute details first." };
  }
  if (classProfile.status !== "approved") {
    return { error: "Your listing needs admin approval before you can publish it." };
  }
  const { error } = await supabase
    .from("class_profiles")
    .update({ owner_published: input.published })
    .eq("id", classProfile.id);
  if (error) {
    return { error: "Couldn't update your listing visibility. Please try again." };
  }
  return {};
}

/**
 * Lets an owner send a rejected listing back into the Admin -> Approvals
 * queue after they've made changes, instead of being permanently stuck.
 * Only valid from 'rejected' — resubmitting a 'pending' listing is a no-op
 * (it's already in the queue) and an 'approved'/'suspended' one isn't
 * something this action is meant to touch.
 */
export async function resubmitListing(input: { kind: "teacher" | "class" }): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  if (input.kind === "teacher") {
    const { data: existing } = await supabase
      .from("teacher_profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();
    if (!existing || existing.status !== "rejected") {
      return { error: "This listing isn't awaiting resubmission." };
    }
    const { error } = await supabase.from("teacher_profiles").update({ status: "pending" }).eq("id", user.id);
    if (error) {
      return { error: "Couldn't resubmit your listing. Please try again." };
    }
    return {};
  }

  const { data: classProfile } = await supabase
    .from("class_profiles")
    .select("id, status")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!classProfile || classProfile.status !== "rejected") {
    return { error: "This listing isn't awaiting resubmission." };
  }
  const { error } = await supabase.from("class_profiles").update({ status: "pending" }).eq("id", classProfile.id);
  if (error) {
    return { error: "Couldn't resubmit your listing. Please try again." };
  }
  return {};
}
