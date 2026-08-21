"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

const studentProfileSchema = z.object({
  fullName: z.string().trim().min(2),
  phone: z.string().trim().optional(),
});

export async function updateStudentProfile(input: { fullName: string; phone: string }): Promise<ActionResult> {
  const parsed = studentProfileSchema.safeParse(input);
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
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null })
    .eq("id", user.id);
  if (error) {
    return { error: "Couldn't save your changes. Please try again." };
  }
  return {};
}

const teacherProfileSchema = z.object({
  qualifications: z.array(z.string().trim().min(1)).optional(),
  experienceYears: z.coerce.number().int().min(0).optional(),
  location: z.string().trim().optional(),
  classType: z.enum(["physical", "online", "both"]),
  hourlyRate: z.coerce.number().min(0).optional(),
  monthlyRate: z.coerce.number().min(0).optional(),
});

export async function updateTeacherProfile(input: {
  qualifications: string[];
  experienceYears: string;
  location: string;
  classType: string;
  hourlyRate: string;
  monthlyRate: string;
}): Promise<ActionResult> {
  const parsed = teacherProfileSchema.safeParse({
    qualifications: input.qualifications.map((q) => q.trim()).filter(Boolean),
    experienceYears: input.experienceYears || undefined,
    location: input.location,
    classType: input.classType,
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

  // No signup-time trigger creates a teacher_profiles row (see ensureProfile
  // in src/lib/auth/actions.ts) — a fresh account has none yet, so this must
  // upsert rather than update, or the first Save would silently no-op.
  const { error: profileError } = await supabase.from("teacher_profiles").upsert(
    {
      id: user.id,
      qualifications: parsed.data.qualifications && parsed.data.qualifications.length > 0 ? parsed.data.qualifications : null,
      experience_years: parsed.data.experienceYears ?? null,
      location: parsed.data.location || null,
      class_type: parsed.data.classType,
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

const teacherAccountSchema = z.object({
  phone: z.string().trim().optional(),
});

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

const instituteSettingsSchema = z.object({
  name: z.string().trim().min(2),
  location: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
  monthlyRate: z.coerce.number().min(0).optional(),
});

export async function updateInstituteProfile(input: {
  name: string;
  location: string;
  phone: string;
  hourlyRate: string;
  monthlyRate: string;
}): Promise<ActionResult> {
  const parsed = instituteSettingsSchema.safeParse({
    name: input.name,
    location: input.location,
    phone: input.phone,
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
      .update({ name: parsed.data.name, location: parsed.data.location || null })
      .eq("id", instituteId);
    if (classError) {
      return { error: "Couldn't save your changes. Please try again." };
    }
  } else {
    const { data: inserted, error: classError } = await supabase
      .from("class_profiles")
      .insert({ owner_id: user.id, name: parsed.data.name, location: parsed.data.location || null })
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
 * teacher_profiles/class_profiles.status starts 'pending' and nothing else
 * in the app moves it to 'approved' (there's no admin moderation queue
 * built yet) — so without this, a real profile would never appear in
 * /teachers search results. This lets an owner publish/unpublish their own
 * listing directly, which RLS already permits (owner can update their own
 * row); it's the same status column a future moderation flow would use,
 * just self-served for now instead of admin-gated.
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

  const status = input.published ? "approved" : "pending";

  if (input.kind === "teacher") {
    const { data: existing } = await supabase
      .from("teacher_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!existing) {
      return { error: "Save your profile details first." };
    }
    const { error } = await supabase.from("teacher_profiles").update({ status }).eq("id", user.id);
    if (error) {
      return { error: "Couldn't update your listing visibility. Please try again." };
    }
    return {};
  }

  const { data: classProfile } = await supabase
    .from("class_profiles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!classProfile) {
    return { error: "Save your institute details first." };
  }
  const { error } = await supabase.from("class_profiles").update({ status }).eq("id", classProfile.id);
  if (error) {
    return { error: "Couldn't update your listing visibility. Please try again." };
  }
  return {};
}
