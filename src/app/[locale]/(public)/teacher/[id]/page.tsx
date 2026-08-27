import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { TeacherProfileView } from "@/components/features/teacher-profile-view";
import { createClient } from "@/lib/supabase/server";
import { createDateFormatter } from "@/lib/format-date";
import type { TeacherProfileDetail } from "@/types/teacher-profile";

async function loadTeacherProfile(
  id: string,
  locale: string,
): Promise<TeacherProfileDetail | null> {
  const supabase = await createClient();

  const [{ data: rows, error }, { data: reviewRows }, { data: batchRows }, { data: noteRows }, { data: phone }, { data: adRow }] =
    await Promise.all([
      supabase.rpc("get_public_teacher_profile", { p_teacher_id: id }),
      supabase.rpc("list_public_reviews", { p_target_type: "teacher", p_target_id: id }),
      supabase
        .from("batches")
        .select("id, title, mode, location, schedule_note, grade_band")
        .eq("owner_type", "teacher")
        .eq("owner_id", id)
        .eq("status", "active"),
      // RLS-gated (0008): only returns rows when the current viewer is the
      // owner, an enrolled student, or an admin — everyone else gets an
      // empty array here, which is the correct "you can't see these" signal.
      supabase.from("notes").select("id, title, page_count").eq("owner_type", "teacher").eq("owner_id", id),
      supabase.rpc("get_teacher_contact", { p_teacher_id: id }),
      supabase
        .from("advertisements")
        .select("content, title")
        .eq("owner_type", "teacher")
        .eq("owner_id", id)
        .eq("placement", "own_profile")
        .maybeSingle(),
    ]);

  if (error || !rows || rows.length === 0) {
    return null;
  }
  const teacher = rows[0];

  // Active search_results ads for this teacher's batches, so the schedule
  // list below can link each class through to the ad that has its price
  // (0041 removed the single profile-level price from this page).
  const { data: batchAdRows } = await supabase
    .from("advertisements")
    .select("id, batch_id")
    .eq("owner_type", "teacher")
    .eq("owner_id", id)
    .eq("placement", "search_results")
    .eq("status", "active");
  const adIdByBatchId = new Map((batchAdRows ?? []).filter((a) => a.batch_id).map((a) => [a.batch_id as string, a.id]));

  const dateFormatter = createDateFormatter(locale);

  return {
    id: teacher.id,
    name: teacher.display_name ?? "Teacher",
    headline: teacher.headline,
    bio: teacher.bio,
    location: teacher.location,
    classType: (teacher.class_type as TeacherProfileDetail["classType"]) ?? "physical",
    experienceYears: teacher.experience_years,
    qualifications: teacher.qualifications ?? [],
    workExperience: teacher.work_experience ?? [],
    photoUrl: teacher.photo_url,
    subjects: teacher.subjects ?? [],
    languages: teacher.languages ?? [],
    gradeBand: teacher.grade_band,
    rating: teacher.rating,
    reviewCount: teacher.review_count,
    avatarInitials: (teacher.display_name ?? "T").charAt(0).toUpperCase(),
    hourlyRate: teacher.hourly_rate ?? undefined,
    monthlyRate: teacher.monthly_rate ?? undefined,
    adHeadline: adRow?.title ?? undefined,
    adText: adRow?.content ?? undefined,
    notesCount: teacher.notes_count,
    notes: (noteRows ?? []).map((n) => ({ id: n.id, title: n.title, pageCount: n.page_count })),
    schedule: (batchRows ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      mode: b.mode as "online" | "physical",
      location: b.location,
      scheduleNote: b.schedule_note,
      gradeBand: b.grade_band,
      adId: adIdByBatchId.get(b.id) ?? null,
    })),
    reviews: (reviewRows ?? []).map((r) => ({
      id: r.id,
      author: r.author ?? "Anonymous",
      date: dateFormatter.format(new Date(r.created_at)),
      rating: r.rating,
      body: r.body ?? "",
      reply: r.reply ?? undefined,
    })),
    phone,
    contactMode: (teacher.contact_mode as TeacherProfileDetail["contactMode"]) ?? "phone",
    isCampusLecturer: teacher.is_campus_lecturer,
    institution: teacher.institution,
    academicTitle: teacher.academic_title,
    institutionVerified: teacher.institution_verified,
    publications: teacher.publications ?? [],
  } satisfies TeacherProfileDetail;
}

export default async function TeacherProfilePage({
  params,
}: PageProps<"/[locale]/teacher/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const teacher = await loadTeacherProfile(id, locale);
  if (!teacher) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <TeacherProfileView teacher={teacher} showGate={!user} backHref="/teachers" />;
}
