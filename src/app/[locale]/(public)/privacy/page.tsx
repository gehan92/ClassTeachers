import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { ComingSoon } from "@/components/features/coming-soon";

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PrivacyContent />;
}

function PrivacyContent() {
  const t = useTranslations("privacyPage");
  return <ComingSoon title={t("title")} body={t("body")} />;
}
