import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { WantedAdsBoard } from "@/components/features/wanted-ads-board";
import type { PublicWantedAd } from "@/components/features/wanted-ads-board";
import { createClient } from "@/lib/supabase/server";
import { createDateFormatter } from "@/lib/format-date";

export default async function RequestsPage({ params }: PageProps<"/[locale]/requests">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const dateFormatter = createDateFormatter(locale);

  const supabase = await createClient();
  const { data: adRows } = await supabase.rpc("list_public_wanted_ads");

  const ads: PublicWantedAd[] = (adRows ?? []).map((row) => ({
    id: row.id,
    lookingFor: row.looking_for as "teacher" | "institute",
    subject: row.subject,
    mode: row.mode as "online" | "physical" | "both" | null,
    gradeLevel: row.grade_level,
    title: row.title,
    description: row.description,
    createdLabel: dateFormatter.format(new Date(row.created_at)),
  }));

  return (
    <>
      <Hero />
      <WantedAdsBoard ads={ads} />
    </>
  );
}

function Hero() {
  const t = useTranslations("requestsPage");

  return (
    <section className="border-b border-border bg-primary py-16">
      <div className="mx-auto max-w-160 px-7 text-center">
        <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-white/70 before:inline-block before:h-px before:w-4 before:bg-white/70 before:content-['']">
          {t("hero.eyebrow")}
        </div>
        <h1 className="mb-4.5 text-[32px] leading-[1.1] text-white sm:text-[44px]">{t("hero.title")}</h1>
        <p className="mx-auto max-w-[46ch] text-[17px] text-white/80">{t("hero.subtitle")}</p>
      </div>
    </section>
  );
}
