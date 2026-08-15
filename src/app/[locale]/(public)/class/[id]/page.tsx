import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { MapPin, School, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { GateNote } from "@/components/features/gate-note";
import { PriceBox } from "@/components/features/price-box";
import { AdSlot } from "@/components/features/ad-slot";
import { LockPill } from "@/components/features/lock-pill";
import { ReviewItem } from "@/components/features/review-item";
import { ClassBatchCard } from "@/components/features/class-batch-card";
import { getClassProfile } from "@/lib/mock-data";
import type { ClassProfileDetail } from "@/types/class-profile";

export default async function ClassProfilePage({
  params,
}: PageProps<"/[locale]/class/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const classProfile = getClassProfile(id);
  if (!classProfile) {
    notFound();
  }

  return (
    <>
      <Hero classProfile={classProfile} />
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-7 py-10 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <AboutPanel classProfile={classProfile} />
          <AdSlot eyebrow={classProfile.name} text={classProfile.adText} />
          <div className="mt-5">
            <BatchesPanel classProfile={classProfile} />
          </div>
          <ReviewsPanel classProfile={classProfile} />
        </div>
        <div className="flex flex-col gap-5">
          <PriceBoxSidebar classProfile={classProfile} />
          <DetailsPanel classProfile={classProfile} />
        </div>
      </div>
    </>
  );
}

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
      {title && <h2 className="mb-4 text-lg">{title}</h2>}
      {children}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 text-cta">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="size-3.5" fill={i < Math.round(rating) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

function classTypeLabel(
  t: ReturnType<typeof useTranslations>,
  classType: ClassProfileDetail["classType"],
) {
  if (classType === "physical") return t("classTypePhysical");
  if (classType === "online") return t("classTypeOnline");
  return t("classTypeBoth");
}

function Hero({ classProfile }: { classProfile: ClassProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <div className="mx-auto max-w-[1180px] px-7 pt-10">
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary-light p-7 text-white sm:p-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-white">
            <School className="size-9 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 font-mono text-xs uppercase tracking-[0.12em] text-white/70">
              {classProfile.location}
            </div>
            <h1 className="mb-2 text-[28px] text-white sm:text-[34px]">{classProfile.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/85">
              <span className="flex items-center gap-1.5">
                <StarRating rating={classProfile.rating} />
                {classProfile.rating.toFixed(1)} ({classProfile.reviewCount})
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {classProfile.location}
              </span>
              <span>{t("teachersCount", { count: classProfile.teacherCount })}</span>
              <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                {classTypeLabel(t, classProfile.classType)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2.5">
            <button
              type="button"
              className="rounded-sm border border-white/40 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              {t("save")}
            </button>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-sm bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground transition-all hover:-translate-y-px hover:bg-cta-hover"
            >
              {t("joinInstitute")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function AboutPanel({ classProfile }: { classProfile: ClassProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("about")}>
      <GateNote />
      <p className="m-0 text-sm text-foreground/85">{classProfile.description}</p>
    </Panel>
  );
}

function BatchesPanel({ classProfile }: { classProfile: ClassProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("classesWithinInstitute")}>
      <div className="flex flex-col gap-4">
        {classProfile.batches.map((batch) => (
          <ClassBatchCard key={batch.id} batch={batch} />
        ))}
      </div>
    </Panel>
  );
}

function ReviewsPanel({ classProfile }: { classProfile: ClassProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel
      title={t("instituteReviewsTitle", {
        count: classProfile.reviewCount,
        rating: classProfile.rating.toFixed(1),
      })}
    >
      {classProfile.reviews.map((review) => (
        <ReviewItem key={review.id} review={review} />
      ))}
    </Panel>
  );
}

function PriceBoxSidebar({ classProfile }: { classProfile: ClassProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <PriceBox
      hourlyRate={classProfile.hourlyRate}
      monthlyRate={classProfile.monthlyRate}
      joinHref="/signup"
      helperText={t("generalRateHelper")}
    />
  );
}

function DetailsPanel({ classProfile }: { classProfile: ClassProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("instituteDetailsTitle")}>
      <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3.5 text-sm">
        <div className="text-muted-foreground">{t("establishedLabel")}</div>
        <div className="font-medium text-foreground">{classProfile.establishedYear}</div>

        <div className="text-muted-foreground">{t("locationLabel")}</div>
        <div className="font-medium text-foreground">{classProfile.location}</div>

        <div className="text-muted-foreground">{t("classTypeLabel")}</div>
        <div className="font-medium text-foreground">{classTypeLabel(t, classProfile.classType)}</div>

        <div className="text-muted-foreground">{t("phoneLabel")}</div>
        <div>
          <LockPill>{t("phoneLocked")}</LockPill>
        </div>
      </div>
    </Panel>
  );
}
