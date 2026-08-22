import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MapPin, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { JoinRequestBox } from "@/components/features/join-request-box";
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

  const t = await getTranslations("adPage");
  const tg = await getTranslations("search");

  return (
    <div className="mx-auto max-w-[860px] px-7 py-10">
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/teachers" className="hover:text-primary">
          {t("breadcrumbHome")}
        </Link>
        {ad.subject && (
          <>
            <span>/</span>
            <Link href={`/teachers?subject=${encodeURIComponent(ad.subject)}`} className="hover:text-primary">
              {ad.subject}
            </Link>
          </>
        )}
        {ad.location && (
          <>
            <span>/</span>
            <span>{ad.location}</span>
          </>
        )}
      </nav>

      <div className="mb-6 rounded-xl bg-gradient-to-br from-primary to-primary-light p-7 text-white">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {ad.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.photo_url}
              alt=""
              className="size-16 shrink-0 rounded-full border-4 border-white object-cover shadow-sm"
            />
          ) : (
            <div
              className={`flex size-16 shrink-0 items-center justify-center rounded-full border-4 border-white font-display text-xl font-bold text-white shadow-sm ${avatarGradientClass(ad.teacher_id)}`}
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

      <h2 className="mt-7 mb-4 text-2xl text-primary sm:text-[26px]">{ad.ad_title}</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
          <h3 className="mb-3 text-lg">{t("aboutHeading")}</h3>
          <p className="whitespace-pre-line text-sm text-foreground/85">{ad.ad_content}</p>
          {ad.schedule_note && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("schedule")}: {ad.schedule_note}
            </p>
          )}
          <p className="mt-6 text-xs text-muted-foreground">{t("limitedNote")}</p>
        </div>

        <JoinRequestBox
          batchId={ad.batch_id}
          teacherId={ad.teacher_id}
          hourlyRate={ad.hourly_rate ?? undefined}
          monthlyRate={ad.monthly_rate ?? undefined}
          loggedIn={Boolean(user)}
          isStudent={viewerRole === "student"}
          existingStatus={existingStatus}
        />
      </div>
    </div>
  );
}
