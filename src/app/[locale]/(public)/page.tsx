import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SearchCard } from "@/components/features/search-card";
import { RoleCard } from "@/components/features/role-card";
import { ListingCard } from "@/components/features/listing-card";
import { Eyebrow } from "@/components/features/eyebrow";
import { getPublicListings, getActiveSiteAd, type ActiveSiteAd } from "@/lib/public-directory";
import type { Listing } from "@/types/listing";

// Real Pexels photos reused verbatim from the reference mockup
// (rq_md/page/classportals-home-v3.html) — verified to resolve (HTTP 200),
// not invented IDs.
const HERO_PHOTO =
  "https://images.pexels.com/photos/8423020/pexels-photo-8423020.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1200&fit=crop";
const WHY_US_PHOTO =
  "https://images.pexels.com/photos/8423012/pexels-photo-8423012.jpeg?auto=compress&cs=tinysrgb&w=900&h=700&fit=crop";
const HOW_IT_WORKS_PHOTO =
  "https://images.pexels.com/photos/8199167/pexels-photo-8199167.jpeg?auto=compress&cs=tinysrgb&w=900&h=700&fit=crop";
const CTA_PHOTO =
  "https://images.pexels.com/photos/8423005/pexels-photo-8423005.jpeg?auto=compress&cs=tinysrgb&w=1920&h=800&fit=crop";
// Five generic education photos for the subject bento grid — mapped by
// position to whichever subjects are actually most-listed (computed below),
// not to hardcoded subject names, since real subject popularity will differ
// from the reference mockup's made-up example.
const SUBJECT_TILE_PHOTOS = [
  "https://images.pexels.com/photos/6238068/pexels-photo-6238068.jpeg?auto=compress&cs=tinysrgb&w=700&h=700&fit=crop",
  "https://images.pexels.com/photos/11198505/pexels-photo-11198505.jpeg?auto=compress&cs=tinysrgb&w=500&h=350&fit=crop",
  "https://images.pexels.com/photos/8199167/pexels-photo-8199167.jpeg?auto=compress&cs=tinysrgb&w=500&h=350&fit=crop",
  "https://images.pexels.com/photos/8539753/pexels-photo-8539753.jpeg?auto=compress&cs=tinysrgb&w=500&h=350&fit=crop",
  "https://images.pexels.com/photos/8012262/pexels-photo-8012262.jpeg?auto=compress&cs=tinysrgb&w=500&h=350&fit=crop",
];

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [tPage, tSearch] = await Promise.all([
    getTranslations({ locale, namespace: "teachersPage" }),
    getTranslations({ locale, namespace: "search" }),
  ]);
  const [allListings, siteAd] = await Promise.all([getPublicListings(tPage, tSearch), getActiveSiteAd()]);
  const listings = allListings.slice(0, 6);

  // Real computed numbers, not the reference mockup's fabricated "2,400+
  // verified teachers" placeholder copy.
  const stats = {
    listings: allListings.length,
    locations: new Set(allListings.map((l) => l.location).filter(Boolean)).size,
    verified: allListings.filter((l) => l.verified).length,
  };

  return (
    <>
      <Hero />
      <SubjectsSection listings={allListings} />
      <WhyUsBand stats={stats} />
      <HowItWorksBand />
      <FeaturedSection listings={listings} siteAd={siteAd} />
      <CtaPhotoSection />
      <RolesSection />
    </>
  );
}

function Hero() {
  const t = useTranslations("hero");

  return (
    <section
      className="position-relative d-flex align-items-end text-white overflow-hidden"
      style={{
        minHeight: "92vh",
        backgroundImage: `linear-gradient(90deg, rgba(27,35,51,0.85) 0%, rgba(27,35,51,0.45) 42%, transparent 72%), linear-gradient(0deg, rgba(27,35,51,0.65) 5%, rgba(27,35,51,0.18) 55%, rgba(27,35,51,0.3) 100%), url('${HERO_PHOTO}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="container px-4 pb-5" style={{ maxWidth: 1180, paddingTop: 120 }}>
        <h1
          className="fw-bold"
          style={{
            fontSize: "clamp(2.1rem, 4.5vw, 3.4rem)",
            lineHeight: 1.14,
            maxWidth: 760,
            marginBottom: 20,
            color: "#fff",
          }}
        >
          {t("titlePrefix")} <span style={{ color: "var(--cta)" }}>{t("titleEmphasis")}</span>
        </h1>
        <p style={{ maxWidth: 520, fontSize: 18, marginBottom: 30, color: "rgba(255,255,255,0.82)" }}>
          {t("subtitle")}
        </p>
        <div className="d-flex flex-wrap gap-3 mb-5">
          <Link
            href="/teachers"
            className="btn fw-semibold"
            style={{ background: "var(--cta)", color: "var(--cta-foreground)", padding: "14px 28px" }}
          >
            {t("browseTeachers")}
          </Link>
          <Link
            href="/roles"
            className="btn fw-semibold"
            style={{
              border: "1.5px solid rgba(255,255,255,0.5)",
              color: "#fff",
              background: "rgba(255,255,255,0.08)",
              padding: "13px 26px",
            }}
          >
            {t("iWantToTeach")}
          </Link>
        </div>

        <SearchCard />
      </div>
    </section>
  );
}

function SubjectTile({
  subject,
  count,
  photo,
  tall,
}: {
  subject: string;
  count: number;
  photo: string;
  tall?: boolean;
}) {
  const t = useTranslations("homeExtra.subjects");

  return (
    <Link
      href={{ pathname: "/teachers", query: { subject } }}
      className="d-block position-relative rounded-3 overflow-hidden"
      style={{ height: tall ? 360 : 170 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external Pexels stock photo, not a local asset */}
      <img src={photo} alt="" className="position-absolute top-0 start-0 w-100 h-100" style={{ objectFit: "cover" }} />
      <div
        className="position-absolute top-0 start-0 w-100 h-100"
        style={{ background: "linear-gradient(0deg, rgba(27,35,51,0.88) 10%, transparent 70%)" }}
      />
      <div className="position-absolute bottom-0 start-0 p-3 text-white">
        <div className="fw-bold">{subject}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>{t("teachersCount", { count })}</div>
      </div>
    </Link>
  );
}

function SubjectsSection({ listings }: { listings: Listing[] }) {
  const t = useTranslations("homeExtra.subjects");

  const counts = new Map<string, number>();
  for (const listing of listings) {
    for (const subject of listing.subjects) {
      counts.set(subject, (counts.get(subject) ?? 0) + 1);
    }
  }
  const topSubjects = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (topSubjects.length === 0) return null;

  const [large, ...rest] = topSubjects;

  return (
    <section style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="container" style={{ maxWidth: 1180 }}>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h2 className="mb-4">{t("title")}</h2>
        <div className="row g-3">
          <div className="col-md-5">
            <SubjectTile subject={large[0]} count={large[1]} photo={SUBJECT_TILE_PHOTOS[0]} tall />
          </div>
          {rest.length > 0 && (
            <div className="col-md-7">
              <div className="row g-3">
                {rest.map(([subject, count], i) => (
                  <div className="col-6 col-lg-3" key={subject}>
                    <SubjectTile subject={subject} count={count} photo={SUBJECT_TILE_PHOTOS[i + 1] ?? SUBJECT_TILE_PHOTOS[0]} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatPill({ num, label }: { num: number; label: string }) {
  return (
    <div>
      <div className="fw-bold" style={{ fontSize: 28, color: "var(--primary)", fontFamily: "var(--font-display)" }}>
        {num.toLocaleString()}
      </div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{label}</div>
    </div>
  );
}

function WhyUsBand({ stats }: { stats: { listings: number; locations: number; verified: number } }) {
  const t = useTranslations("homeExtra.whyUs");
  const tStats = useTranslations("homeExtra.stats");
  const points = t.raw("points") as string[];

  return (
    <section className="border-top border-bottom bg-white">
      <div className="row g-0 flex-column flex-lg-row">
        <div className="col-lg-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={WHY_US_PHOTO}
            alt=""
            className="w-100 h-100"
            style={{ objectFit: "cover", minHeight: 320, maxHeight: 440 }}
          />
        </div>
        <div className="col-lg-6 d-flex align-items-center">
          <div className="home-band-text" style={{ maxWidth: 480 }}>
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h2 className="mb-3">{t("title")}</h2>
            <p className="mb-3" style={{ color: "var(--muted-foreground)" }}>
              {t("description")}
            </p>
            <ul className="list-unstyled mb-4">
              {points.map((point) => (
                <li key={point} className="d-flex gap-2" style={{ marginBottom: 12 }}>
                  <span className="fw-bold" style={{ color: "var(--cta)" }}>
                    ✓
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <div className="d-flex" style={{ gap: 28 }}>
              <StatPill num={stats.listings} label={tStats("listings")} />
              <StatPill num={stats.locations} label={tStats("locations")} />
              <StatPill num={stats.verified} label={tStats("verified")} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksBand() {
  const t = useTranslations("homeExtra.howItWorks");
  const tHero = useTranslations("hero");
  const points = t.raw("points") as string[];

  return (
    <section className="bg-white">
      <div className="row g-0 flex-column flex-lg-row-reverse">
        <div className="col-lg-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HOW_IT_WORKS_PHOTO}
            alt=""
            className="w-100 h-100"
            style={{ objectFit: "cover", minHeight: 320, maxHeight: 440 }}
          />
        </div>
        <div className="col-lg-6 d-flex align-items-center">
          <div className="home-band-text" style={{ maxWidth: 480 }}>
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h2 className="mb-3">{t("title")}</h2>
            <p className="mb-3" style={{ color: "var(--muted-foreground)" }}>
              {t("description")}
            </p>
            <ul className="list-unstyled mb-4">
              {points.map((point) => (
                <li key={point} className="d-flex gap-2" style={{ marginBottom: 12 }}>
                  <span className="fw-bold" style={{ color: "var(--cta)" }}>
                    ✓
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/roles"
              className="btn fw-semibold d-inline-block"
              style={{ background: "var(--cta)", color: "var(--cta-foreground)", padding: "14px 28px" }}
            >
              {tHero("iWantToTeach")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedSection({ listings, siteAd }: { listings: Listing[]; siteAd: ActiveSiteAd | null }) {
  const t = useTranslations("featured");
  const adT = useTranslations("adSlot");

  return (
    <section id="classes" className="border-top border-bottom bg-white" style={{ paddingTop: 64, paddingBottom: 64 }}>
      <div className="container" style={{ maxWidth: 1180 }}>
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
          <div>
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h2 className="mb-0">{t("title")}</h2>
          </div>
          <Link href="/teachers" className="fw-semibold" style={{ color: "var(--cta)" }}>
            {t("viewAll")}
          </Link>
        </div>

        {listings.length > 0 ? (
          <div className="row g-4">
            {listings.map((listing, i) => (
              <div className="col-sm-6 col-lg-4" key={listing.id}>
                <ListingCard listing={listing} index={i} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="rounded-3 text-center p-5"
            style={{ border: "1px dashed var(--input)", color: "var(--muted-foreground)" }}
          >
            {t("empty")}
          </div>
        )}

        {siteAd ? (
          <div className="mt-4 rounded-3 bg-white p-4" style={{ border: "1px solid var(--border)" }}>
            <Eyebrow>{adT("sponsoredLabel")}</Eyebrow>
            <p className="mb-0 fw-semibold">{siteAd.title}</p>
            {siteAd.content && (
              <p className="mt-1 mb-0 small" style={{ color: "var(--muted-foreground)" }}>
                {siteAd.content}
              </p>
            )}
          </div>
        ) : (
          <div
            className="mt-4 rounded-3 d-flex flex-wrap justify-content-between align-items-center gap-3 p-4"
            style={{ border: "1.5px dashed var(--input)", background: "var(--muted)" }}
          >
            <div>
              <Eyebrow>{adT("eyebrow")}</Eyebrow>
              <p className="mb-0 fw-semibold">{adT("text")}</p>
            </div>
            <Link
              href="/advertise"
              className="btn fw-semibold"
              style={{
                border: "1px solid var(--input)",
                color: "var(--primary)",
                background: "#fff",
                padding: "10px 20px",
                fontSize: "0.9rem",
              }}
            >
              {adT("cta")}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function CtaPhotoSection() {
  const t = useTranslations("homeExtra.ctaPhoto");

  return (
    <section
      className="position-relative text-center text-white"
      style={{
        backgroundImage: `linear-gradient(0deg, rgba(27,35,51,0.9), rgba(27,35,51,0.8)), url('${CTA_PHOTO}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: "100px 24px",
      }}
    >
      <div className="d-flex justify-content-center">
        <Eyebrow dark>{t("eyebrow")}</Eyebrow>
      </div>
      <h2 className="mx-auto mb-3" style={{ maxWidth: 640, fontSize: "clamp(1.6rem, 3.5vw, 2.3rem)", color: "#fff" }}>
        {t("title")}
      </h2>
      <p className="mx-auto mb-4" style={{ maxWidth: 520, color: "rgba(255,255,255,0.82)" }}>
        {t("subtitle")}
      </p>
      <Link
        href="/advertise"
        className="btn fw-semibold d-inline-block"
        style={{ background: "var(--cta)", color: "var(--cta-foreground)", padding: "14px 28px" }}
      >
        {t("cta")}
      </Link>
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
            <Eyebrow>{t("eyebrow")}</Eyebrow>
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
