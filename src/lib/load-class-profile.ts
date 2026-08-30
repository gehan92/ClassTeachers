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
    { data: adRows },
    { data: batchAdRows },
    { data: teacherRows },
    { data: phone },
  ] = await Promise.all([
    supabase.from("prices").select("hourly_rate, monthly_rate").eq("owner_type", "class").eq("owner_id", id).maybeSingle(),
    supabase.rpc("list_public_reviews", { p_target_type: "class", p_target_id: id }),
    supabase
      .from("batches")
      .select("id, title, mode, location, schedule_note, teacher_label, taught_by_teacher_id, status")
      .eq("owner_type", "class")
      .eq("owner_id", id)
      .in("status", ["active", "upcoming"])
      .order("created_at", { ascending: false }),
    // Multiple institute-wide promotions (0104) — was .maybeSingle().
    supabase
      .from("advertisements")
      .select("id, content, title")
      .eq("owner_type", "class")
      .eq("owner_id", id)
      .eq("placement", "own_profile")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    // Class-wise ad copy (0103/0104) — shown on each batch card here too,
    // not just as a separate search-result card.
    supabase
      .from("advertisements")
      .select("id, batch_id, title, content")
      .eq("owner_type", "class")
      .eq("owner_id", id)
      .eq("placement", "search_results")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    // Institute Blueprint step 4a (0096) — the real roster, not just a
    // count; accepted+visible+approved only, same gate the count uses.
    supabase.rpc("list_institute_teachers", { p_class_id: id }),
    supabase.rpc("get_class_contact", { p_class_id: id }),
  ]);

  const batchAdsByBatchId = new Map<string, { id: string; title: string; content: string }[]>();
  for (const ad of batchAdRows ?? []) {
    if (!ad.batch_id) continue;
    const list = batchAdsByBatchId.get(ad.batch_id) ?? [];
    list.push({ id: ad.id, title: ad.title, content: ad.content ?? "" });
    batchAdsByBatchId.set(ad.batch_id, list);
  }

  // Real roster link wins when set; falls back to the old free-text label
  // for batches created before 0091 that haven't been re-saved since — same
  // resolution the institute dashboard's own Classes & Batches tab already
  // does (institute/page.tsx's teacherNameById), which this page previously
  // skipped, so a batch with only a linked teacher (no free-text label)
  // showed nothing here despite showing correctly in the dashboard.
  const teacherNameById = new Map((teacherRows ?? []).map((t) => [t.teacher_id, t.display_name]));

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
    promotions: (adRows ?? []).map((row) => ({ id: row.id, headline: row.title, text: row.content ?? "" })),
    batches: (batchRows ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      teacherName: (b.taught_by_teacher_id && teacherNameById.get(b.taught_by_teacher_id)) || b.teacher_label,
      status: b.status === "upcoming" ? "upcoming" : "started",
      mode: b.mode as "online" | "physical",
      location: b.location,
      scheduleNote: b.schedule_note,
      ads: batchAdsByBatchId.get(b.id) ?? [],
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
