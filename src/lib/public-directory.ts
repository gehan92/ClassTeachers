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
 * Real replacement for src/lib/mock-data/listings.ts. Reads from
 * list_public_teachers()/list_public_classes() (supabase/migrations/
 * 0021_public_directory.sql) instead of the profiles/class_profiles tables
 * directly — teacher names go through get_teacher_contact-style masking
 * server-side, see that migration for why a plain join can't be used here.
 */
export async function getPublicListings(tPage: Translator, tSearch: Translator): Promise<Listing[]> {
  const supabase = await createClient();
  const [{ data: teacherRows }, { data: classRows }] = await Promise.all([
    supabase.rpc("list_public_teachers"),
    supabase.rpc("list_public_classes"),
  ]);

  const teacherListings: Listing[] = (teacherRows ?? []).flatMap((row) => {
    const price = priceFrom(row.hourly_rate, row.monthly_rate);
    if (!price || !row.display_name) return [];

    const online = row.class_type !== "physical";
    const roleBase = row.role === "campus_lecturer" ? tPage("roleCampusLecturer") : tPage("roleTeacher");
    const roleLabel = [roleBase, row.location, online ? tPage("online") : null].filter(Boolean).join(" · ");

    const listing: Listing = {
      id: row.id,
      kind: "teacher",
      name: row.display_name,
      masked: true,
      roleLabel,
      gradeChip: gradeChip(row.grade_band, row.subjects, tPage, tSearch),
      location: row.location ?? "",
      online,
      gradeBand: (row.grade_band as GradeBand | null) ?? null,
      avatarInitials: row.display_name.split(" ")[0] ?? row.display_name,
      rating: Number(row.rating),
      reviewCount: Number(row.review_count),
      subjects: row.subjects,
      price,
      href: `/teacher/${row.id}`,
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
