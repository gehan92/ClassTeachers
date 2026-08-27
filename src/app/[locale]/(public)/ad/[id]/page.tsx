import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, FileText, MapPin, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { JoinRequestBox } from "@/components/features/join-request-box";
import { ShareButtons } from "@/components/features/share-buttons";
import { createClient } from "@/lib/supabase/server";
import { avatarGradientClass } from "@/lib/avatar-color";

async function loadAd(adId: string) {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("get_public_ad", { p_ad_id: adId });
  if (error || !rows || rows.length === 0) {
    return null;
  }
  return rows[0];
}

/**
 * Landing page for a clicked search-result ad (0039/0040) — deliberately
 * shows less than the full /teacher/[id] profile (no bio, qualifications,
 * work history or reviews list): just what this one class/subject is, and a
 * way to request to join. Full details unlock once the teacher accepts.
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
      supabase
        .from("enrollments")
        .select("status")
        .eq("student_id", user.id)
        .eq("owner_type", "teacher")
        .eq("owner_id", ad.teacher_id)
        .maybeSingle(),
    ]);
    viewerRole = profile?.role ?? null;
    existingStatus = existing?.status ?? null;
  }

  // Notes flagged is_public (0045) are visible to any signed-in account, not
  // just students enrolled with this teacher — a guest query here just comes
  // back empty under RLS, so the section naturally disappears for guests
  // rather than needing a separate "sign in to see" branch.
  const { data: freeNoteRows } = await supabase
    .from("notes")
    .select("id, title")
    .eq("owner_type", "teacher")
    .eq("owner_id", ad.teacher_id)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const t = await getTranslations("adPage");
  const tg = await getTranslations("search");

  // Ad content is free text — teachers write it as one point per line
  // (e.g. "Program Highlights:", "Interactive lessons...", ...). Rendered
  // as a real list once there's more than one line; a single line (or none)
  // stays a plain paragraph rather than showing one lonely bullet.
  const contentLines = (ad.ad_content ?? "")
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
          {ad.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.photo_url}
              alt=""
              className="mx-auto size-20 shrink-0 rounded-full border-4 border-white object-cover shadow-sm sm:mx-0"
            />
          ) : (
            <div
              className={`mx-auto flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white font-display text-2xl font-bold text-white shadow-sm sm:mx-0 ${avatarGradientClass(ad.teacher_id)}`}
            >
              {(ad.display_name ?? "T").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {ad.subject && (
              <div className="mb-1 font-mono text-xs uppercase tracking-[0.12em] text-white/70">{ad.subject}</div>
            )}
            <h1 className="mb-1.5 text-2xl text-white">{ad.display_name ?? t("teacherFallback")}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/85">
              {ad.review_count > 0 && (
                <span className="flex items-center gap-1.5">
                  <Star className="size-3.5" fill="currentColor" />
                  {ad.rating.toFixed(1)} ({ad.review_count})
                </span>
              )}
              {ad.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {ad.location}
                </span>
              )}
              {ad.grade_band && (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                  {tg(`grades.${ad.grade_band}`)}
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
        {ad.is_campus_lecturer && ad.course_code && (
          <span className="text-muted-foreground">{ad.course_code} · </span>
        )}
        {ad.ad_title}
      </h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
          <h3 className="mb-3 text-lg">{ad.is_campus_lecturer ? t("aboutHeadingCampus") : t("aboutHeading")}</h3>
          {contentLines.length > 1 ? (
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/85">
              {contentLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground/85">{contentLines[0] ?? ""}</p>
          )}
          {ad.schedule_note && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("schedule")}: {ad.schedule_note}
            </p>
          )}
          <p className="mt-6 text-xs text-muted-foreground">
            {ad.is_campus_lecturer ? t("limitedNoteCampus") : t("limitedNote")}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {ad.grade_band && (
            <div className="flex h-fit flex-col gap-1.5 rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
              <h3 className="text-sm font-semibold text-foreground">{t("levelHeading")}</h3>
              <p className="text-sm text-foreground/85">{tg(`grades.${ad.grade_band}`)}</p>
            </div>
          )}

          <JoinRequestBox
            batchId={ad.batch_id}
            teacherId={ad.teacher_id}
            hourlyRate={ad.hourly_rate ?? undefined}
            monthlyRate={ad.monthly_rate ?? undefined}
            loggedIn={Boolean(user)}
            isStudent={viewerRole === "student"}
            existingStatus={existingStatus}
            isCampusLecturer={ad.is_campus_lecturer}
          />

          {freeNoteRows && freeNoteRows.length > 0 && (
            <div className="flex h-fit flex-col gap-2.5 rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
              <h3 className="text-sm font-semibold text-foreground">
                {t("resourcesHeading", { name: ad.display_name ?? t("teacherFallback") })}
              </h3>
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

          <ShareButtons title={ad.ad_title} />
        </div>
      </div>
    </div>
  );
}
