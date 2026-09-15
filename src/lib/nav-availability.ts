import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export type NavAvailability = {
  browseAll: boolean;
  browseIndependent: boolean;
  browseInstitutes: boolean;
  browseCampusLecturers: boolean;
  browseCourses: boolean;
  browseAdultLearning: boolean;
  requestsStudent: boolean;
  requestsTeacher: boolean;
  requestsInstitute: boolean;
};

/**
 * Powers the header's Search dropdown (site-header.tsx / dashboard-shell.tsx):
 * a Browse/Requests item is hidden entirely when its destination page would
 * currently show zero results, rather than sending a visitor to an empty
 * "No results" page.
 *
 * Deliberately duplicates (rather than reuses) the inclusion rules
 * getPublicListings() (public-directory.ts) applies, since that function
 * needs locale-bound translators this doesn't (only booleans are needed
 * here, no display text) — keep these two in sync by hand if either
 * changes:
 *  - teacher ad row counts iff display_name is set AND (it has an hourly
 *    or monthly rate OR is_lesson) — same as public-directory.ts's
 *    teacherListings filter.
 *  - class row counts iff it has an hourly or monthly rate — same as
 *    classListings.
 *  - class-batch-ad row counts iff it has a rate OR is_teacher_wise — same
 *    as classAdListings.
 * Category predicates below mirror teachers-search.tsx's matchesCategory/
 * isIndependent and courses/page.tsx's totalSessions/adult-audience check.
 *
 * Cached for 3 minutes (unstable_cache, anon-key client with no cookies —
 * every row read here is already public/anon-granted) since this renders
 * on every single page via the header. This only gates nav VISIBILITY, not
 * the actual search results a visitor sees on the destination page, so a
 * few minutes of staleness here is a much smaller trade-off than caching
 * real listings would be (see cached-subjects.ts for the same reasoning
 * applied elsewhere, and the perf audit's note on why public listings
 * themselves are deliberately NOT cached).
 */
export const getNavAvailability = unstable_cache(
  async (): Promise<NavAvailability> => {
    const supabase = createSupabaseClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
    const [
      { data: adRows },
      { data: classRows },
      { data: classAdRows },
      { data: wantedAdRows },
      { data: teacherSeekingRows },
      { data: vacancyRows },
    ] = await Promise.all([
      supabase.rpc("list_teacher_ads"),
      supabase.rpc("list_public_classes"),
      supabase.rpc("list_class_batch_ads"),
      supabase.rpc("list_public_wanted_ads"),
      supabase.rpc("list_public_teacher_seeking_ads"),
      supabase.rpc("list_public_vacancy_ads"),
    ]);

    const validAdRows = (adRows ?? []).filter(
      (r) => r.display_name && (r.hourly_rate != null || r.monthly_rate != null || r.is_lesson),
    );
    const validClassRows = (classRows ?? []).filter((r) => r.hourly_rate != null || r.monthly_rate != null);
    const validClassAdRows = (classAdRows ?? []).filter(
      (r) => r.hourly_rate != null || r.monthly_rate != null || r.is_teacher_wise,
    );

    return {
      browseAll: validAdRows.length > 0 || validClassRows.length > 0 || validClassAdRows.length > 0,
      browseIndependent: validAdRows.some((r) => r.is_independent === true),
      browseInstitutes: validClassRows.length > 0 || validClassAdRows.length > 0,
      browseCampusLecturers: validAdRows.some((r) => r.is_campus_lecturer === true),
      browseCourses: validAdRows.some((r) => r.total_sessions != null) || validClassAdRows.some((r) => r.total_sessions != null),
      browseAdultLearning:
        validAdRows.some((r) => r.total_sessions != null && r.grade_band === "adult") ||
        validClassAdRows.some((r) => r.total_sessions != null && r.grade_band === "adult"),
      requestsStudent: (wantedAdRows ?? []).some((r) => r.looking_for === "teacher"),
      requestsTeacher: (teacherSeekingRows ?? []).length > 0,
      requestsInstitute: (vacancyRows ?? []).length > 0,
    };
  },
  ["nav-availability"],
  { revalidate: 180, tags: ["nav-availability"] },
);
