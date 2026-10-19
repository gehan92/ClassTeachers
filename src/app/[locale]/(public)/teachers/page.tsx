import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TeachersSearch } from "@/components/features/teachers-search";
import { Eyebrow } from "@/components/features/eyebrow";
import { getPublicListings } from "@/lib/public-directory";
import { localeAlternates } from "@/lib/site-url";

// Each view gets its own title, so search results and browser tabs tell them apart.
const metaTitleByView = {
  title: "teachersTitle",
  titleTeacher: "teachersTitleTeacher",
  titleClass: "teachersTitleClass",
  titleCampus: "teachersTitleCampus",
  titleOnline: "teachersTitleOnline",
  titleIndependent: "teachersTitleIndependent",
} as const;

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/teachers">): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: "meta" });
  const { title } = headingKeys(query.category, query.online, query.type);
  const view = new URLSearchParams();
  if (typeof query.category === "string" && query.category in headingKeyByCategory) view.set("category", query.category);
  if (query.type === "independent") view.set("type", "independent");
  if (query.online === "true") view.set("online", "true");
  const path = `/teachers${view.size ? `?${view.toString()}` : ""}`;
  return {
    title: t(metaTitleByView[title]),
    description: t("teachersDescription"),
    alternates: localeAlternates(locale, path),
  };
}

const headingKeyByCategory = {
  teacher: { title: "titleTeacher", subtitle: "subtitleTeacher" },
  class: { title: "titleClass", subtitle: "subtitleClass" },
  campus: { title: "titleCampus", subtitle: "subtitleCampus" },
} as const;

function headingKeys(
  category: string | string[] | undefined,
  online: string | string[] | undefined,
  type: string | string[] | undefined,
) {
  // Checked first regardless of category — "Search Online Lessons" always
  // sends category=teacher, so without this an online-lessons visitor would
  // see the exact same generic "Find your teacher" heading as a plain
  // teacher search, with nothing marking the view as different.
  if (online === "true") {
    return { title: "titleOnline", subtitle: "subtitleOnline" } as const;
  }
  if (type === "independent") {
    return { title: "titleIndependent", subtitle: "subtitleIndependent" } as const;
  }
  if (typeof category === "string" && category in headingKeyByCategory) {
    return headingKeyByCategory[category as keyof typeof headingKeyByCategory];
  }
  return { title: "title", subtitle: "subtitle" } as const;
}

export default async function TeachersPage({ params, searchParams }: PageProps<"/[locale]/teachers">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [tPage, tSearch, resolvedSearchParams] = await Promise.all([
    getTranslations({ locale, namespace: "teachersPage" }),
    getTranslations({ locale, namespace: "search" }),
    searchParams,
  ]);
  const listings = await getPublicListings(tPage, tSearch, locale);
  const { title, subtitle } = headingKeys(resolvedSearchParams.category, resolvedSearchParams.online, resolvedSearchParams.type);

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
