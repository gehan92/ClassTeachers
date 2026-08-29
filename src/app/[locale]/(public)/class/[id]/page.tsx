import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, BadgeCheck, MapPin, School, Star, GraduationCap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { GateNote } from "@/components/features/gate-note";
import { PriceBox } from "@/components/features/price-box";
import { AdSlot } from "@/components/features/ad-slot";
import { LockPill } from "@/components/features/lock-pill";
import { ReviewItem } from "@/components/features/review-item";
import { ClassBatchCard } from "@/components/features/class-batch-card";
import { createClient } from "@/lib/supabase/server";
import { createDateFormatter } from "@/lib/format-date";
import type { ClassProfileDetail } from "@/types/class-profile";

async function loadClassProfile(id: string, locale: string): Promise<ClassProfileDetail | null> {
  const supabase = await createClient();

  const { data: classProfile, error } = await supabase
    .from("class_profiles")
    .select("id, name, description, location, class_type, established, photo_url, institution_verified")
    .eq("id", id)
    .maybeSingle();

  if (error || !classProfile) {
    return null;
  }

  const [
    { data: priceRow },
    { data: reviewRows },
    { data: batchRows },
    { data: adRow },
    { data: teacherRows },
    { data: phone },
  ] = await Promise.all([
    supabase.from("prices").select("hourly_rate, monthly_rate").eq("owner_type", "class").eq("owner_id", id).maybeSingle(),
    supabase.rpc("list_public_reviews", { p_target_type: "class", p_target_id: id }),
    supabase
      .from("batches")
      .select("id, title, mode, location, schedule_note, teacher_label, status")
      .eq("owner_type", "class")
      .eq("owner_id", id)
      .in("status", ["active", "upcoming"])
      .order("created_at", { ascending: false }),
    supabase
      .from("advertisements")
      .select("content, title")
      .eq("owner_type", "class")
      .eq("owner_id", id)
      .eq("placement", "own_profile")
      .maybeSingle(),
    // Institute Blueprint step 4a (0096) — the real roster, not just a
    // count; accepted+visible+approved only, same gate the count uses.
    supabase.rpc("list_institute_teachers", { p_class_id: id }),
    supabase.rpc("get_class_contact", { p_class_id: id }),
  ]);

  const dateFormatter = createDateFormatter(locale);
  const reviews = reviewRows ?? [];
  const reviewCount = reviews.length;
  const rating = reviewCount > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;

  return {
    id: classProfile.id,
    name: classProfile.name,
    description: classProfile.description,
    location: classProfile.location,
    classType: (classProfile.class_type as ClassProfileDetail["classType"]) ?? "physical",
    establishedText: classProfile.established,
    photoUrl: classProfile.photo_url,
    verified: classProfile.institution_verified,
    teacherCount: teacherRows?.length ?? 0,
    rating,
    reviewCount,
    hourlyRate: priceRow?.hourly_rate ?? undefined,
    monthlyRate: priceRow?.monthly_rate ?? undefined,
    adHeadline: adRow?.title ?? undefined,
    adText: adRow?.content ?? undefined,
    batches: (batchRows ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      teacherName: b.teacher_label,
      status: b.status === "upcoming" ? "upcoming" : "started",
      mode: b.mode as "online" | "physical",
      location: b.location,
      scheduleNote: b.schedule_note,
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      author: r.author ?? "Anonymous",
      date: dateFormatter.format(new Date(r.created_at)),
      rating: r.rating,
      body: r.body ?? "",
      reply: r.reply ?? undefined,
    })),
    phone,
    teachers: (teacherRows ?? []).map((t) => ({
      id: t.teacher_id,
      displayName: t.display_name ?? "—",
      photoUrl: t.photo_url,
      headline: t.headline,
      subjects: t.subjects ?? [],
      hourlyRate: t.hourly_rate ?? undefined,
      monthlyRate: t.monthly_rate ?? undefined,
      rating: t.rating,
      reviewCount: t.review_count,
      isCampusLecturer: t.is_campus_lecturer,
    })),
  } satisfies ClassProfileDetail;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/class/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const supabase = await createClient();
  const [{ data: classProfile }, t] = await Promise.all([
    supabase.from("class_profiles").select("name").eq("id", id).maybeSingle(),
    getTranslations({ locale, namespace: "meta" }),
  ]);
  if (!classProfile) return {};
  return {
    title: t("classProfileTitle", { name: classProfile.name }),
    description: t("classProfileDescription", { name: classProfile.name }),
  };
}

export default async function ClassProfilePage({
  params,
}: PageProps<"/[locale]/class/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const classProfile = await loadClassProfile(id, locale);
  if (!classProfile) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Hero classProfile={classProfile} />
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-7 py-10 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <AboutPanel classProfile={classProfile} showGate={!user} />
          {classProfile.teachers.length > 0 && (
            <div className="mt-5">
              <TeachersPanel classProfile={classProfile} />
            </div>
          )}
          {classProfile.adText && (
            <AdSlot eyebrow={classProfile.adHeadline ?? classProfile.name} text={classProfile.adText} />
          )}
          {classProfile.batches.length > 0 && (
            <div className="mt-5">
              <BatchesPanel classProfile={classProfile} />
            </div>
          )}
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
  const tl = useTranslations("listing");

  return (
    <div className="mx-auto max-w-[1180px] px-7 pt-10">
      <Link
        href="/teachers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("backToSearch")}
      </Link>
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

function AboutPanel({ classProfile, showGate }: { classProfile: ClassProfileDetail; showGate: boolean }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("about")}>
      {showGate && <GateNote />}
      <p className="m-0 text-sm text-foreground/85">{classProfile.description || t("noDescription")}</p>
    </Panel>
  );
}

function TeachersPanel({ classProfile }: { classProfile: ClassProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("teachersAtInstitute")}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {classProfile.teachers.map((teacher) => (
          <Link
            key={teacher.id}
            href={`/teacher/${teacher.id}`}
            className="flex items-start gap-3 rounded-lg border border-border p-3.5 transition-colors hover:border-primary/40 hover:bg-background"
          >
            {teacher.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teacher.photoUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                <GraduationCap className="size-5 text-secondary-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">{teacher.displayName}</div>
              {teacher.headline && (
                <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{teacher.headline}</div>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {teacher.reviewCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-foreground/80">
                    <Star className="size-3 fill-cta text-cta" />
                    {teacher.rating.toFixed(1)} ({teacher.reviewCount})
                  </span>
                )}
                {teacher.subjects.slice(0, 2).map((subject) => (
                  <span
                    key={subject}
                    className="rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-foreground/70"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
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
      {classProfile.reviews.length > 0 ? (
        classProfile.reviews.map((review) => <ReviewItem key={review.id} review={review} />)
      ) : (
        <p className="m-0 py-2 text-sm text-muted-foreground">{t("noReviews")}</p>
      )}
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
