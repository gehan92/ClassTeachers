import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/features/legal-page";
import { getSiteContent } from "@/lib/site-content";
import { localeAlternates } from "@/lib/site-url";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("termsTitle"), description: t("termsDescription"), alternates: localeAlternates(locale, "/terms") };
}

export default async function Page({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = await getSiteContent();
  return <LegalPage namespace="termsPage" contactEmail={content.contact.email} />;
}
