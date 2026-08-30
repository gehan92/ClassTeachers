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
 * Class listings read from list_public_classes() (supabase/migrations/0021) — teacher
 * listings instead read from list_teacher_ads() (0040): "Find teachers" now
 * lists active, batch-scoped ads rather than every approved profile, so a
 * teacher with no ad simply isn't discoverable here (list_public_teachers
 * still exists for other callers, e.g. an already-enrolled student's own
 * dashboard). Each card links to the limited-detail /ad/[id] landing page,
 * not the full /teacher/[id] profile.
 */
export async function getPublicListings(tPage: Translator, tSearch: Translator): Promise<Listing[]> {
  const supabase = await createClient();
  const [{ data: adRows }, { data: classRows }, { data: classAdRows }] = await Promise.all([
    supabase.rpc("list_teacher_ads"),
    supabase.rpc("list_public_classes"),
    supabase.rpc("list_class_batch_ads"),
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
      verified: row.institution_verified,
      rating: Number(row.rating),
      reviewCount: Number(row.review_count),
      subjects,
      price,
      href: `/ad/${row.ad_id}`,
      campusCredential: row.is_campus_lecturer
        ? {
            institution: row.institution,
            academicTitle: row.academic_title,
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
      verified: row.institution_verified,
      rating: Number(row.rating),
      reviewCount: Number(row.review_count),
      subjects: row.subjects,
      price,
      href: `/class/${row.id}`,
    };
    return [listing];
  });

  // Class-wise ads (0103, additive alongside the always-visible whole-
  // institute cards above) — one card per active batch ad, same "ads-only"
  // shape a teacher ad card has: headline/excerpt from the ad copy, price
  // from the batch (falling back to the institute's default rate).
  const classAdListings: Listing[] = (classAdRows ?? []).flatMap((row) => {
    const price = priceFrom(row.hourly_rate, row.monthly_rate);
    if (!price) return [];

    const online = row.mode === "online";
    const subjects = row.subject ? [row.subject] : [];
    const roleLabel = [tPage("roleClass"), row.location, online ? tPage("online") : null].filter(Boolean).join(" · ");

    const listing: Listing = {
      id: row.ad_id,
      kind: "class",
      name: row.name,
      masked: false,
      roleLabel,
      headline: row.ad_title,
      excerpt: row.ad_content ?? undefined,
      gradeChip: gradeChip(row.grade_band, subjects, tPage, tSearch),
      location: row.location ?? "",
      online,
      gradeBand: (row.grade_band as GradeBand | null) ?? null,
      gradeBands: row.grade_band ? [row.grade_band as GradeBand] : [],
      avatarInitials: "🏫",
      photoUrl: row.photo_url ?? undefined,
      verified: row.institution_verified,
      rating: Number(row.rating),
      reviewCount: Number(row.review_count),
      subjects,
      price,
      href: `/ad/${row.ad_id}`,
    };
    return [listing];
  });

  return [...teacherListings, ...classListings, ...classAdListings];
}

export type ActiveSiteAd = { title: string; content: string | null };

/**
 * The homepage's ad slot (FeaturedSection) — an admin-booked sponsor
 * placement (createSiteAd, admin-actions.ts) with owner_type='site',
 * placement='homepage_banner'. Falls back to null (the "sell this slot"
 * placeholder) when nothing is booked, same table/RLS path already used
 * for teacher/class ads (see teacher/[id]/page.tsx's own_profile query).
 * Filters expiry in JS rather than in the query, matching admin/page.tsx's
 * existing isWithinDays approach — RLS only guarantees this for anon/plain
 * visitors, not for an admin or the ad's own purchaser browsing while
 * signed in, who'd otherwise see rows RLS still permits past that point.
 */
export async function getActiveSiteAd(): Promise<ActiveSiteAd | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("advertisements")
    .select("title, content, expires_at")
    .eq("owner_type", "site")
    .eq("placement", "homepage_banner")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return null;

  return { title: data.title, content: data.content };
}
