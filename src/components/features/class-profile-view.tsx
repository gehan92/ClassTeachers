import { useTranslations } from "next-intl";
import { ArrowLeft, BadgeCheck, MapPin, School, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { GateNote } from "@/components/features/gate-note";
import { PriceBox } from "@/components/features/price-box";
import { AdSlot } from "@/components/features/ad-slot";
import { LockPill } from "@/components/features/lock-pill";
import { ReviewsPanel } from "@/components/features/reviews-panel";
import { ClassBatchCard } from "@/components/features/class-batch-card";
import { Panel } from "@/components/features/teacher-profile-view";
import { InstituteTeachersPanel } from "@/components/features/institute-teacher-quick-view";
import { InstituteJoinButton } from "@/components/features/institute-join-button";
import type { ClassProfileDetail } from "@/types/class-profile";

/** The signed-in viewer's join state — undefined on the institute's own
 * "preview my page" view, where no join UI renders at all. */
export type ClassProfileViewerJoin = {
  loggedIn: boolean;
  isStudent: boolean;
  generalStatus: "pending" | "accepted" | "declined" | null;
  batchStatusById: Record<string, "pending" | "accepted" | "declined" | null>;
};

/**
 * Shared between the public /class/[id] page and the institute dashboard's
 * inline "view live page" preview (Settings tab) — same reasoning as
 * TeacherProfileView, so the two never drift apart.
 */
export function ClassProfileView({
  classProfile,
  showGate,
  isOwnerView = false,
  backHref,
  viewerJoin,
}: {
  classProfile: ClassProfileDetail;
  showGate: boolean;
  /** True when the institute is viewing its own profile from the dashboard — hides visitor-only actions like "Join institute". */
  isOwnerView?: boolean;
  /** Only set by the public /class/[id] page — the dashboard's inline preview has nothing to go "back" to, so it stays hidden there. */
  backHref?: string;
  /** Only set by the public /class/[id] page — omitted (along with !isOwnerView's join UI) on the dashboard's own preview. */
  viewerJoin?: ClassProfileViewerJoin;
}) {
  return (
    <>
      <Hero classProfile={classProfile} isOwnerView={isOwnerView} backHref={backHref} viewerJoin={viewerJoin} />
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-7 py-10 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <AboutPanel classProfile={classProfile} showGate={showGate} />
          {classProfile.teachers.length > 0 && (
            <div className="mt-5">
              <InstituteTeachersPanel teachers={classProfile.teachers} />
            </div>
          )}
          {classProfile.promotions.length > 0 && (
            <div className="flex flex-col gap-4">
              {classProfile.promotions.map((promotion) => (
                <AdSlot key={promotion.id} eyebrow={promotion.headline || classProfile.name} text={promotion.text} />
              ))}
            </div>
          )}
          {classProfile.batches.length > 0 && (
            <div className="mt-5">
              <BatchesPanel classProfile={classProfile} viewerJoin={!isOwnerView ? viewerJoin : undefined} />
            </div>
          )}
          <ReviewsPanel reviews={classProfile.reviews} reviewCount={classProfile.reviewCount} rating={classProfile.rating} />
        </div>
        <div className="flex flex-col gap-5">
          {/* Join/Message are visitor-only actions — hidden entirely on the
             institute's own view, same reasoning as TeacherProfileView. */}
          {!isOwnerView && <PriceBoxSidebar classProfile={classProfile} />}
          <DetailsPanel classProfile={classProfile} />
        </div>
      </div>
    </>
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

function classTypeLabel(t: ReturnType<typeof useTranslations>, classType: ClassProfileDetail["classType"]) {
  if (classType === "physical") return t("classTypePhysical");
  if (classType === "online") return t("classTypeOnline");
  return t("classTypeBoth");
}

function Hero({
  classProfile,
  isOwnerView,
  backHref,
  viewerJoin,
}: {
  classProfile: ClassProfileDetail;
  isOwnerView: boolean;
  backHref?: string;
  viewerJoin?: ClassProfileViewerJoin;
}) {
  const t = useTranslations("profilePage");
  const tl = useTranslations("listing");

  return (
    <div className="mx-auto max-w-[1180px] px-7 pt-10">
      {backHref && (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          {t("backToSearch")}
        </Link>
      )}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary-light p-7 text-white sm:p-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {classProfile.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={classProfile.photoUrl}
              alt=""
              className="size-20 shrink-0 rounded-full border-4 border-white object-cover"
            />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-white">
              <School className="size-9 text-primary" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {classProfile.location && (
              <div className="mb-1.5 font-mono text-xs uppercase tracking-[0.12em] text-white/70">
                {classProfile.location}
              </div>
            )}
            <h1 className="mb-2 flex items-center gap-1.5 text-[28px] text-white sm:text-[34px]">
              {classProfile.name}
              <span title={classProfile.verified ? tl("institutionVerified") : tl("reviewed")}>
                <BadgeCheck
                  className="size-4 shrink-0 sm:size-5"
                  aria-label={classProfile.verified ? tl("institutionVerified") : tl("reviewed")}
                />
              </span>
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/85">
              {classProfile.reviewCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <StarRating rating={classProfile.rating} />
                  {classProfile.rating.toFixed(1)} ({classProfile.reviewCount})
                </span>
              )}
              {classProfile.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {classProfile.location}
                </span>
              )}
              <span>{t("teachersCount", { count: classProfile.teacherCount })}</span>
              <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                {classTypeLabel(t, classProfile.classType)}
              </span>
            </div>
          </div>
          {!isOwnerView && (
            <div className="flex shrink-0 gap-2.5">
              <button
                type="button"
                className="rounded-sm border border-white/40 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t("save")}
              </button>
              <InstituteJoinButton
                classId={classProfile.id}
                loggedIn={viewerJoin?.loggedIn ?? false}
                isStudent={viewerJoin?.isStudent ?? false}
                initialStatus={viewerJoin?.generalStatus ?? null}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AboutPanel({ classProfile, showGate }: { classProfile: ClassProfileDetail; showGate: boolean }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("about")}>
      {showGate && <GateNote />}
      <p className="m-0 text-sm text-foreground/85">{classProfile.description || t("noDescription")}</p>
    </Panel>
  );
}

function BatchesPanel({
  classProfile,
  viewerJoin,
}: {
  classProfile: ClassProfileDetail;
  viewerJoin?: ClassProfileViewerJoin;
}) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("classesWithinInstitute")}>
      <div className="flex flex-col gap-4">
        {classProfile.batches.map((batch) => (
          <ClassBatchCard
            key={batch.id}
            batch={batch}
            join={
              viewerJoin
                ? {
                    loggedIn: viewerJoin.loggedIn,
                    isStudent: viewerJoin.isStudent,
                    status: viewerJoin.batchStatusById[batch.id] ?? null,
                  }
                : undefined
            }
          />
        ))}
      </div>
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
      ownerType="class"
      ownerId={classProfile.id}
    />
  );
}

function DetailsPanel({ classProfile }: { classProfile: ClassProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("instituteDetailsTitle")}>
      <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3.5 text-sm">
        <div className="text-muted-foreground">{t("establishedLabel")}</div>
        <div className="font-medium text-foreground">{classProfile.establishedText || "—"}</div>

        <div className="text-muted-foreground">{t("locationLabel")}</div>
        <div className="font-medium text-foreground">{classProfile.location || "—"}</div>

        <div className="text-muted-foreground">{t("classTypeLabel")}</div>
        <div className="font-medium text-foreground">{classTypeLabel(t, classProfile.classType)}</div>

        <div className="text-muted-foreground">{t("phoneLabel")}</div>
        <div>
          {classProfile.phone ? (
            <span className="font-medium text-foreground">{classProfile.phone}</span>
          ) : (
            <LockPill>{t("phoneLocked")}</LockPill>
          )}
        </div>
      </div>
    </Panel>
  );
}
