import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/features/legal-page";
import { getSiteContent } from "@/lib/site-content";
import { localeAlternates } from "@/lib/site-url";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("privacyTitle"), description: t("privacyDescription"), alternates: localeAlternates(locale, "/privacy") };
}

export default async function Page({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = await getSiteContent();
  return <LegalPage namespace="privacyPage" contactEmail={content.contact.email} />;
}
