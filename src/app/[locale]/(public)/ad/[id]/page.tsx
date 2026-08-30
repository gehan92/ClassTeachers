import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, BadgeCheck, FileText, MapPin, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { JoinRequestBox } from "@/components/features/join-request-box";
import { ShareButtons } from "@/components/features/share-buttons";
import { createClient } from "@/lib/supabase/server";
import { avatarGradientClass } from "@/lib/avatar-color";

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
};

async function loadAd(adId: string): Promise<NormalizedAd | null> {
  const supabase = await createClient();

  const { data: teacherRows } = await supabase.rpc("get_public_ad", { p_ad_id: adId });
  if (teacherRows && teacherRows.length > 0) {
    const r = teacherRows[0];
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
    };
  }

  const { data: classRows } = await supabase.rpc("get_public_class_ad", { p_ad_id: adId });
  if (classRows && classRows.length > 0) {
    const r = classRows[0];
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
      courseCode: null,
    };
  }

  return null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/ad/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const [ad, t] = await Promise.all([loadAd(id), getTranslations({ locale, namespace: "meta" })]);
  if (!ad) return {};
  const name = ad.name ?? (ad.ownerType === "class" ? t("classRoleFallback") : t("teacherRoleFallback"));
  return {
    title: t("adTitle", { adTitle: ad.adTitle, name }),
    description: t("adDescription", { name }),
  };
}

/**
 * Landing page for a clicked search-result ad (0039/0040, extended to
 * institute batches by 0103) — deliberately shows less than the full
 * /teacher/[id] or /class/[id] profile (no bio, qualifications, work
 * history or reviews list): just what this one class/subject is, and a way
 * to request to join. Full details unlock once the owner accepts.
 */
export default async function AdLandingPage({ params }: PageProps<"/[locale]/ad/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ad = await loadAd(id);
  if (!ad) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const t = await getTranslations("adPage");
  const tg = await getTranslations("search");
  const tl = await getTranslations("listing");

  const displayName = ad.name ?? (ad.ownerType === "class" ? t("classFallback") : t("teacherFallback"));

  // Ad content is free text — written as one point per line (e.g. "Program
  // Highlights:", "Interactive lessons...", ...). Rendered as a real list
  // once there's more than one line; a single line (or none) stays a plain
  // paragraph rather than showing one lonely bullet.
  const contentLines = (ad.adContent ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

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
                {ad.mode === "online" ? t("online") : t("physical")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="mt-7 mb-4 text-2xl text-primary sm:text-[26px]">
        {ad.isCampusLecturer && ad.courseCode && <span className="text-muted-foreground">{ad.courseCode} · </span>}
        {ad.adTitle}
      </h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
          <h3 className="mb-3 text-lg">{ad.isCampusLecturer ? t("aboutHeadingCampus") : t("aboutHeading")}</h3>
          {contentLines.length > 1 ? (
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
            loggedIn={Boolean(user)}
            isStudent={viewerRole === "student"}
            existingStatus={existingStatus}
            isCampusLecturer={ad.isCampusLecturer}
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
