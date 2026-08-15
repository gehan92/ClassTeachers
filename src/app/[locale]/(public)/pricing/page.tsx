import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { ComingSoon } from "@/components/features/coming-soon";

export default async function PricingPage({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PricingContent />;
}

function PricingContent() {
  const t = useTranslations("pricingPage");
  return <ComingSoon title={t("title")} body={t("body")} />;
}
