import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GraduationCap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createDateFormatter } from "@/lib/format-date";
import { avatarGradientClass } from "@/lib/avatar-color";
import { getWantedAdRespondHref } from "@/lib/wanted-ad-respond-href";

async function loadAd(id: string) {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("get_public_wanted_ad", { p_id: id });
  if (error || !rows || rows.length === 0) {
    return null;
  }
  return rows[0];
}

/**
 * Full view of one request, linked from its card on /requests — the card
 * itself line-clamps the description to 2 lines with no way to read the
 * rest, which is what prompted this page. Deliberately mirrors /ad/[id]'s
 * hero + two-column shape (0040) rather than /teacher/[id]'s full profile:
 * a wanted-ad has no profile to show, just the request content and a way
 * to respond. Never reveals who posted it, same as the card and /requests.
 */
export default async function RequestDetailPage({ params }: PageProps<"/[locale]/requests/[id]">) {
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
  const respondHref = await getWantedAdRespondHref(supabase, user?.id);

  const dateFormatter = createDateFormatter(locale);
  const t = await getTranslations("requestsPage");
  const td = await getTranslations("requestsPage.detail");

  return (
    <div className="mx-auto max-w-[860px] px-7 py-10">
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/requests" className="hover:text-primary">
          {td("breadcrumbHome")}
        </Link>
        <span>/</span>
        <span className="max-w-[220px] truncate text-muted-foreground/70">{ad.title}</span>
      </nav>

      <div className="mb-6 rounded-xl bg-gradient-to-br from-primary to-primary-light p-7 text-white">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            className={`mx-auto flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white text-white shadow-sm sm:mx-0 ${avatarGradientClass(ad.id)}`}
          >
            <GraduationCap className="size-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 font-mono text-xs uppercase tracking-[0.12em] text-white/70">
              {t(`lookingForOptions.${ad.looking_for as "teacher" | "institute"}`)}
            </div>
            <h1 className="mb-1.5 text-2xl text-white">{ad.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/85">
              {ad.subject && <span>{ad.subject}</span>}
              {ad.mode && (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                  {t(`modeOptions.${ad.mode as "online" | "physical" | "both"}`)}
                </span>
              )}
              {ad.grade_level && (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                  {ad.grade_level}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
          <h3 className="mb-3 text-lg">{td("aboutHeading")}</h3>
          {ad.description ? (
            <p className="whitespace-pre-line text-sm text-foreground/85">{ad.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{td("noDescription")}</p>
          )}
          <p className="mt-6 text-xs text-muted-foreground">
            {td("postedOn", { date: dateFormatter.format(new Date(ad.created_at)) })}
          </p>
        </div>

        <div className="flex h-fit flex-col gap-3 rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
          <h3 className="text-sm font-semibold text-foreground">{td("respondHeading")}</h3>
          <p className="text-sm text-muted-foreground">{td("respondHelper")}</p>
          <Button nativeButton={false} render={<Link href={respondHref} />}>
            {t("respondCta")}
          </Button>
        </div>
      </div>
    </div>
  );
}
