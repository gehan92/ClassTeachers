import { createClient } from "@/lib/supabase/server";
import { createDateFormatter } from "@/lib/format-date";
import type { ClassProfileDetail } from "@/types/class-profile";

/**
 * Shared between the public /class/[id] page and the institute dashboard's
 * inline "view live page" preview (Settings tab) — calling the exact same
 * loader for both, rather than reshaping data the dashboard already has,
 * guarantees the preview can never drift from what's actually public.
 */
export async function loadClassProfile(id: string, locale: string): Promise<ClassProfileDetail | null> {
  const supabase = await createClient();

  const { data: classProfile, error } = await supabase
    .from("class_profiles")
    .select("id, name, description, location, class_type, established, photo_url, institution_verified")
    .eq("id", id)
    .maybeSingle();

  if (error || !classProfile) {
    return null;
  }

  const [
    { data: priceRow },
    { data: reviewRows },
    { data: batchRows },
    { data: adRow },
    { data: teacherRows },
    { data: phone },
  ] = await Promise.all([
    supabase.from("prices").select("hourly_rate, monthly_rate").eq("owner_type", "class").eq("owner_id", id).maybeSingle(),
    supabase.rpc("list_public_reviews", { p_target_type: "class", p_target_id: id }),
    supabase
      .from("batches")
      .select("id, title, mode, location, schedule_note, teacher_label, status")
      .eq("owner_type", "class")
      .eq("owner_id", id)
      .in("status", ["active", "upcoming"])
      .order("created_at", { ascending: false }),
    supabase
      .from("advertisements")
      .select("content, title")
      .eq("owner_type", "class")
      .eq("owner_id", id)
      .eq("placement", "own_profile")
      .maybeSingle(),
    // Institute Blueprint step 4a (0096) — the real roster, not just a
    // count; accepted+visible+approved only, same gate the count uses.
    supabase.rpc("list_institute_teachers", { p_class_id: id }),
    supabase.rpc("get_class_contact", { p_class_id: id }),
  ]);

  const dateFormatter = createDateFormatter(locale);
  const reviews = reviewRows ?? [];
  const reviewCount = reviews.length;
  const rating = reviewCount > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;

  return {
    id: classProfile.id,
    name: classProfile.name,
    description: classProfile.description,
    location: classProfile.location,
    classType: (classProfile.class_type as ClassProfileDetail["classType"]) ?? "physical",
    establishedText: classProfile.established,
    photoUrl: classProfile.photo_url,
    verified: classProfile.institution_verified,
    teacherCount: teacherRows?.length ?? 0,
    rating,
    reviewCount,
    hourlyRate: priceRow?.hourly_rate ?? undefined,
    monthlyRate: priceRow?.monthly_rate ?? undefined,
    adHeadline: adRow?.title ?? undefined,
    adText: adRow?.content ?? undefined,
    batches: (batchRows ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      teacherName: b.teacher_label,
      status: b.status === "upcoming" ? "upcoming" : "started",
      mode: b.mode as "online" | "physical",
      location: b.location,
      scheduleNote: b.schedule_note,
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      author: r.author ?? "Anonymous",
      date: dateFormatter.format(new Date(r.created_at)),
      rating: r.rating,
      body: r.body ?? "",
      reply: r.reply ?? undefined,
    })),
    phone,
    teachers: (teacherRows ?? []).map((t) => ({
      id: t.teacher_id,
      displayName: t.display_name ?? "—",
      photoUrl: t.photo_url,
      headline: t.headline,
      subjects: t.subjects ?? [],
      hourlyRate: t.hourly_rate ?? undefined,
      monthlyRate: t.monthly_rate ?? undefined,
      rating: t.rating,
      reviewCount: t.review_count,
      isCampusLecturer: t.is_campus_lecturer,
      bio: t.bio,
      qualifications: t.qualifications ?? [],
      workExperience: t.work_experience ?? [],
      experienceYears: t.experience_years,
      languages: t.languages ?? [],
      academicTitle: t.academic_title,
      institution: t.institution,
      publications: t.publications ?? [],
    })),
  } satisfies ClassProfileDetail;
}
