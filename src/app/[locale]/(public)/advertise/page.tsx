import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check } from "lucide-react";
import { RoleCard } from "@/components/features/role-card";
import { AdBoard } from "@/components/features/ad-board";
import { Eyebrow } from "@/components/features/eyebrow";
import { getPublicListings } from "@/lib/public-directory";
import { cn } from "@/lib/utils";

// Same verified-working Pexels photo already used for the Home page's
// spotlight cards (rq_md/page/classportals-home-v3.html) — reused here at a
// wider crop for this page's own hero, not a new/invented photo ID.
const HERO_PHOTO =
  "https://images.pexels.com/photos/8423049/pexels-photo-8423049.jpeg?auto=compress&cs=tinysrgb&w=1920&h=800&fit=crop";

export async function generateMetadata({ params }: PageProps<"/[locale]/advertise">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("advertiseTitle"), description: t("advertiseDescription") };
}

export default async function AdvertisePage({ params }: PageProps<"/[locale]/advertise">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [tPage, tSearch] = await Promise.all([
    getTranslations({ locale, namespace: "teachersPage" }),
    getTranslations({ locale, namespace: "search" }),
  ]);
  const listings = await getPublicListings(tPage, tSearch);

  return (
    <>
      <Hero />
      <CompareSection />
      <PlansSection />
      <AdBoard listings={listings} />
    </>
  );
}

function Hero() {
  const t = useTranslations("advertise");

  return (
    <section
      className="position-relative text-center text-white"
      style={{
        backgroundImage: `linear-gradient(0deg, rgba(27,35,51,0.92), rgba(27,35,51,0.72)), url('${HERO_PHOTO}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: "140px 24px 96px",
      }}
    >
      <div className="d-flex justify-content-center">
        <Eyebrow dark>{t("hero.eyebrow")}</Eyebrow>
      </div>
      <h1 className="mx-auto mb-3" style={{ maxWidth: 640, fontSize: "clamp(1.9rem, 4vw, 2.8rem)", color: "#fff" }}>
        {t("hero.title")}
      </h1>
      <p className="mx-auto mb-4" style={{ maxWidth: 520, color: "rgba(255,255,255,0.85)" }}>
        {t("hero.subtitle")}
      </p>
      <a
        href="#postAd"
        className="btn fw-semibold px-4 py-2 d-inline-block"
        style={{ background: "var(--cta)", color: "var(--cta-foreground)" }}
      >
        {t("hero.cta")}
      </a>
    </section>
  );
}

function CompareSection() {
  const t = useTranslations("advertise");

  const options = ["standalone", "fullProfile"] as const;

  return (
    <section className="py-15">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-7">
          <Eyebrow>{t("compare.eyebrow")}</Eyebrow>
          <h2 className="text-[28px]">{t("compare.title")}</h2>
        </div>

        <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
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

function PlansSection() {
  const t = useTranslations("advertise");

  const plans = ["basic", "featured", "spotlight"] as const;

  return (
    <section className="border-y border-border bg-white py-15">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-7">
          <Eyebrow>{t("plans.eyebrow")}</Eyebrow>
          <h2 className="text-[28px]">{t("plans.title")}</h2>
        </div>

        <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-3">
          {plans.map((plan) => {
            const isFeatured = plan === "featured";
            const features = t.raw(`plans.${plan}.features`) as string[];

            return (
              <div
                key={plan}
                className={cn(
                  "relative flex flex-col rounded-lg border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]",
                  isFeatured ? "border-primary" : "border-border",
                )}
              >
                {isFeatured && (
                  <span className="absolute -top-3 left-5.5 rounded-full bg-primary px-2.5 py-0.75 font-mono text-[11px] uppercase tracking-wide text-primary-foreground">
                    {t("plans.featured.badge")}
                  </span>
                )}

                <span className="mb-3 inline-block w-fit rounded-[3px] bg-secondary px-2 py-0.75 font-mono text-[11px] tracking-wide text-secondary-foreground">
                  {t(`plans.${plan}.days`)}
                </span>
                <h3 className="mb-1 text-lg">{t(`plans.${plan}.title`)}</h3>
                <div className="mb-3.5 font-display text-[28px] text-primary">
                  {t(`plans.${plan}.price`)}
                  <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">
                    {t(`plans.${plan}.priceSuffix`)}
                  </span>
                </div>

                <ul className="mb-5 flex-1 space-y-1.75 text-[13.5px] text-muted-foreground">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.75">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <a
                  href="#postAd"
                  className={cn(
                    "inline-flex items-center justify-center rounded-sm px-5 py-2.75 text-sm font-semibold transition-all hover:-translate-y-px",
                    isFeatured
                      ? "bg-primary text-primary-foreground hover:bg-primary-light"
                      : "border border-input text-primary hover:bg-white",
                  )}
                >
                  {t(`plans.${plan}.cta`)}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}


