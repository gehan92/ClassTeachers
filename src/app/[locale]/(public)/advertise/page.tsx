import type { Metadata } from "next";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Check, Mail, MessageCircle } from "lucide-react";
import { RoleCard } from "@/components/features/role-card";
import { AdBoard } from "@/components/features/ad-board";
import { Eyebrow } from "@/components/features/eyebrow";
import { getPublicListings } from "@/lib/public-directory";
import { getSiteContent, sitePhoto } from "@/lib/site-content";
import { AD_PLAN_KEYS, whatsappLink, type AdPlanKey, type SiteContent } from "@/lib/site-content-schema";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { localeAlternates } from "@/lib/site-url";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/advertise">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("advertiseTitle"), description: t("advertiseDescription"), alternates: localeAlternates(locale, "/advertise") };
}

/** Where "create your ad" goes for someone already signed in (from the role stored at sign-up). */
function dashboardAdsHref(role: unknown): string | null {
  if (role === "teacher" || role === "campus_lecturer") return "/teacher?tab=ads";
  if (role === "class") return "/institute?tab=ads";
  return null;
}

export default async function AdvertisePage({ params }: PageProps<"/[locale]/advertise">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [tPage, tSearch] = await Promise.all([
    getTranslations({ locale, namespace: "teachersPage" }),
    getTranslations({ locale, namespace: "search" }),
  ]);
  const [listings, content, user] = await Promise.all([
    getPublicListings(tPage, tSearch, locale),
    getSiteContent(),
    getAuthUser(),
  ]);

  return (
    <>
      <Hero photo={sitePhoto(content, "advertise")} />
      <CompareSection />
      {content.adPlans.show && <PlansSection content={content} />}
      <AdBoard listings={listings} dashboardAdsHref={dashboardAdsHref(user?.user_metadata?.role)} />
    </>
  );
}

function Hero({ photo }: { photo: string }) {
  const t = useTranslations("advertise");

  return (
    <section className="relative isolate overflow-hidden bg-primary-dark px-5 pt-28 pb-16 text-center text-white sm:pt-36 sm:pb-24">
      <Image src={photo} alt="" fill preload sizes="100vw" quality={70} className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-primary-dark/85" />
      <div className="mx-auto max-w-[680px]">
        <Eyebrow dark>{t("hero.eyebrow")}</Eyebrow>
        <h1 className="text-[clamp(1.9rem,4.5vw,2.9rem)] leading-tight text-balance text-white">{t("hero.title")}</h1>
        <p className="mx-auto mt-4 max-w-[52ch] text-white/80">{t("hero.subtitle")}</p>
        <a
          href="#postAd"
          className="mt-7 inline-flex items-center gap-2 rounded-lg bg-cta px-6 py-3 text-sm font-semibold text-cta-foreground transition-colors hover:bg-cta-hover"
        >
          {t("hero.cta")}
          <ArrowRight className="size-4" aria-hidden />
        </a>
      </div>
    </section>
  );
}

function CompareSection() {
  const t = useTranslations("advertise");
  const options = ["standalone", "fullProfile"] as const;

  return (
    <section className="py-16">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-7">
        <div className="mb-8">
          <Eyebrow>{t("compare.eyebrow")}</Eyebrow>
          <h2 className="text-[clamp(1.6rem,3vw,2.1rem)] leading-tight">{t("compare.title")}</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {options.map((option) => (
            <RoleCard
              key={option}
              tag={t(`compare.${option}.tag`)}
              title={t(`compare.${option}.title`)}
              description={t(`compare.${option}.description`)}
              points={t.raw(`compare.${option}.points`) as string[]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Plans are booked with the ClassPortals team (no online payment yet), so
 * each "Book" button opens a WhatsApp chat — or an email — that already
 * names the plan. With neither contact set it falls back to signing up.
 */
function PlansSection({ content }: { content: SiteContent }) {
  const t = useTranslations("advertise");
  const { whatsapp, email } = content.contact;

  function bookingLink(plan: AdPlanKey, planName: string) {
    const message = t("plans.bookingMessage", { plan: planName });
    const wa = whatsappLink(whatsapp, message);
    if (wa) return { href: wa, external: true, icon: MessageCircle, label: t("plans.bookWhatsapp") };
    if (email) {
      const mail = `mailto:${email}?subject=${encodeURIComponent(t("plans.bookingSubject", { plan: planName }))}&body=${encodeURIComponent(message)}`;
      return { href: mail, external: true, icon: Mail, label: t("plans.bookEmail") };
    }
    return { href: "#postAd", external: false, icon: ArrowRight, label: t(`plans.${plan}.cta`) };
  }

  return (
    <section id="plans" className="scroll-mt-24 border-y border-border bg-white py-16">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-7">
        <div className="mb-8 max-w-[680px]">
          <Eyebrow>{t("plans.eyebrow")}</Eyebrow>
          <h2 className="text-[clamp(1.6rem,3vw,2.1rem)] leading-tight">{t("plans.title")}</h2>
          <p className="mt-2 text-muted-foreground">{t("plans.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {AD_PLAN_KEYS.map((plan) => {
            const isFeatured = plan === "featured";
            const features = t.raw(`plans.${plan}.features`) as string[];
            const name = t(`plans.${plan}.title`);
            const price = content.adPlans.prices[plan] || t(`plans.${plan}.price`);
            const booking = bookingLink(plan, name);
            const Icon = booking.icon;

            return (
              <div
                key={plan}
                className={cn(
                  "relative flex flex-col rounded-xl border bg-white p-6",
                  isFeatured ? "border-primary shadow-[0_18px_40px_-20px_rgba(27,35,51,0.45)]" : "border-border",
                )}
              >
                {isFeatured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 font-mono text-[11px] tracking-wide text-primary-foreground uppercase">
                    {t("plans.featured.badge")}
                  </span>
                )}
                <span className="mb-3 inline-block w-fit rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] tracking-wide text-secondary-foreground">
                  {t(`plans.${plan}.days`)}
                </span>
                <h3 className="text-lg">{name}</h3>
                <div className="mt-1 mb-4 font-display text-[28px] text-primary">
                  {price}
                  <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">{t(`plans.${plan}.priceSuffix`)}</span>
                </div>
                <ul className="mb-6 flex-1 space-y-2 text-[13.5px] text-muted-foreground">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href={booking.href}
                  {...(booking.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors",
                    isFeatured
                      ? "bg-primary text-primary-foreground hover:bg-primary-light"
                      : "border border-input text-primary hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {booking.label}
                </a>
              </div>
            );
          })}
        </div>
        <p className="mt-5 text-sm text-muted-foreground">{t("plans.freeNote")}</p>
      </div>
    </section>
  );
}
