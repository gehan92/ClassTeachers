import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TeachersSearch } from "@/components/features/teachers-search";
import { getPublicListings } from "@/lib/public-directory";

const headingKeyByCategory = {
  teacher: { title: "titleTeacher", subtitle: "subtitleTeacher" },
  class: { title: "titleClass", subtitle: "subtitleClass" },
  campus: { title: "titleCampus", subtitle: "subtitleCampus" },
} as const;

function headingKeys(category: string | string[] | undefined) {
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
  const { title, subtitle } = headingKeys(resolvedSearchParams.category);

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
