"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/dashboard/notify";

type ActionResult = { error: string } | { error?: undefined };

const modeOptions = ["online", "physical"] as const;

const vacancyAdSchema = z.object({
  subjectId: z.string().uuid().optional(),
  mode: z.enum(modeOptions).optional(),
  location: z.string().trim().max(120).optional(),
  title: z.string().trim().min(2),
  content: z.string().trim().min(1).max(2000),
});

async function resolveInstituteId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", userId).maybeSingle();
  return classProfile?.id ?? null;
}

export async function createVacancyAd(input: {
  subjectId: string;
  mode: string;
  location: string;
  title: string;
  content: string;
}): Promise<ActionResult> {
  const parsed = vacancyAdSchema.safeParse({
    subjectId: input.subjectId || undefined,
    mode: input.mode || undefined,
    location: input.location || undefined,
    title: input.title,
    content: input.content,
  });
  if (!parsed.success) {
    return { error: "Please fill in a role title and description, then try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) {
    return { error: "No institute profile found for this account." };
  }

  const { error } = await supabase.from("vacancy_ads").insert({
    institute_id: instituteId,
    subject_id: parsed.data.subjectId ?? null,
    mode: parsed.data.mode ?? null,
    location: parsed.data.location ?? null,
    title: parsed.data.title,
    content: parsed.data.content,
  });
  if (error) {
    return { error: "Couldn't post this vacancy. Please try again." };
  }
  return {};
}

export async function updateVacancyAd(
  vacancyId: string,
  input: { subjectId: string; mode: string; location: string; title: string; content: string },
): Promise<ActionResult> {
  const parsed = vacancyAdSchema.safeParse({
    subjectId: input.subjectId || undefined,
    mode: input.mode || undefined,
    location: input.location || undefined,
    title: input.title,
    content: input.content,
  });
  if (!parsed.success) {
    return { error: "Please fill in a role title and description, then try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) {
    return { error: "No institute profile found for this account." };
  }

  const { error } = await supabase
    .from("vacancy_ads")
    .update({
      subject_id: parsed.data.subjectId ?? null,
      mode: parsed.data.mode ?? null,
      location: parsed.data.location ?? null,
      title: parsed.data.title,
      content: parsed.data.content,
    })
    .eq("id", vacancyId)
    .eq("institute_id", instituteId);
  if (error) {
    return { error: "Couldn't save your changes. Please try again." };
  }
  return {};
}

export async function setVacancyAdStatus(vacancyId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) {
    return { error: "No institute profile found for this account." };
  }

  const { error } = await supabase
    .from("vacancy_ads")
    .update({ status: active ? "active" : "closed" })
    .eq("id", vacancyId)
    .eq("institute_id", instituteId);
  if (error) {
    return { error: "Couldn't update this vacancy. Please try again." };
  }
  return {};
}

export async function deleteVacancyAd(vacancyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) {
    return { error: "No institute profile found for this account." };
  }

  const { error } = await supabase.from("vacancy_ads").delete().eq("id", vacancyId).eq("institute_id", instituteId);
  if (error) {
    return { error: "Couldn't delete this vacancy. Please try again." };
  }
  return {};
}

const applySchema = z.object({
  vacancyId: z.string().uuid(),
  message: z.string().trim().min(1),
});

/**
 * Only a teacher ever applies here — resolved from the caller's own auth
 * user id server-side, enforced again by the insert policy (0141).
 */
export async function applyToVacancy(vacancyId: string, message: string): Promise<ActionResult> {
  const parsed = applySchema.safeParse({ vacancyId, message });
  if (!parsed.success) {
    return { error: "Please write a message first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("vacancy_applications").insert({
    vacancy_id: parsed.data.vacancyId,
    teacher_id: user.id,
    message: parsed.data.message,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "You've already applied to this vacancy." };
    }
    return { error: "Couldn't send your application. Please try again." };
  }

  const [{ data: vacancy }, { data: applicantProfile }] = await Promise.all([
    supabase.from("vacancy_ads").select("institute_id, title").eq("id", parsed.data.vacancyId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (vacancy) {
    const { data: instituteProfile } = await supabase
      .from("class_profiles")
      .select("owner_id")
      .eq("id", vacancy.institute_id)
      .maybeSingle();
    // No dedicated notification-preference toggle for this yet, same call as
    // respondToTeacherSeekingAd — narrow and infrequent enough not to need
    // its own Settings entry right now.
    await notify(
      supabase,
      instituteProfile?.owner_id,
      "vacancy_application",
      { teacherName: applicantProfile?.full_name ?? "A teacher", vacancyTitle: vacancy.title },
      "ads",
    );
  }
  return {};
}

/**
 * The institute's decision on one application — mirrors
 * respondToTeacherSeekingAdDecision's own accept/decline shape, including
 * checking that the write actually landed: RLS (0141) already restricts
 * this update to the vacancy's own posting institute, so a mismatched
 * caller or a stale/already-gone applicationId must surface as an error
 * here rather than a silent no-op that looks like success.
 */
export async function respondToVacancyApplicationDecision(applicationId: string, accepted: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: updated, error } = await supabase
    .from("vacancy_applications")
    .update({ status: accepted ? "accepted" : "declined" })
    .eq("id", applicationId)
    .select("teacher_id, vacancy_id")
    .maybeSingle();
  if (error) {
    return { error: "Couldn't update this. Please try again." };
  }
  if (!updated) {
    return { error: "This application could not be found, or you don't have permission to update it." };
  }

  const { data: vacancy } = await supabase.from("vacancy_ads").select("institute_id").eq("id", updated.vacancy_id).maybeSingle();
  const { data: instituteProfile } = vacancy
    ? await supabase.from("class_profiles").select("name").eq("id", vacancy.institute_id).maybeSingle()
    : { data: null };
  await notify(
    supabase,
    updated.teacher_id,
    accepted ? "vacancy_application_accepted" : "vacancy_application_declined",
    { instituteName: instituteProfile?.name ?? "An institute" },
    "institute",
  );
  return {};
}
