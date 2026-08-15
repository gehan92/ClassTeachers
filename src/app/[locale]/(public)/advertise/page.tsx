import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Check } from "lucide-react";
import { RoleCard } from "@/components/features/role-card";
import { AdBoard } from "@/components/features/ad-board";
import { cn } from "@/lib/utils";

export default async function AdvertisePage({ params }: PageProps<"/[locale]/advertise">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <CompareSection />
      <PlansSection />
      <AdBoard />
    </>
  );
}

function Hero() {
  const t = useTranslations("advertise");

  return (
    <section className="border-b border-border bg-primary py-16">
      <div className="mx-auto max-w-160 px-7 text-center">
        <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-white/70 before:inline-block before:h-px before:w-4 before:bg-white/70 before:content-['']">
          {t("hero.eyebrow")}
        </div>
        <h1 className="mb-4.5 text-[32px] leading-[1.1] text-white sm:text-[44px]">{t("hero.title")}</h1>
        <p className="mx-auto max-w-[46ch] text-[17px] text-white/80">{t("hero.subtitle")}</p>
        <a
          href="#postAd"
          className="mt-5.5 inline-flex items-center justify-center rounded-sm bg-cta px-5 py-2.75 text-sm font-semibold text-cta-foreground transition-all hover:-translate-y-px hover:bg-cta-hover"
        >
          {t("hero.cta")}
        </a>
      </div>
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
          <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
            {t("compare.eyebrow")}
          </div>
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
          <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
            {t("plans.eyebrow")}
          </div>
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


