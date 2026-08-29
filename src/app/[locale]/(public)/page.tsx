import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SearchCard } from "@/components/features/search-card";
import { RoleCard } from "@/components/features/role-card";
import { ListingCard } from "@/components/features/listing-card";
import { getPublicListings, getActiveSiteAd, type ActiveSiteAd } from "@/lib/public-directory";
import type { Listing } from "@/types/listing";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [tPage, tSearch] = await Promise.all([
    getTranslations({ locale, namespace: "teachersPage" }),
    getTranslations({ locale, namespace: "search" }),
  ]);
  const [allListings, siteAd] = await Promise.all([getPublicListings(tPage, tSearch), getActiveSiteAd()]);
  const listings = allListings.slice(0, 6);

  return (
    <>
      <Hero />
      <RolesSection />
      <FeaturedSection listings={listings} siteAd={siteAd} />
      <TeachCtaSection />
    </>
  );
}

function Hero() {
  const t = useTranslations("hero");

  return (
    <section className="border-b border-border bg-[radial-gradient(1200px_420px_at_82%_-10%,rgba(185,138,34,0.10),transparent_60%)] py-16 pb-10">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-10 px-7 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <div>
          <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
            {t("eyebrow")}
          </div>
          <h1 className="mb-4.5 text-[32px] leading-[1.1] sm:text-[44px]">
            {t("titlePrefix")} <span className="text-accent-deep">{t("titleEmphasis")}</span>
          </h1>
          <p className="max-w-[46ch] text-[17px] text-muted-foreground">{t("subtitle")}</p>
          <div className="mt-5.5 flex flex-wrap gap-3">
            <Link
              href="/teachers"
              className="inline-flex items-center justify-center rounded-sm bg-primary px-5 py-2.75 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-px hover:bg-primary-light"
            >
              {t("browseTeachers")}
            </Link>
            <Link
              href="/roles"
              className="inline-flex items-center justify-center rounded-sm border border-input px-5 py-2.75 text-sm font-semibold text-primary transition-all hover:-translate-y-px hover:bg-white"
            >
              {t("iWantToTeach")}
            </Link>
          </div>
        </div>

        <SearchCard />
      </div>
    </section>
  );
}

function RolesSection() {
  const t = useTranslations("roles");

  const roles = ["teacher", "class", "campus", "student"] as const;

  return (
    <section className="py-15">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
              {t("eyebrow")}
            </div>
            <h2 className="text-[28px]">{t("title")}</h2>
          </div>
          <Link href="/roles" className="text-sm font-semibold text-primary">
            {t("seeHow")}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>
    </section>
  );
}

function FeaturedSection({ listings, siteAd }: { listings: Listing[]; siteAd: ActiveSiteAd | null }) {
  const t = useTranslations("featured");
  const adT = useTranslations("adSlot");

  return (
    <section id="classes" className="border-y border-border bg-white py-15">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
              {t("eyebrow")}
            </div>
            <h2 className="text-[28px]">{t("title")}</h2>
          </div>
          <Link href="/teachers" className="text-sm font-semibold text-primary">
            {t("viewAll")}
          </Link>
        </div>

        {listings.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-input bg-background p-10 text-center text-muted-foreground">
            {t("empty")}
          </div>
        )}

        {siteAd ? (
          <div className="mt-10 rounded-lg border border-border bg-white p-4.5">
            <div className="mb-1 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep">
              {adT("sponsoredLabel")}
            </div>
            <p className="m-0 font-semibold text-foreground">{siteAd.title}</p>
            {siteAd.content && <p className="mt-1 text-sm text-muted-foreground">{siteAd.content}</p>}
          </div>
        ) : (
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-dashed border-input bg-[repeating-linear-gradient(135deg,#fff,#fff_10px,#fafbfd_10px,#fafbfd_20px)] p-4.5">
            <div>
              <div className="mb-1 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep">
                {adT("eyebrow")}
              </div>
              <p className="m-0 font-semibold text-foreground">{adT("text")}</p>
            </div>
            <Link
              href="/advertise"
              className="rounded-sm border border-input px-3.5 py-1.75 text-[13px] font-semibold text-primary"
            >
              {adT("cta")}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function TeachCtaSection() {
  const t = useTranslations("teachCta");

  return (
    <section className="border-b border-border bg-white py-15">
      <div className="mx-auto max-w-160 px-7 text-center">
        <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-accent-deep before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
          {t("eyebrow")}
        </div>
        <h2 className="text-[28px]">{t("title")}</h2>
        <p className="text-muted-foreground">{t("subtitle")}</p>
        <Link
          href="/signup"
          className="mt-2 inline-flex items-center justify-center rounded-sm bg-primary px-5 py-2.75 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-px hover:bg-primary-light"
        >
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
