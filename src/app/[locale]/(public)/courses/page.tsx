import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/site-url";
import { TeachersSearch } from "@/components/features/teachers-search";
import { Eyebrow } from "@/components/features/eyebrow";
import { getPublicListings } from "@/lib/public-directory";

export async function generateMetadata({ params }: PageProps<"/[locale]/courses">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("coursesTitle"), description: t("coursesDescription"), alternates: localeAlternates(locale, "/courses") };
}

/**
 * "Courses" -- structured, multi-session offerings, distinct from an
 * ongoing tuition class. Rather than a separate entity/RPC, a course is
 * simply any listing whose underlying batch has total_sessions set (0139:
 * "a batch with a defined number of sessions instead of an open-ended
 * schedule" -- the same reuse this reasoning already got on the teacher and
 * institute dashboards). So this page reuses getPublicListings() unchanged
 * and just narrows to listings that carry a session count, then hands the
 * result to the exact same TeachersSearch grid /teachers uses — the
 * All/Teacher/Class/Campus category chips still work here, they just
 * further narrow within the course-only set instead of the full directory.
 */
export default async function CoursesPage({ params, searchParams }: PageProps<"/[locale]/courses">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [tPage, tSearch, resolvedSearchParams] = await Promise.all([
    getTranslations({ locale, namespace: "teachersPage" }),
    getTranslations({ locale, namespace: "search" }),
    searchParams,
  ]);
  const allListings = await getPublicListings(tPage, tSearch, locale);
  const isAdultAudience = resolvedSearchParams.audience === "adult";

  const listings = allListings.filter((listing) => {
    if (listing.totalSessions == null) return false;
    if (isAdultAudience && listing.gradeBand !== "adult" && !listing.gradeBands.includes("adult")) return false;
    return true;
  });

  const { title, subtitle } = isAdultAudience
    ? { title: "titleCoursesAdult", subtitle: "subtitleCoursesAdult" }
    : { title: "titleCourses", subtitle: "subtitleCourses" };

  return (
    <>
      <section className="border-b border-border bg-[radial-gradient(1000px_360px_at_85%_-20%,rgba(201,150,44,0.12),transparent_60%)] bg-muted/50 pt-10 pb-9">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-7">
          <Eyebrow>{tPage("eyebrow")}</Eyebrow>
          <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] leading-tight">{tPage(title)}</h1>
          <p className="mt-1.5 max-w-[62ch] text-muted-foreground">{tPage(subtitle)}</p>
        </div>
      </section>
      <section className="py-10">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-7">
          <Suspense>
            <TeachersSearch listings={listings} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
