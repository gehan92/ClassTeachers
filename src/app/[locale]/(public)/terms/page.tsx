import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { ComingSoon } from "@/components/features/coming-soon";

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TermsContent />;
}

function TermsContent() {
  const t = useTranslations("termsPage");
  return <ComingSoon title={t("title")} body={t("body")} />;
}
