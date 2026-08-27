import type { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { GradeBand } from "@/types/grade-band";
import type { Listing } from "@/types/listing";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

function gradeChip(gradeBand: string | null, subjects: string[], tPage: Translator, tSearch: Translator) {
  const gradeLabel = gradeBand ? tSearch(`grades.${gradeBand}`) : null;
  const subjectLabel = subjects[0];
  if (gradeLabel && subjectLabel) return `${gradeLabel} · ${subjectLabel}`;
  if (gradeLabel) return gradeLabel;
  if (subjectLabel) return subjectLabel;
  return tPage("allSubjects");
}

/** Prefer hourly over monthly for the card's headline price; a listing with neither isn't ready to compare, so it's left out of search entirely (see getPublicListings). */
function priceFrom(hourlyRate: number | null, monthlyRate: number | null): Listing["price"] | null {
  if (hourlyRate != null) return { amount: Number(hourlyRate), currency: "LKR", interval: "hr" };
  if (monthlyRate != null) return { amount: Number(monthlyRate), currency: "LKR", interval: "mo" };
  return null;
}

/**
 * Real replacement for src/lib/mock-data/listings.ts. Class listings still
 * read from list_public_classes() (supabase/migrations/0021) — teacher
 * listings instead read from list_teacher_ads() (0040): "Find teachers" now
 * lists active, batch-scoped ads rather than every approved profile, so a
 * teacher with no ad simply isn't discoverable here (list_public_teachers
 * still exists for other callers, e.g. an already-enrolled student's own
 * dashboard). Each card links to the limited-detail /ad/[id] landing page,
 * not the full /teacher/[id] profile.
 */
export async function getPublicListings(tPage: Translator, tSearch: Translator): Promise<Listing[]> {
  const supabase = await createClient();
  const [{ data: adRows }, { data: classRows }] = await Promise.all([
    supabase.rpc("list_teacher_ads"),
    supabase.rpc("list_public_classes"),
  ]);

  const teacherListings: Listing[] = (adRows ?? []).flatMap((row) => {
    const price = priceFrom(row.hourly_rate, row.monthly_rate);
    if (!price || !row.display_name) return [];

    const online = row.mode === "online";
    const subjects = row.subject ? [row.subject] : [];
    const roleLabel = row.is_campus_lecturer
      ? [tPage("roleCampusLecturer"), row.institution ?? row.location, online ? tPage("online") : null]
          .filter(Boolean)
          .join(" · ")
      : [tPage("roleTeacher"), row.location, online ? tPage("online") : null].filter(Boolean).join(" · ");

    const listing: Listing = {
      id: row.ad_id,
      kind: "teacher",
      name: row.display_name,
      masked: true,
      roleLabel,
      headline: row.ad_title,
      excerpt: row.ad_content ?? undefined,
      gradeChip: gradeChip(row.grade_band, subjects, tPage, tSearch),
      location: row.location ?? "",
      online,
      gradeBand: (row.grade_band as GradeBand | null) ?? null,
      gradeBands: row.grade_band ? [row.grade_band as GradeBand] : [],
      avatarInitials: row.display_name.split(" ")[0] ?? row.display_name,
      photoUrl: row.photo_url ?? undefined,
      rating: Number(row.rating),
      reviewCount: Number(row.review_count),
      subjects,
      price,
      href: `/ad/${row.ad_id}`,
      campusCredential: row.is_campus_lecturer
        ? {
            institution: row.institution,
            academicTitle: row.academic_title,
            verified: row.institution_verified,
            courseCode: row.course_code,
          }
        : undefined,
    };
    return [listing];
  });

  const classListings: Listing[] = (classRows ?? []).flatMap((row) => {
    const price = priceFrom(row.hourly_rate, row.monthly_rate);
    if (!price) return [];

    const roleLabel = [
      tPage("roleClass"),
      row.teacher_count > 0 ? tPage("teacherCount", { count: row.teacher_count }) : null,
      row.location,
      row.online ? tPage("online") : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const listing: Listing = {
      id: row.id,
      kind: "class",
      name: row.name,
      masked: false,
      roleLabel,
      gradeChip: gradeChip(row.grade_band, row.subjects, tPage, tSearch),
      location: row.location ?? "",
      online: row.online,
      gradeBand: (row.grade_band as GradeBand | null) ?? null,
      gradeBands: (row.grade_bands as GradeBand[] | null) ?? [],
      avatarInitials: "🏫",
      rating: Number(row.rating),
      reviewCount: Number(row.review_count),
      subjects: row.subjects,
      price,
      href: `/class/${row.id}`,
    };
    return [listing];
  });

  return [...teacherListings, ...classListings];
}
