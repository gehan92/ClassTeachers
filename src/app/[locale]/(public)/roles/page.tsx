import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RoleCard } from "@/components/features/role-card";

export default async function RolesPage({ params }: PageProps<"/[locale]/roles">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <RolesList />
      <CtaSection />
    </>
  );
}

function Hero() {
  const t = useTranslations("rolesPage");

  return (
    <section className="border-b border-border bg-[radial-gradient(1200px_420px_at_82%_-10%,rgba(185,138,34,0.10),transparent_60%)] py-16 pb-10">
      <div className="mx-auto max-w-160 px-7 text-center">
        <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
          {t("eyebrow")}
        </div>
        <h1 className="mb-4.5 text-[32px] leading-[1.1] sm:text-[44px]">{t("title")}</h1>
        <p className="mx-auto max-w-[46ch] text-[17px] text-muted-foreground">{t("subtitle")}</p>
      </div>
    </section>
  );
}

function RolesList() {
  const t = useTranslations("roles");

  const roles = ["teacher", "class", "campus", "student"] as const;

  return (
    <section className="py-15">
      <div className="mx-auto max-w-160 space-y-4.5 px-7">
        {roles.map((role) => (
          <RoleCard
            key={role}
            tag={t(`${role}.tag`)}
            title={t(`${role}.title`)}
            description={t(`${role}.description`)}
            points={t.raw(`${role}.points`) as string[]}
          />
        ))}
      </div>
    </section>
  );
}

function CtaSection() {
  const t = useTranslations("rolesPage");

  return (
    <section className="border-t border-border bg-white py-15">
      <div className="mx-auto max-w-160 px-7 text-center">
        <h2 className="text-[28px]">{t("ctaTitle")}</h2>
        <p className="text-muted-foreground">{t("ctaSubtitle")}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-sm bg-primary px-5 py-2.75 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-px hover:bg-primary-light"
          >
            {t("ctaTeacher")}
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-sm border border-input px-5 py-2.75 text-sm font-semibold text-primary transition-all hover:-translate-y-px hover:bg-white"
          >
            {t("ctaClass")}
          </Link>
        </div>
      </div>
    </section>
  );
}
