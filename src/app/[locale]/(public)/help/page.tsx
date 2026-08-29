import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/help">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("helpTitle"), description: t("helpDescription") };
}

export default async function HelpPage({ params }: PageProps<"/[locale]/help">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <section className="py-14">
      <div className="mx-auto max-w-160 px-7">
        <Header />
        <Faq />
      </div>
    </section>
  );
}

function Header() {
  const t = useTranslations("helpPage");

  return (
    <div className="mb-8 text-center">
      <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
        {t("eyebrow")}
      </div>
      <h1 className="text-[32px]">{t("title")}</h1>
      <p className="text-muted-foreground">{t("subtitle")}</p>
    </div>
  );
}

function Faq() {
  const t = useTranslations("helpPage");
  const items = t.raw("faq") as { question: string; answer: string }[];

  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-white">
      {items.map((item) => (
        <details key={item.question} className="group p-4.5">
          <summary className="cursor-pointer list-none font-semibold text-foreground marker:content-none">
            <span className="mr-2 inline-block text-accent-deep transition-transform group-open:rotate-45">+</span>
            {item.question}
          </summary>
          <p className="mt-2.5 pl-5.5 text-sm text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
