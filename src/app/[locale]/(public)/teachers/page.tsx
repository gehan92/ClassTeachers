import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { TeachersSearch } from "@/components/features/teachers-search";
import { allListings } from "@/lib/mock-data";

export default async function TeachersPage({ params }: PageProps<"/[locale]/teachers">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <section className="py-12">
      <div className="mx-auto max-w-[1180px] px-7">
        <Header />
        <Suspense>
          <TeachersSearch listings={allListings} />
        </Suspense>
      </div>
    </section>
  );
}

function Header() {
  const t = useTranslations("teachersPage");

  return (
    <div className="mb-7">
      <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
        {t("eyebrow")}
      </div>
      <h1 className="text-[32px]">{t("title")}</h1>
      <p className="text-muted-foreground">{t("subtitle")}</p>
    </div>
  );
}
