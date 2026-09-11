import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WantedAdsBoard } from "@/components/features/wanted-ads-board";
import type { PublicWantedAd } from "@/components/features/wanted-ads-board";
import { Eyebrow } from "@/components/features/eyebrow";
import { createClient } from "@/lib/supabase/server";
import { createDateFormatter } from "@/lib/format-date";
import { sanitizeRichTextNullable } from "@/lib/dashboard/sanitize-rich-text";

export async function generateMetadata({ params }: PageProps<"/[locale]/requests">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("requestsTitle"), description: t("requestsDescription") };
}

export default async function RequestsPage({ params }: PageProps<"/[locale]/requests">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const dateFormatter = createDateFormatter(locale);
  const t = await getTranslations("requestsPage");

  const supabase = await createClient();
  const { data: adRows } = await supabase.rpc("list_public_wanted_ads");

  const ads: PublicWantedAd[] = (adRows ?? []).map((row) => ({
    id: row.id,
    lookingFor: row.looking_for as "teacher" | "institute",
    subject: row.subject,
    mode: row.mode as "online" | "physical" | "both" | null,
    gradeLevel: row.grade_level,
    medium: row.medium as "english" | "sinhala" | "tamil" | "other",
    classType: row.class_type as "new" | "revision",
    title: row.title,
    description: sanitizeRichTextNullable(row.description),
    createdLabel: dateFormatter.format(new Date(row.created_at)),
  }));

  return (
    <>
      {/* Same tinted-band heading shape as /teachers — this is another
       * searchable listing page, not a marketing landing page, so it
       * should match /teachers rather than /advertise. */}
      <section style={{ background: "var(--muted)" }} className="py-5">
        <div className="mx-auto max-w-[1180px] px-7">
          <Eyebrow>{t("hero.eyebrow")}</Eyebrow>
          <h1 className="text-[32px]">{t("hero.title")}</h1>
          <p className="text-muted-foreground mb-0">{t("hero.subtitle")}</p>
        </div>
      </section>
      <section className="py-12">
        <div className="mx-auto max-w-[1180px] px-7">
          <WantedAdsBoard ads={ads} />
        </div>
      </section>
    </>
  );
}
