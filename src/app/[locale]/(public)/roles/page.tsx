import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { RoleCard } from "@/components/features/role-card";
import { Eyebrow } from "@/components/features/eyebrow";
import { localeAlternates } from "@/lib/site-url";

export async function generateMetadata({ params }: PageProps<"/[locale]/roles">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("rolesTitle"), description: t("rolesDescription"), alternates: localeAlternates(locale, "/roles") };
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
    <section className="border-b border-border bg-[radial-gradient(1200px_420px_at_82%_-10%,rgba(201,150,44,0.12),transparent_60%)] pt-16 pb-12">
      <div className="mx-auto max-w-160 px-5 text-center sm:px-7">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1 className="mb-4 text-[clamp(2rem,5vw,2.75rem)] leading-[1.1] text-balance">{t("title")}</h1>
        <p className="mx-auto max-w-[46ch] text-[17px] text-muted-foreground">{t("subtitle")}</p>
      </div>
    </section>
  );
}

const ROLES = ["teacher", "class", "school", "campus", "student"] as const;

// One Pexels photo per role, from the same shoot the rest of the marketing
// pages use — chosen so each thumbnail matches its role.
const ROLE_PHOTOS: Record<(typeof ROLES)[number], string> = {
  teacher: "https://images.pexels.com/photos/8423012/pexels-photo-8423012.jpeg?auto=compress&cs=tinysrgb&w=500&h=500&fit=crop",
  class: "https://images.pexels.com/photos/8423049/pexels-photo-8423049.jpeg?auto=compress&cs=tinysrgb&w=500&h=500&fit=crop",
  school: "https://images.pexels.com/photos/8423005/pexels-photo-8423005.jpeg?auto=compress&cs=tinysrgb&w=500&h=500&fit=crop",
  campus: "https://images.pexels.com/photos/8199167/pexels-photo-8199167.jpeg?auto=compress&cs=tinysrgb&w=500&h=500&fit=crop",
  student: "https://images.pexels.com/photos/8423123/pexels-photo-8423123.jpeg?auto=compress&cs=tinysrgb&w=500&h=500&fit=crop",
};

const ROLE_SIGNUP: Record<(typeof ROLES)[number], string> = {
  teacher: "/signup?role=teacher",
  class: "/signup?role=class",
  school: "/signup?role=class&kind=school",
  campus: "/signup?role=campus_lecturer",
  student: "/signup?role=student",
};

// Uses "rolesPage.detail.*" rather than the "roles" namespace Home's teaser
// reads from — this page is what "See how each role works" promises, so it
// carries fuller descriptions and more points per role.
function RolesList() {
  const t = useTranslations("rolesPage.detail");
  const tRoles = useTranslations("roles");

  return (
    <section className="py-14">
      <div className="mx-auto flex max-w-[760px] flex-col gap-5 px-5 sm:px-7">
        {ROLES.map((role) => (
          <div key={role} id={role} className="scroll-mt-24">
            <RoleCard
              tag={t(`${role}.tag`)}
              title={t(`${role}.title`)}
              description={t(`${role}.description`)}
              points={t.raw(`${role}.points`) as string[]}
              photo={ROLE_PHOTOS[role]}
              action={{ href: ROLE_SIGNUP[role], label: tRoles(`${role}.cta`) }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaSection() {
  const t = useTranslations("rolesPage");

  return (
    <section className="border-t border-border bg-white py-16">
      <div className="mx-auto max-w-160 px-5 text-center sm:px-7">
        <h2 className="text-[clamp(1.6rem,3vw,2.1rem)] leading-tight">{t("ctaTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("ctaSubtitle")}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup?role=teacher"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-light"
          >
            {t("ctaTeacher")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/signup?role=class"
            className="inline-flex items-center rounded-lg border border-input bg-white px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-muted"
          >
            {t("ctaClass")}
          </Link>
          <Link
            href="/signup?role=class&kind=school"
            className="inline-flex items-center rounded-lg border border-input bg-white px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-muted"
          >
            {t("ctaSchool")}
          </Link>
        </div>
      </div>
    </section>
  );
}
