import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Mail, MessageCircle, Phone, Plus } from "lucide-react";
import { Eyebrow } from "@/components/features/eyebrow";
import { getSiteContent } from "@/lib/site-content";
import { whatsappLink, type SiteContent } from "@/lib/site-content-schema";
import { localeAlternates } from "@/lib/site-url";

export async function generateMetadata({ params }: PageProps<"/[locale]/help">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("helpTitle"), description: t("helpDescription"), alternates: localeAlternates(locale, "/help") };
}

type FaqGroup = { title: string; items: { question: string; answer: string }[] };

export default async function HelpPage({ params }: PageProps<"/[locale]/help">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = await getSiteContent();

  return (
    <section className="py-14">
      <div className="mx-auto max-w-[760px] px-5 sm:px-7">
        <Header />
        <Faq />
        <ContactBox contact={content.contact} />
      </div>
    </section>
  );
}

function Header() {
  const t = useTranslations("helpPage");

  return (
    <div className="mb-10 text-center">
      <Eyebrow>{t("eyebrow")}</Eyebrow>
      <h1 className="text-[clamp(1.9rem,4.5vw,2.5rem)] leading-tight">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
    </div>
  );
}

function Faq() {
  const t = useTranslations("helpPage");
  const groups = t.raw("groups") as FaqGroup[];

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <div key={group.title}>
          <h2 className="mb-3 text-lg">{group.title}</h2>
          <div className="divide-y divide-border rounded-xl border border-border bg-white">
            {group.items.map((item) => (
              <details key={item.question} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-start gap-3 font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                  <Plus className="mt-0.5 size-4 shrink-0 text-accent-deep transition-transform group-open:rotate-45" aria-hidden />
                  {item.question}
                </summary>
                <p className="mt-2.5 pl-7 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactBox({ contact }: { contact: SiteContent["contact"] }) {
  const t = useTranslations("helpPage.contact");
  const whatsapp = whatsappLink(contact.whatsapp, t("whatsappMessage"));
  if (!whatsapp && !contact.email && !contact.phone) return null;

  const buttonClass =
    "inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors";

  return (
    <div className="mt-10 rounded-2xl bg-primary px-6 py-8 text-center text-white sm:px-10">
      <h2 className="text-xl text-white">{t("title")}</h2>
      <p className="mx-auto mt-2 max-w-[46ch] text-sm text-white/75">{t("body")}</p>
      {contact.hours && <p className="mt-1 text-xs text-white/60">{contact.hours}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`${buttonClass} bg-cta text-cta-foreground hover:bg-cta-hover`}>
            <MessageCircle className="size-4" aria-hidden />
            {t("whatsapp")}
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className={`${buttonClass} border border-white/30 text-white hover:bg-white/10`}>
            <Mail className="size-4" aria-hidden />
            {t("email")}
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className={`${buttonClass} border border-white/30 text-white hover:bg-white/10`}>
            <Phone className="size-4" aria-hidden />
            {contact.phone}
          </a>
        )}
      </div>
    </div>
  );
}
