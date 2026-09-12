import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RoleCard } from "@/components/features/role-card";
import { Eyebrow } from "@/components/features/eyebrow";

export async function generateMetadata({ params }: PageProps<"/[locale]/roles">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("rolesTitle"), description: t("rolesDescription") };
}

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
    <section className="border-b border-border bg-[radial-gradient(1200px_420px_at_82%_-10%,rgba(201,150,44,0.10),transparent_60%)] py-16 pb-10">
      <div className="mx-auto max-w-160 px-7 text-center">
        <div className="d-flex justify-content-center">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
        </div>
        <h1 className="mb-4.5 text-[32px] leading-[1.1] sm:text-[44px]">{t("title")}</h1>
        <p className="mx-auto max-w-[46ch] text-[17px] text-muted-foreground">{t("subtitle")}</p>
      </div>
    </section>
  );
}

const ROLES = ["teacher", "class", "campus", "student"] as const;

// One verified Pexels photo per role, reused from elsewhere on the site
// (same photo shoot the rest of the marketing pages use) rather than
// invented IDs — chosen so each thumbnail actually matches its role: a
// teacher addressing a class, a multi-student institute setting, a
// university lecture hall (campus lecturer), and a lone student studying.
const ROLE_PHOTOS: Record<(typeof ROLES)[number], string> = {
  teacher:
    "https://images.pexels.com/photos/8423012/pexels-photo-8423012.jpeg?auto=compress&cs=tinysrgb&w=500&h=500&fit=crop",
  class:
    "https://images.pexels.com/photos/8423049/pexels-photo-8423049.jpeg?auto=compress&cs=tinysrgb&w=500&h=500&fit=crop",
  campus:
    "https://images.pexels.com/photos/8199167/pexels-photo-8199167.jpeg?auto=compress&cs=tinysrgb&w=500&h=500&fit=crop",
  student:
    "https://images.pexels.com/photos/8423123/pexels-photo-8423123.jpeg?auto=compress&cs=tinysrgb&w=500&h=500&fit=crop",
};

function RolesList() {
  const t = useTranslations("roles");

  return (
    <section className="py-15">
      <div className="mx-auto max-w-160 space-y-4.5 px-7">
        {ROLES.map((role) => (
          <RoleCard
            key={role}
            tag={t(`${role}.tag`)}
            title={t(`${role}.title`)}
            description={t(`${role}.description`)}
            points={t.raw(`${role}.points`) as string[]}
            photo={ROLE_PHOTOS[role]}
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
            className="inline-flex items-center justify-center rounded-sm bg-primary px-5 py-2.75 text-sm font-semibold transition-all hover:-translate-y-px hover:bg-primary-light"
            style={{ color: "var(--primary-foreground)" }}
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
