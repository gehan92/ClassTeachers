import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TeachersSearch } from "@/components/features/teachers-search";
import { getPublicListings } from "@/lib/public-directory";

export async function generateMetadata({ params }: PageProps<"/[locale]/teachers">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("teachersTitle"), description: t("teachersDescription") };
}

const headingKeyByCategory = {
  teacher: { title: "titleTeacher", subtitle: "subtitleTeacher" },
  class: { title: "titleClass", subtitle: "subtitleClass" },
  campus: { title: "titleCampus", subtitle: "subtitleCampus" },
} as const;

function headingKeys(category: string | string[] | undefined, online: string | string[] | undefined) {
  // Checked first regardless of category — "Search Online Lessons" always
  // sends category=teacher, so without this an online-lessons visitor would
  // see the exact same generic "Find your teacher" heading as a plain
  // teacher search, with nothing marking the view as different.
  if (online === "true") {
    return { title: "titleOnline", subtitle: "subtitleOnline" } as const;
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
  const listings = await getPublicListings(tPage, tSearch);
  const { title, subtitle } = headingKeys(resolvedSearchParams.category, resolvedSearchParams.online);

  return (
    <section className="py-12">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-7">
          <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
            {tPage("eyebrow")}
          </div>
          <h1 className="text-[32px]">{tPage(title)}</h1>
          <p className="text-muted-foreground">{tPage(subtitle)}</p>
        </div>
        <Suspense>
          <TeachersSearch listings={listings} />
        </Suspense>
      </div>
    </section>
  );
}
