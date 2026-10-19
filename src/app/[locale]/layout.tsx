import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { routing } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import { VisitTracker } from "@/components/analytics/visit-tracker";
import { getSiteUrl } from "@/lib/site-url";
import { publicClientMessages } from "@/i18n/client-messages";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  // Defaults for every page; each page sets its own title, description and
  // canonical link. Link previews fall back to opengraph-image.tsx.
  return {
    metadataBase: new URL(getSiteUrl()),
    title: t("homeTitle"),
    description: t("homeDescription"),
    applicationName: "ClassPortals",
    openGraph: {
      siteName: "ClassPortals",
      type: "website",
      locale: locale === "si" ? "si_LK" : locale === "ta" ? "ta_LK" : "en_LK",
    },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Renders this layout statically per-locale instead of on every request.
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} data-locale={locale} data-scroll-behavior="smooth" className={fontVariables}>
      <body className="min-h-full flex flex-col">
        {/* Public pages get only the translations they use; (dashboard)/layout.tsx
            and admin/layout.tsx wrap their pages in a provider with the full set. */}
        <NextIntlClientProvider messages={publicClientMessages(messages)}>
          {children}
          {/* Anonymous page-visit counter for Admin -> Traffic (0165). */}
          <Suspense fallback={null}>
            <VisitTracker />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
