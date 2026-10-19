import type { Metadata } from "next";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardCheck,
  History,
  KeyRound,
  Lock,
  MessageSquareText,
  School,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SearchCard } from "@/components/features/search-card";
import { ListingCard } from "@/components/features/listing-card";
import { Eyebrow } from "@/components/features/eyebrow";
import { getPublicListings, getActiveSiteAd, onePerOwner, type ActiveSiteAd } from "@/lib/public-directory";
import { getSiteContent, sitePhoto } from "@/lib/site-content";
import { SITE_TEXT_DEFAULT_KEYS, siteText, type SiteTextField } from "@/lib/site-content-schema";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { localeAlternates } from "@/lib/site-url";
import type { Listing } from "@/types/listing";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { absolute: t("homeTitle") },
    description: t("homeDescription"),
    alternates: localeAlternates(locale, ""),
  };
}

type Stats = { listings: number; subjects: number; locations: number; verified: number };
type SubjectCount = { name: string; count: number };

const CONTAINER = "mx-auto w-full max-w-[1180px] px-5 sm:px-7";

/** Groups subjects case-insensitively ("ICT" / "ict ") and counts listings per subject. */
function topSubjects(listings: Listing[], max: number): SubjectCount[] {
  const counts = new Map<string, SubjectCount>();
  for (const listing of listings) {
    for (const raw of listing.subjects) {
      const name = raw.replace(/\s+/g, " ").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = counts.get(key) ?? { name, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, max);
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [tPage, tSearch, tAll] = await Promise.all([
    getTranslations({ locale, namespace: "teachersPage" }),
    getTranslations({ locale, namespace: "search" }),
    getTranslations({ locale }),
  ]);
  const [allListings, siteAd, content, user] = await Promise.all([
    getPublicListings(tPage, tSearch, locale),
    getActiveSiteAd(),
    getSiteContent(),
    getAuthUser(),
  ]);

  const subjects = topSubjects(allListings, 8);
  const stats: Stats = {
    listings: allListings.length,
    subjects: topSubjects(allListings, Number.MAX_SAFE_INTEGER).length,
    locations: new Set(allListings.map((l) => l.location.trim().toLowerCase()).filter(Boolean)).size,
    verified: new Set(allListings.filter((l) => l.verified).map((l) => `${l.kind}:${l.ownerId}`)).size,
  };
  // Every text the admin can change: their wording for this language, else the built-in one.
  const text = (field: SiteTextField) => siteText(content, field, locale) || tAll(SITE_TEXT_DEFAULT_KEYS[field]);
  const { sections } = content;

  return (
    <>
      <Hero
        photo={sitePhoto(content, "hero")}
        title={text("heroTitle")}
        highlight={text("heroHighlight")}
        subtitle={text("heroSubtitle")}
        popular={subjects.slice(0, 4)}
      />
      {sections.stats && <StatsBand stats={stats} />}
      {sections.subjects && subjects.length > 0 && <SubjectsSection subjects={subjects} />}
      {sections.featured && (
        <FeaturedSection
          listings={onePerOwner(allListings, 6)}
          siteAd={siteAd}
          showSponsorSlot={sections.sponsorSlot}
        />
      )}
      <HowItWorksSection photo={sitePhoto(content, "howItWorks")} title={text("howTitle")} body={text("howBody")} />
      <TrustSection photo={sitePhoto(content, "whyUs")} title={text("whyUsTitle")} body={text("whyUsBody")} />
      {/* user_metadata.role is set at sign-up (auth/actions.ts) — enough to pick a link, no extra query. */}
      {sections.requests && <RequestsBand signedInStudent={user?.user_metadata?.role === "student"} />}
      {sections.schools && <SchoolsBand />}
      {sections.roles && <RolesSection />}
      <CtaPhotoSection photo={sitePhoto(content, "cta")} title={text("ctaTitle")} body={text("ctaBody")} />
    </>
  );
}

function Hero({
  photo,
  title,
  highlight,
  subtitle,
  popular,
}: {
  photo: string;
  title: string;
  highlight: string;
  subtitle: string;
  popular: SubjectCount[];
}) {
  const t = useTranslations("hero");
  const tHome = useTranslations("homeExtra");

  return (
    <section className="relative isolate overflow-hidden bg-primary-dark text-white">
      <Image src={photo} alt="" fill preload sizes="100vw" quality={70} className="-z-20 object-cover object-center" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(18,23,42,0.92)_0%,rgba(18,23,42,0.72)_45%,rgba(18,23,42,0.35)_100%),linear-gradient(0deg,rgba(18,23,42,0.85)_0%,rgba(18,23,42,0)_45%)]"
      />
      <div className={`${CONTAINER} pt-28 pb-12 sm:pt-36 sm:pb-16 lg:pt-40 lg:pb-20`}>
        <div className="max-w-[760px]">
          <Eyebrow dark>{t("eyebrow")}</Eyebrow>
          <h1 className="text-[clamp(2.05rem,5.2vw,3.6rem)] leading-[1.08] font-semibold text-balance text-white">
            {title} <span className="text-cta">{highlight}</span>
          </h1>
          <p className="mt-5 max-w-[54ch] text-[17px] leading-relaxed text-pretty text-white/80 sm:text-lg">{subtitle}</p>
        </div>

        <div className="mt-8 max-w-[980px]">
          <SearchCard />
          {popular.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-white/65">{tHome("popular")}</span>
              {popular.map((subject) => (
                <Link
                  key={subject.name}
                  href={{ pathname: "/teachers", query: { subject: subject.name } }}
                  className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white/90 backdrop-blur-sm transition-colors hover:border-white/50 hover:bg-white/20"
                >
                  {subject.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        <ul className="mt-10 grid max-w-[980px] grid-cols-1 gap-3 text-sm text-white/85 sm:grid-cols-3">
          {(
            [
              [ShieldCheck, tHome("trust.reviewed")],
              [Lock, tHome("trust.private")],
              [Search, tHome("trust.free")],
            ] as const
          ).map(([Icon, label]) => (
            <li key={label} className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                <Icon className="size-4 text-cta" aria-hidden />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Real numbers only, and only the ones worth showing — a "0" next to a promise reads as a broken promise. */
function StatsBand({ stats }: { stats: Stats }) {
  const t = useTranslations("homeExtra.stats");
  const items = (
    [
      ["listings", stats.listings],
      ["subjects", stats.subjects],
      ["locations", stats.locations],
      ["verified", stats.verified],
    ] as const
  ).filter(([, value]) => value > 0);
  if (stats.listings === 0 || items.length < 2) return null;

  return (
    <section className="border-b border-border bg-white">
      <dl className={`${CONTAINER} grid grid-cols-2 gap-x-8 gap-y-6 py-7 sm:flex sm:flex-wrap sm:gap-x-16`}>
        {items.map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <dt className="order-2 text-[13px] text-muted-foreground">{t(key, { count: value })}</dt>
            <dd className="order-1 font-display text-3xl font-semibold text-primary tabular-nums">{value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  link,
}: {
  eyebrow: string;
  title: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[640px]">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="text-[clamp(1.6rem,3vw,2.15rem)] leading-tight text-balance">{title}</h2>
      </div>
      {link && (
        <Link href={link.href} className="inline-flex items-center gap-1 text-sm font-semibold text-accent-deep hover:text-primary">
          {link.label}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

// Columns that the tiles actually fill, so three subjects don't leave an empty fourth slot.
const SUBJECT_COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-2",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-3 lg:grid-cols-4",
};

function SubjectsSection({ subjects }: { subjects: SubjectCount[] }) {
  const t = useTranslations("homeExtra.subjects");

  return (
    <section className="py-16 sm:py-20">
      <div className={CONTAINER}>
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} link={{ href: "/teachers", label: t("viewAll") }} />
        <div className={`grid grid-cols-2 gap-3 ${SUBJECT_COLUMNS[Math.min(subjects.length, 4)]}`}>
          {subjects.map((subject, i) => (
            <Link
              key={subject.name}
              href={{ pathname: "/teachers", query: { subject: subject.name } }}
              className="group relative flex min-h-[112px] flex-col justify-between overflow-hidden rounded-xl border border-border bg-white p-4 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_14px_30px_-18px_rgba(14,33,29,0.35)] sm:p-5"
            >
              <span
                aria-hidden
                className="absolute -top-2 right-1 font-display text-[48px] leading-none font-semibold text-secondary/80 transition-colors group-hover:text-cta/25"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="relative line-clamp-2 pr-12 font-display text-lg leading-snug font-semibold text-primary">
                {subject.name}
              </span>
              <span className="relative mt-3 flex items-center justify-between text-[13px] text-muted-foreground">
                {t("teachersCount", { count: subject.count })}
                <ArrowRight className="size-4 text-accent-deep transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedSection({
  listings,
  siteAd,
  showSponsorSlot,
}: {
  listings: Listing[];
  siteAd: ActiveSiteAd | null;
  showSponsorSlot: boolean;
}) {
  const t = useTranslations("featured");
  const adT = useTranslations("adSlot");

  return (
    <section id="classes" className="border-y border-border bg-white py-16 sm:py-20">
      <div className={CONTAINER}>
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} link={{ href: "/teachers", label: t("viewAll") }} />

        {listings.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing, i) => (
              <ListingCard key={listing.id} listing={listing} index={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-input bg-background px-6 py-12 text-center">
            <Sparkles className="size-6 text-accent-deep" aria-hidden />
            <p className="max-w-[46ch] text-muted-foreground">{t("empty")}</p>
            <Link href="/advertise" className="text-sm font-semibold text-accent-deep hover:text-primary">
              {t("emptyCta")}
            </Link>
          </div>
        )}

        {siteAd ? (
          <div className="mt-6 rounded-xl border border-border bg-background p-5">
            <Eyebrow>{adT("sponsoredLabel")}</Eyebrow>
            <p className="font-semibold text-primary">{siteAd.title}</p>
            {siteAd.content && <p className="mt-1 text-sm text-muted-foreground">{siteAd.content}</p>}
          </div>
        ) : (
          showSponsorSlot && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-input bg-background p-5">
              <div>
                <Eyebrow>{adT("eyebrow")}</Eyebrow>
                <p className="font-semibold text-primary">{adT("text")}</p>
              </div>
              <Link
                href="/advertise"
                className="rounded-lg border border-input bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-muted"
              >
                {adT("cta")}
              </Link>
            </div>
          )
        )}
      </div>
    </section>
  );
}

function PhotoPanel({ photo, className }: { photo: string; className?: string }) {
  return (
    <div className={`relative min-h-[280px] overflow-hidden rounded-2xl bg-muted sm:min-h-[360px] ${className ?? ""}`}>
      <Image src={photo} alt="" fill sizes="(min-width: 1024px) 560px, 100vw" quality={70} className="object-cover" />
    </div>
  );
}

function HowItWorksSection({ photo, title, body }: { photo: string; title: string; body: string }) {
  const t = useTranslations("homeExtra.howItWorks");
  const steps = t.raw("steps") as { title: string; body: string }[];

  return (
    <section className="py-16 sm:py-20">
      <div className={`${CONTAINER} grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14`}>
        <div>
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h2 className="text-[clamp(1.6rem,3vw,2.15rem)] leading-tight text-balance">{title}</h2>
          <p className="mt-3 max-w-[56ch] text-muted-foreground">{body}</p>
          <ol className="mt-7 flex flex-col gap-5">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-semibold text-cta">
                  {i + 1}
                </span>
                <div>
                  <div className="font-semibold text-primary">{step.title}</div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/teachers"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-light"
          >
            {t("cta")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <PhotoPanel photo={photo} />
      </div>
    </section>
  );
}

function TrustSection({ photo, title, body }: { photo: string; title: string; body: string }) {
  const t = useTranslations("homeExtra.whyUs");
  const points = t.raw("points") as string[];

  return (
    <section className="border-y border-border bg-white py-16 sm:py-20">
      <div className={`${CONTAINER} grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14`}>
        <PhotoPanel photo={photo} className="order-2 lg:order-1" />
        <div className="order-1 lg:order-2">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h2 className="text-[clamp(1.6rem,3vw,2.15rem)] leading-tight text-balance">{title}</h2>
          <p className="mt-3 max-w-[56ch] text-muted-foreground">{body}</p>
          <ul className="mt-6 flex flex-col gap-3.5">
            {points.map((point) => (
              <li key={point} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
                  <Check className="size-3.5" aria-hidden />
                </span>
                <span className="text-foreground/90">{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-[13px] text-success">
            <BadgeCheck className="size-4 shrink-0" aria-hidden />
            {t("verifiedNote")}
          </div>
        </div>
      </div>
    </section>
  );
}

function RequestsBand({ signedInStudent }: { signedInStudent: boolean }) {
  const t = useTranslations("homeExtra.requests");

  return (
    <section className="py-16 sm:py-20">
      <div className={CONTAINER}>
        <div className="relative isolate overflow-hidden rounded-2xl bg-primary px-6 py-10 text-white sm:px-10 sm:py-12">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-[0.12] [background-image:radial-gradient(circle_at_1px_1px,#f0dfae_1px,transparent_0)] [background-size:22px_22px]"
          />
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <Eyebrow dark>{t("eyebrow")}</Eyebrow>
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] leading-tight text-balance text-white">{t("title")}</h2>
              <p className="mt-3 max-w-[52ch] text-white/75">{t("body")}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={signedInStudent ? "/student?tab=wantedAds" : "/signup?role=student"}
                  className="inline-flex items-center gap-2 rounded-lg bg-cta px-5 py-3 text-sm font-semibold text-cta-foreground transition-colors hover:bg-cta-hover"
                >
                  <MessageSquareText className="size-4" aria-hidden />
                  {t("cta")}
                </Link>
                <Link
                  href="/requests"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  {t("browse")}
                </Link>
              </div>
            </div>
            <ol className="flex flex-col gap-3">
              {(t.raw("steps") as string[]).map((step, i) => (
                <li key={step} className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10">
                  <span className="font-mono text-sm text-cta">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm text-white/90">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function SchoolsBand() {
  const t = useTranslations("homeExtra.schools");
  const features = [
    [KeyRound, "roles"],
    [ClipboardCheck, "approvals"],
    [History, "history"],
  ] as const;

  return (
    <section className="pb-16 sm:pb-20">
      <div className={CONTAINER}>
        <div className="grid grid-cols-1 gap-8 rounded-2xl border border-cta/30 bg-secondary/60 px-6 py-10 sm:px-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary text-cta">
              <School className="size-5.5" aria-hidden />
            </span>
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] leading-tight text-balance">{t("title")}</h2>
            <p className="mt-3 max-w-[50ch] text-foreground/80">{t("body")}</p>
            <Link
              href="/signup?role=class&kind=school"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-light"
            >
              {t("cta")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {features.map(([Icon, key]) => (
              <li key={key} className="flex gap-3.5 rounded-xl bg-white p-4 ring-1 ring-border">
                <Icon className="mt-0.5 size-5 shrink-0 text-accent-deep" aria-hidden />
                <div>
                  <div className="text-sm font-semibold text-primary">{t(`features.${key}.title`)}</div>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{t(`features.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const HOME_ROLES = [
  { key: "teacher", href: "/signup?role=teacher", span: "md:col-span-2" },
  { key: "class", href: "/signup?role=class", span: "md:col-span-2" },
  { key: "school", href: "/signup?role=class&kind=school", span: "md:col-span-2" },
  { key: "campus", href: "/signup?role=campus_lecturer", span: "md:col-span-3" },
  { key: "student", href: "/signup?role=student", span: "md:col-span-3" },
] as const;

function RolesSection() {
  const t = useTranslations("roles");

  return (
    <section className="border-t border-border bg-white py-16 sm:py-20">
      <div className={CONTAINER}>
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} link={{ href: "/roles", label: t("seeHow") }} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-6">
          {HOME_ROLES.map((role) => (
            <Link
              key={role.key}
              href={role.href}
              className={`group flex flex-col rounded-xl border border-border bg-background p-5 transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_14px_30px_-18px_rgba(14,33,29,0.35)] ${role.span}`}
            >
              <span className="mb-3 inline-block w-fit rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] tracking-wide text-secondary-foreground">
                {t(`${role.key}.tag`)}
              </span>
              <h3 className="text-lg">{t(`${role.key}.title`)}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{t(`${role.key}.description`)}</p>
              <ul className="mt-3 mb-4 flex flex-col gap-1.5 text-[13.5px] text-foreground/80">
                {(t.raw(`${role.key}.points`) as string[]).map((point) => (
                  <li key={point} className="flex gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-accent-deep">
                {t(`${role.key}.cta`)}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaPhotoSection({ photo, title, body }: { photo: string; title: string; body: string }) {
  const t = useTranslations("homeExtra.ctaPhoto");

  return (
    <section className="relative isolate overflow-hidden bg-primary-dark px-5 py-16 text-center text-white sm:py-24">
      <Image src={photo} alt="" fill sizes="100vw" quality={70} className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-primary-dark/85" />
      <div className="mx-auto max-w-[660px]">
        <Eyebrow dark>{t("eyebrow")}</Eyebrow>
        <h2 className="text-[clamp(1.6rem,3.5vw,2.3rem)] leading-tight text-balance text-white">{title}</h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-white/80">{body}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/advertise"
            className="inline-flex items-center gap-2 rounded-lg bg-cta px-6 py-3 text-sm font-semibold text-cta-foreground transition-colors hover:bg-cta-hover"
          >
            {t("cta")}
          </Link>
          <Link
            href="/signup?role=teacher"
            className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            {t("secondaryCta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
