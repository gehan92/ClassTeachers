import { createElement } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createDateFormatter } from "@/lib/format-date";
import { avatarGradientClass } from "@/lib/avatar-color";
import { getSubjectIcon } from "@/lib/subject-icon";
import { getWantedAdRespondHref, resolveWantedAdResponder } from "@/lib/wanted-ad-respond-href";

async function loadAd(id: string) {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("get_public_wanted_ad", { p_id: id });
  if (error || !rows || rows.length === 0) {
    return null;
  }
  return rows[0];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/requests/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const [ad, t] = await Promise.all([loadAd(id), getTranslations({ locale, namespace: "meta" })]);
  if (!ad) return {};
  return {
    title: t("requestDetailTitle", { title: ad.title }),
    description: t("requestDetailDescription"),
  };
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

  const responder = await resolveWantedAdResponder(supabase, user?.id);
  let myResponse: string | null = null;
  if (responder) {
    const { data: existingResponse } = await supabase
      .from("wanted_ad_responses")
      .select("message")
      .eq("wanted_ad_id", ad.id)
      .eq("responder_type", responder.responderType)
      .eq("responder_id", responder.responderId)
      .maybeSingle();
    myResponse = existingResponse?.message ?? null;
  }

  const dateFormatter = createDateFormatter(locale);
  const t = await getTranslations("requestsPage");
  const td = await getTranslations("requestsPage.detail");

  return (
    <div className="mx-auto max-w-[860px] px-7 py-10">
      <Link
        href="/requests"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {td("backToRequests")}
      </Link>

      <div className="mb-6 rounded-xl bg-gradient-to-br from-primary to-primary-light p-7 text-white">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            className={`mx-auto flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white text-white shadow-sm sm:mx-0 ${avatarGradientClass(ad.id)}`}
          >
            {createElement(getSubjectIcon(ad.subject), { className: "size-8" })}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-white/70">
              <span>{t(`lookingForOptions.${ad.looking_for as "teacher" | "institute"}`)}</span>
              {ad.class_type === "revision" && (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 normal-case tracking-normal">
                  {t("classTypeOptions.revision")}
                </span>
              )}
            </div>
            <h1 className="mb-1.5 text-2xl text-white">{ad.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/85">
              {ad.subject && <span>{ad.subject}</span>}
              {ad.mode && (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                  {t(`modeOptions.${ad.mode as "online" | "physical" | "both"}`)}
                </span>
              )}
              <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                {t(`mediumOptions.${ad.medium as "english" | "sinhala" | "tamil" | "other"}`)}
              </span>
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
          {myResponse ? (
            <>
              <h3 className="text-sm font-semibold text-foreground">{td("alreadyRespondedHeading")}</h3>
              <p className="text-sm text-muted-foreground">{td("alreadyRespondedHelper")}</p>
              <p className="rounded-md bg-secondary/60 px-3 py-2 text-sm text-foreground/85">{myResponse}</p>
              <Button variant="outline" nativeButton={false} render={<Link href={respondHref} />}>
                {td("viewResponseCta")}
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-foreground">{td("respondHeading")}</h3>
              <p className="text-sm text-muted-foreground">{td("respondHelper")}</p>
              <Button nativeButton={false} render={<Link href={respondHref} />}>
                {t("respondCta")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
