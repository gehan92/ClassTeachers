import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, BadgeCheck, FileText, MapPin, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { JoinRequestBox } from "@/components/features/join-request-box";
import { InquiryBox } from "@/components/features/inquiry-box";
import { ShareButtons } from "@/components/features/share-buttons";
import { ReviewItem } from "@/components/features/review-item";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { avatarGradientClass } from "@/lib/avatar-color";
import { sanitizeRichText } from "@/lib/dashboard/sanitize-rich-text";
import { hasRichText, looksLikeRichTextHtml, RICH_TEXT_DISPLAY_CLASS } from "@/lib/rich-text";
import { createDateFormatter, createDateTimeFormatter } from "@/lib/format-date";
import type { ReviewDisplay } from "@/types/review";

/**
 * A search-result ad can belong to a teacher (get_public_ad, 0040/0041/0076)
 * or an institute's specific batch (get_public_class_ad, 0103) — two
 * separate, narrow RPCs (same reasoning as every other narrow-RPC pair in
 * this codebase: each stays a plain, unconditional join rather than one
 * function branching internally on owner_type). Ad ids are unique across
 * the whole advertisements table regardless of owner, so trying the teacher
 * RPC first and falling back to the class one is enough to resolve either —
 * no separate route per owner type needed.
 */
type NormalizedAd = {
  ownerType: "teacher" | "class";
  ownerId: string;
  adId: string;
  batchId: string;
  name: string | null;
  photoUrl: string | null;
  adTitle: string;
  adContent: string | null;
  subject: string | null;
  gradeBand: string | null;
  location: string | null;
  mode: string;
  scheduleNote: string | null;
  hourlyRate: number | null;
  monthlyRate: number | null;
  rating: number;
  reviewCount: number;
  institutionVerified: boolean;
  isCampusLecturer: boolean;
  courseCode: string | null;
  isOpenEnrollment: boolean;
  capacity: number | null;
  spotsTaken: number;
  medium: "english" | "sinhala" | "tamil" | "other" | null;
  classType: "new" | "revision" | null;
  /** Optional upper end of the rate (0120, teacher ads only). */
  hourlyRateMax: number | null;
  monthlyRateMax: number | null;
  /** Set only for a "Course Ad" (0139, teacher/campus-lecturer ads only) —
   * a structured, multi-session course rather than an ongoing class. */
  totalSessions: number | null;
};

async function loadAd(adId: string): Promise<NormalizedAd | null> {
  const supabase = await createClient();

  const { data: teacherRows } = await supabase.rpc("get_public_ad", { p_ad_id: adId });
  if (teacherRows && teacherRows.length > 0) {
    const r = teacherRows[0];
    // Result intentionally ignored -- a failed count bump shouldn't ever
    // break the page rendering for the visitor viewing the ad.
    await supabase.rpc("increment_ad_view", { p_ad_id: adId });
    return {
      ownerType: "teacher",
      ownerId: r.teacher_id,
      adId: r.ad_id,
      batchId: r.batch_id,
      name: r.display_name,
      photoUrl: r.photo_url,
      adTitle: r.ad_title,
      adContent: r.ad_content,
      subject: r.subject,
      gradeBand: r.grade_band,
      location: r.location,
      mode: r.mode,
      scheduleNote: r.schedule_note,
      hourlyRate: r.hourly_rate,
      monthlyRate: r.monthly_rate,
      rating: r.rating,
      reviewCount: r.review_count,
      institutionVerified: r.institution_verified,
      isCampusLecturer: r.is_campus_lecturer,
      courseCode: r.course_code,
      isOpenEnrollment: r.is_open_enrollment,
      capacity: r.capacity,
      spotsTaken: r.spots_taken,
      medium: r.medium as "english" | "sinhala" | "tamil" | "other" | null,
      classType: r.class_type as "new" | "revision" | null,
      hourlyRateMax: r.hourly_rate_max,
      monthlyRateMax: r.monthly_rate_max,
      totalSessions: r.total_sessions,
    };
  }

  const { data: classRows } = await supabase.rpc("get_public_class_ad", { p_ad_id: adId });
  if (classRows && classRows.length > 0) {
    const r = classRows[0];
    await supabase.rpc("increment_ad_view", { p_ad_id: adId });
    return {
      ownerType: "class",
      ownerId: r.class_id,
      adId: r.ad_id,
      batchId: r.batch_id,
      name: r.name,
      photoUrl: r.photo_url,
      adTitle: r.ad_title,
      adContent: r.ad_content,
      subject: r.subject,
      gradeBand: r.grade_band,
      location: r.location,
      mode: r.mode,
      scheduleNote: r.schedule_note,
      hourlyRate: r.hourly_rate,
      monthlyRate: r.monthly_rate,
      rating: r.rating,
      reviewCount: r.review_count,
      institutionVerified: r.institution_verified,
      isCampusLecturer: false,
      courseCode: r.course_code,
      isOpenEnrollment: r.is_open_enrollment,
      capacity: r.capacity,
      spotsTaken: r.spots_taken,
      medium: null,
      classType: null,
      hourlyRateMax: null,
      monthlyRateMax: null,
      totalSessions: r.total_sessions,
    };
  }

  return null;
}

/**
 * "Lesson/Grade-wise Ad" (0138) — a narrower promotion than the batch-shaped
 * ads above: one already-scheduled live class, not an ongoing arrangement.
 * Deliberately a separate type/loader/render branch rather than folding
 * into NormalizedAd — every field above (batchId, isOpenEnrollment,
 * capacity, spotsTaken, hourlyRate...) is a batch concept that simply
 * doesn't apply to a single lesson, and JoinRequestBox needs a real
 * batchId to request into.
 */
type NormalizedLessonAd = {
  adId: string;
  teacherId: string;
  name: string | null;
  photoUrl: string | null;
  adTitle: string;
  adContent: string | null;
  subject: string | null;
  lessonTitle: string;
  scheduledAtIso: string;
  durationMinutes: number;
  mode: string;
  location: string | null;
  rating: number;
  reviewCount: number;
  isCampusLecturer: boolean;
  institutionVerified: boolean;
};

async function loadLessonAd(adId: string): Promise<NormalizedLessonAd | null> {
  const supabase = await createClient();

  const { data: rows } = await supabase.rpc("get_public_lesson_ad", { p_ad_id: adId });
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  await supabase.rpc("increment_ad_view", { p_ad_id: adId });
  return {
    adId: r.ad_id,
    teacherId: r.teacher_id,
    name: r.display_name,
    photoUrl: r.photo_url,
    adTitle: r.ad_title,
    adContent: r.ad_content,
    subject: r.subject,
    lessonTitle: r.lesson_title,
    scheduledAtIso: r.scheduled_at,
    durationMinutes: r.duration_minutes,
    mode: r.mode,
    location: r.location,
    rating: r.rating,
    reviewCount: r.review_count,
    isCampusLecturer: r.is_campus_lecturer,
    institutionVerified: r.institution_verified,
  };
}

/**
 * "Teacher-Wise Ad" (0140, mockup section 2.4) -- an institute-owned ad
 * about a specific staff member, not a batch. Its own type/loader/render
 * branch for the same reason NormalizedLessonAd got one: every batch-shaped
 * field above (batchId, isOpenEnrollment, hourlyRate...) simply doesn't
 * apply, and the "owner" here (the institute) and the "subject" of the ad
 * (the featured teacher) are two different identities, unlike every other
 * ad type on this page.
 */
type NormalizedTeacherWiseAd = {
  adId: string;
  instituteId: string;
  instituteName: string;
  institutePhotoUrl: string | null;
  institutionVerified: boolean;
  teacherId: string;
  teacherName: string | null;
  teacherPhotoUrl: string | null;
  headline: string | null;
  subjects: string[];
  experienceYears: number | null;
  rating: number;
  reviewCount: number;
  adTitle: string;
  adContent: string | null;
};

async function loadTeacherWiseAd(adId: string): Promise<NormalizedTeacherWiseAd | null> {
  const supabase = await createClient();

  const { data: rows } = await supabase.rpc("get_public_teacher_wise_ad", { p_ad_id: adId });
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  await supabase.rpc("increment_ad_view", { p_ad_id: adId });
  return {
    adId: r.ad_id,
    instituteId: r.institute_id,
    instituteName: r.institute_name,
    institutePhotoUrl: r.institute_photo_url,
    institutionVerified: r.institution_verified,
    teacherId: r.teacher_id,
    teacherName: r.display_name,
    teacherPhotoUrl: r.photo_url,
    headline: r.headline,
    subjects: r.subjects,
    experienceYears: r.experience_years,
    rating: r.rating,
    reviewCount: r.review_count,
    adTitle: r.ad_title,
    adContent: r.ad_content,
  };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/ad/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const [ad, t] = await Promise.all([loadAd(id), getTranslations({ locale, namespace: "meta" })]);
  if (ad) {
    const name = ad.name ?? (ad.ownerType === "class" ? t("classRoleFallback") : t("teacherRoleFallback"));
    return {
      title: t("adTitle", { adTitle: ad.adTitle, name }),
      description: t("adDescription", { name }),
    };
  }
  const lessonAd = await loadLessonAd(id);
  if (lessonAd) {
    const name = lessonAd.name ?? t("teacherRoleFallback");
    return {
      title: t("adTitle", { adTitle: lessonAd.adTitle, name }),
      description: t("adDescription", { name }),
    };
  }
  const teacherWiseAd = await loadTeacherWiseAd(id);
  if (teacherWiseAd) {
    const name = teacherWiseAd.instituteName ?? t("classRoleFallback");
    return {
      title: t("adTitle", { adTitle: teacherWiseAd.adTitle, name }),
      description: t("adDescription", { name }),
    };
  }
  return {};
}

/**
 * Landing page for a clicked search-result ad (0039/0040, extended to
 * institute batches by 0103) — still lighter than the full /teacher/[id]
 * profile (no work history, affiliated institutes, or full schedule), but a
 * teacher ad now also surfaces their real bio/qualifications/experience and
 * a few actual reviews (pulled from the same public RPCs the profile page
 * uses) so a visitor gets a real sense of the teacher without leaving this
 * page. An institute class ad keeps the plainer version — there's no single
 * teacher bio to show for a whole class.
 */
export default async function AdLandingPage({ params }: PageProps<"/[locale]/ad/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ad = await loadAd(id);
  if (!ad) {
    const lessonAd = await loadLessonAd(id);
    if (lessonAd) {
      return <LessonAdView ad={lessonAd} locale={locale} />;
    }
    const teacherWiseAd = await loadTeacherWiseAd(id);
    if (teacherWiseAd) {
      return <TeacherWiseAdView ad={teacherWiseAd} />;
    }
    notFound();
  }

  const user = await getAuthUser();
  const supabase = await createClient();

  let viewerRole: string | null = null;
  let existingStatus: "pending" | "accepted" | "declined" | null = null;
  if (user) {
    const [{ data: profile }, { data: existing }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      // Scoped to this ad's specific batch, not just the owner overall — a
      // student already enrolled in one of this owner's other batches
      // (0091/0092) can still request to join this one.
      supabase
        .from("enrollments")
        .select("status")
        .eq("student_id", user.id)
        .eq("owner_type", ad.ownerType)
        .eq("owner_id", ad.ownerId)
        .eq("batch_id", ad.batchId)
        .maybeSingle(),
    ]);
    viewerRole = profile?.role ?? null;
    existingStatus = existing?.status ?? null;
  }

  // Notes flagged is_public (0045) are visible to any signed-in account, not
  // just students enrolled with this owner — a guest query here just comes
  // back empty under RLS, so the section naturally disappears for guests
  // rather than needing a separate "sign in to see" branch.
  const { data: freeNoteRows } = await supabase
    .from("notes")
    .select("id, title")
    .eq("owner_type", ad.ownerType)
    .eq("owner_id", ad.ownerId)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  // Reuses the same public RPCs the full /teacher/[id] profile page calls —
  // bio/qualifications/experience and a real review list, not fabricated
  // content. Only for a teacher-owned ad; an institute class ad has no
  // single teacher to show a bio for.
  const [{ data: teacherProfileRows }, { data: reviewRows }] =
    ad.ownerType === "teacher"
      ? await Promise.all([
          supabase.rpc("get_public_teacher_profile", { p_teacher_id: ad.ownerId }),
          supabase.rpc("list_public_reviews", { p_target_type: "teacher", p_target_id: ad.ownerId }),
        ])
      : [{ data: null }, { data: null }];
  const teacherProfile = teacherProfileRows?.[0] ?? null;
  const dateFormatter = createDateFormatter(locale);
  const reviews: ReviewDisplay[] = (reviewRows ?? [])
    .slice(0, 3)
    .map((r) => ({
      id: r.id,
      author: r.author ?? "Anonymous",
      date: dateFormatter.format(new Date(r.created_at)),
      rating: r.rating,
      body: r.body ?? "",
      reply: r.reply ?? undefined,
    }));

  const t = await getTranslations("adPage");
  const tg = await getTranslations("search");
  const tl = await getTranslations("listing");
  const tr = await getTranslations("requestsPage");
  // Reuses the full /teacher/[id] profile page's own labels (Qualifications,
  // Work experience, Subjects, Languages...) instead of duplicating the same
  // English/Sinhala/Tamil strings under adPage — same wording either place a
  // visitor sees a teacher's credentials.
  const tp = await getTranslations("profilePage");

  const displayName = ad.name ?? (ad.ownerType === "class" ? t("classFallback") : t("teacherFallback"));

  // A teacher ad's content has always been rich-text HTML (0119, sanitized
  // again here per this app's read-time sanitize convention). An institute
  // class ad's composer only started producing real HTML later — any
  // already-posted class ad from before that switch is still free text
  // written one point per line (e.g. "Program Highlights:", "Interactive
  // lessons..."), so detect which shape this particular row actually is
  // rather than trusting ownerType, and keep the older line-split rendering
  // (one real bullet per line once there's more than one) for genuine
  // legacy plain text.
  const richContent =
    ad.ownerType === "teacher" || looksLikeRichTextHtml(ad.adContent) ? sanitizeRichText(ad.adContent ?? "") : null;
  const contentLines =
    richContent === null
      ? (ad.adContent ?? "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

  return (
    <div className="mx-auto max-w-[860px] px-7 py-10">
      <Link
        href="/teachers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("breadcrumbHome")}
      </Link>

      <div className="mb-6 rounded-xl bg-gradient-to-br from-primary to-primary-light p-7 text-white">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {ad.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.photoUrl}
              alt=""
              className="mx-auto size-20 shrink-0 rounded-full border-4 border-white object-cover shadow-sm sm:mx-0"
            />
          ) : (
            <div
              className={`mx-auto flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white font-display text-2xl font-bold text-white shadow-sm sm:mx-0 ${avatarGradientClass(ad.ownerId)}`}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {ad.subject && (
              <div className="mb-1 font-mono text-xs uppercase tracking-[0.12em] text-white/70">{ad.subject}</div>
            )}
            <h1 className="mb-1.5 flex items-center gap-1.5 text-2xl text-white">
              {displayName}
              <span title={ad.institutionVerified ? tl("institutionVerified") : tl("reviewed")}>
                <BadgeCheck className="size-4 shrink-0" aria-label={ad.institutionVerified ? tl("institutionVerified") : tl("reviewed")} />
              </span>
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/85">
              {ad.reviewCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Star className="size-3.5" fill="currentColor" />
                  {ad.rating.toFixed(1)} ({ad.reviewCount})
                </span>
              )}
              {teacherProfile?.experience_years != null && (
                <span>{t("teacherWiseAd.experienceYears", { count: teacherProfile.experience_years })}</span>
              )}
              {ad.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {ad.location}
                </span>
              )}
              {ad.gradeBand && (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                  {tg(`grades.${ad.gradeBand}`)}
                </span>
              )}
              <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                {ad.mode === "online" ? t("online") : ad.mode === "travels_to_student" ? t("travelsToStudent") : t("physical")}
              </span>
              {ad.medium && (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                  {tr(`mediumOptions.${ad.medium}`)}
                </span>
              )}
              {ad.classType === "revision" && (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                  {tr("classTypeOptions.revision")}
                </span>
              )}
              {ad.totalSessions && (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                  {t("sessionsCount", { count: ad.totalSessions })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <h2 className="mt-7 mb-4 text-2xl text-primary sm:text-[26px]">
        {ad.courseCode && <span className="text-muted-foreground">{ad.courseCode} · </span>}
        {ad.adTitle}
      </h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
          <h3 className="mb-3 text-lg">
            {ad.isCampusLecturer || ad.totalSessions ? t("aboutHeadingCampus") : t("aboutHeading")}
          </h3>
          {richContent !== null ? (
            hasRichText(richContent) && (
              <div
                className={`text-sm text-foreground/85 ${RICH_TEXT_DISPLAY_CLASS}`}
                dangerouslySetInnerHTML={{ __html: richContent }}
              />
            )
          ) : contentLines.length > 1 ? (
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/85">
              {contentLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground/85">{contentLines[0] ?? ""}</p>
          )}
          {ad.scheduleNote && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("schedule")}: {ad.scheduleNote}
            </p>
          )}
          <p className="mt-6 text-xs text-muted-foreground">
            {ad.isCampusLecturer ? t("limitedNoteCampus") : ad.ownerType === "class" ? t("limitedNoteClass") : t("limitedNote")}
          </p>
        </div>

        {ad.ownerType === "teacher" &&
          teacherProfile &&
          (teacherProfile.bio ||
            (teacherProfile.qualifications?.length ?? 0) > 0 ||
            (teacherProfile.work_experience?.length ?? 0) > 0 ||
            (teacherProfile.subjects?.length ?? 0) > 0 ||
            (teacherProfile.languages?.length ?? 0) > 0 ||
            teacherProfile.experience_years != null) && (
          <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
            <h3 className="mb-3 text-lg">{t("aboutTeacherHeading")}</h3>
            {teacherProfile.is_campus_lecturer && (teacherProfile.academic_title || teacherProfile.institution) && (
              <p className="mb-2 text-sm font-medium text-foreground">
                {[teacherProfile.academic_title, teacherProfile.institution].filter(Boolean).join(" · ")}
              </p>
            )}
            {teacherProfile.bio && <p className="text-sm text-foreground/85">{teacherProfile.bio}</p>}

            {(teacherProfile.qualifications?.length ?? 0) > 0 && (
              <div className="mt-3.5">
                <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{tp("degreeLabel")}</p>
                <ul className="m-0 list-disc space-y-1 pl-4.5 text-sm text-foreground/85">
                  {(teacherProfile.qualifications ?? []).map((q: string, i: number) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {(teacherProfile.work_experience?.length ?? 0) > 0 && (
              <div className="mt-3.5">
                <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{tp("workExperienceLabel")}</p>
                <ul className="m-0 list-disc space-y-1 pl-4.5 text-sm text-foreground/85">
                  {(teacherProfile.work_experience ?? []).map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {teacherProfile.is_campus_lecturer && (teacherProfile.publications?.length ?? 0) > 0 && (
              <div className="mt-3.5">
                <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{tp("publicationsLabel")}</p>
                <ul className="m-0 list-disc space-y-1 pl-4.5 text-sm text-foreground/85">
                  {(teacherProfile.publications ?? []).map((pub: string, i: number) => (
                    <li key={i}>{pub}</li>
                  ))}
                </ul>
              </div>
            )}

            {(teacherProfile.experience_years != null ||
              (teacherProfile.subjects?.length ?? 0) > 0 ||
              (teacherProfile.languages?.length ?? 0) > 0) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3.5">
                {teacherProfile.experience_years != null && (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {t("teacherWiseAd.experienceYears", { count: teacherProfile.experience_years })}
                  </span>
                )}
                {(teacherProfile.subjects ?? []).map((subject: string) => (
                  <span key={subject} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    {subject}
                  </span>
                ))}
                {(teacherProfile.languages ?? []).map((language: string) => (
                  <span
                    key={language}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground/80"
                  >
                    {language}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {ad.ownerType === "teacher" && (
          <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg">{t("reviewsHeading")}</h3>
              {ad.reviewCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  {t("reviewsSummary", { rating: ad.rating.toFixed(1), count: ad.reviewCount })}
                </span>
              )}
            </div>
            {reviews.length > 0 ? (
              reviews.map((review) => <ReviewItem key={review.id} review={review} />)
            ) : (
              <p className="py-2 text-sm text-muted-foreground">{t("noReviewsYet")}</p>
            )}
          </div>
        )}
        </div>

        <div className="flex flex-col gap-6">
          {ad.gradeBand && (
            <div className="flex h-fit flex-col gap-1.5 rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
              <h3 className="text-sm font-semibold text-foreground">{t("levelHeading")}</h3>
              <p className="text-sm text-foreground/85">{tg(`grades.${ad.gradeBand}`)}</p>
            </div>
          )}

          <JoinRequestBox
            batchId={ad.batchId}
            ownerType={ad.ownerType}
            ownerId={ad.ownerId}
            hourlyRate={ad.hourlyRate ?? undefined}
            monthlyRate={ad.monthlyRate ?? undefined}
            hourlyRateMax={ad.hourlyRateMax ?? undefined}
            monthlyRateMax={ad.monthlyRateMax ?? undefined}
            loggedIn={Boolean(user)}
            isStudent={viewerRole === "student"}
            existingStatus={existingStatus}
            isCampusLecturer={ad.isCampusLecturer}
            isOpenEnrollment={ad.isOpenEnrollment}
            capacity={ad.capacity ?? undefined}
            spotsTaken={ad.spotsTaken}
          />

          {freeNoteRows && freeNoteRows.length > 0 && (
            <div className="flex h-fit flex-col gap-2.5 rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
              <h3 className="text-sm font-semibold text-foreground">{t("resourcesHeading", { name: displayName })}</h3>
              <ul className="flex flex-col gap-2">
                {freeNoteRows.map((note) => (
                  <li key={note.id}>
                    <a
                      href={`/notes/${note.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <FileText className="size-4 shrink-0" />
                      <span className="truncate">{note.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ShareButtons title={ad.adTitle} />
        </div>
      </div>
    </div>
  );
}

/**
 * "Lesson/Grade-wise Ad" landing page (0138) — deliberately much lighter
 * than the batch-shaped view above: one date/time instead of a recurring
 * schedule, no grade/rate/open-enrollment panels (a lesson ad carries none
 * of that), and LessonInquiryBox instead of JoinRequestBox since there's
 * nothing here to enroll in — just a trial someone can ask about.
 */
async function LessonAdView({ ad, locale }: { ad: NormalizedLessonAd; locale: string }) {
  const t = await getTranslations("adPage");
  const tl = await getTranslations("listing");
  const displayName = ad.name ?? t("teacherFallback");
  const richContent = sanitizeRichText(ad.adContent ?? "");
  const scheduledLabel = createDateTimeFormatter(locale).format(new Date(ad.scheduledAtIso));

  return (
    <div className="mx-auto max-w-[860px] px-7 py-10">
      <Link
        href="/teachers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("breadcrumbHome")}
      </Link>

      <div className="mb-6 rounded-xl bg-gradient-to-br from-primary to-primary-light p-7 text-white">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {ad.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.photoUrl}
              alt=""
              className="mx-auto size-20 shrink-0 rounded-full border-4 border-white object-cover shadow-sm sm:mx-0"
            />
          ) : (
            <div
              className={`mx-auto flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white font-display text-2xl font-bold text-white shadow-sm sm:mx-0 ${avatarGradientClass(ad.teacherId)}`}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {ad.subject && <div className="mb-1 font-mono text-xs uppercase tracking-[0.12em] text-white/70">{ad.subject}</div>}
            <h1 className="mb-1.5 flex items-center gap-1.5 text-2xl text-white">
              {displayName}
              <span title={ad.institutionVerified ? tl("institutionVerified") : tl("reviewed")}>
                <BadgeCheck
                  className="size-4 shrink-0"
                  aria-label={ad.institutionVerified ? tl("institutionVerified") : tl("reviewed")}
                />
              </span>
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/85">
              {ad.reviewCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Star className="size-3.5" fill="currentColor" />
                  {ad.rating.toFixed(1)} ({ad.reviewCount})
                </span>
              )}
              {ad.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {ad.location}
                </span>
              )}
              <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                {ad.mode === "online" ? t("online") : ad.mode === "travels_to_student" ? t("travelsToStudent") : t("physical")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="mt-7 mb-4 text-2xl text-primary sm:text-[26px]">{ad.adTitle}</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
          <h3 className="mb-3 text-lg">{ad.isCampusLecturer ? t("aboutHeadingCampus") : t("aboutHeading")}</h3>
          {hasRichText(richContent) && (
            <div
              className={`text-sm text-foreground/85 ${RICH_TEXT_DISPLAY_CLASS}`}
              dangerouslySetInnerHTML={{ __html: richContent }}
            />
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            {t("schedule")}: {scheduledLabel} ({t("durationMinutes", { minutes: ad.durationMinutes })})
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <InquiryBox ownerType="teacher" ownerId={ad.teacherId} />
          <ShareButtons title={ad.adTitle} />
        </div>
      </div>
    </div>
  );
}

/**
 * "Teacher-Wise Ad" landing page (0140) -- the institute is the brand
 * (hero identical in spirit to the class-ad view above: institute name/
 * photo/verified badge), but the ad is about one specific staff member, so
 * a dedicated "Meet the teacher" panel carries their own masked identity,
 * subjects and rating. No batch here to enroll in, so InquiryBox (pointed
 * at the institute, not the teacher -- the institute owns this ad) stands
 * in for JoinRequestBox, same reasoning as LessonAdView's own.
 */
async function TeacherWiseAdView({ ad }: { ad: NormalizedTeacherWiseAd }) {
  const t = await getTranslations("adPage");
  const tl = await getTranslations("listing");
  const displayInstituteName = ad.instituteName ?? t("classFallback");
  const displayTeacherName = ad.teacherName ?? t("teacherFallback");
  const richContent = sanitizeRichText(ad.adContent ?? "");

  return (
    <div className="mx-auto max-w-[860px] px-7 py-10">
      <Link
        href="/teachers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("breadcrumbHome")}
      </Link>

      <div className="mb-6 rounded-xl bg-gradient-to-br from-primary to-primary-light p-7 text-white">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {ad.institutePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.institutePhotoUrl}
              alt=""
              className="mx-auto size-20 shrink-0 rounded-full border-4 border-white object-cover shadow-sm sm:mx-0"
            />
          ) : (
            <div
              className={`mx-auto flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white font-display text-2xl font-bold text-white shadow-sm sm:mx-0 ${avatarGradientClass(ad.instituteId)}`}
            >
              {displayInstituteName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="mb-1.5 flex items-center gap-1.5 text-2xl text-white">
              {displayInstituteName}
              <span title={ad.institutionVerified ? tl("institutionVerified") : tl("reviewed")}>
                <BadgeCheck
                  className="size-4 shrink-0"
                  aria-label={ad.institutionVerified ? tl("institutionVerified") : tl("reviewed")}
                />
              </span>
            </h1>
          </div>
        </div>
      </div>

      <h2 className="mt-7 mb-4 text-2xl text-primary sm:text-[26px]">{ad.adTitle}</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
            <h3 className="mb-3 text-lg">{t("aboutHeading")}</h3>
            {hasRichText(richContent) && (
              <div
                className={`text-sm text-foreground/85 ${RICH_TEXT_DISPLAY_CLASS}`}
                dangerouslySetInnerHTML={{ __html: richContent }}
              />
            )}
          </div>

          <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
            <div className="mb-3 flex items-center gap-3">
              {ad.teacherPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ad.teacherPhotoUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold text-white ${avatarGradientClass(ad.teacherId)}`}
                >
                  {displayTeacherName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">{t("teacherWiseAd.meetHeading", { teacherName: displayTeacherName })}</h3>
                {ad.headline && <p className="text-sm text-muted-foreground">{ad.headline}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {ad.reviewCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Star className="size-3.5 text-cta" fill="currentColor" />
                  {ad.rating.toFixed(1)} ({ad.reviewCount})
                </span>
              )}
              {ad.experienceYears !== null && <span>{t("teacherWiseAd.experienceYears", { count: ad.experienceYears })}</span>}
            </div>
            {ad.subjects.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("teacherWiseAd.subjectsHeading")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ad.subjects.map((subject) => (
                    <span
                      key={subject}
                      className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground/80"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <InquiryBox ownerType="class" ownerId={ad.instituteId} tNamespace="adPage.teacherWiseInquiry" />
          <ShareButtons title={ad.adTitle} />
        </div>
      </div>
    </div>
  );
}
