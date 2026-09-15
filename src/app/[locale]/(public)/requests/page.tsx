import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WantedAdsBoard } from "@/components/features/wanted-ads-board";
import type { PublicWantedAd } from "@/components/features/wanted-ads-board";
import { SimpleAdsBoard } from "@/components/features/simple-ads-board";
import type { SimpleAd } from "@/components/features/simple-ads-board";
import { Eyebrow } from "@/components/features/eyebrow";
import { createClient } from "@/lib/supabase/server";
import { createDateFormatter } from "@/lib/format-date";
import { sanitizeRichTextNullable } from "@/lib/dashboard/sanitize-rich-text";

export async function generateMetadata({ params }: PageProps<"/[locale]/requests">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("requestsTitle"), description: t("requestsDescription") };
}

// "Teacher requests" (teacher_seeking_ads) and "Institute vacancies"
// (vacancy_ads) are new here (0143) -- both used to be dashboard-only, no
// public browse page. "Student requests" reuses the wanted-ads board
// exactly as it already worked (WantedAdsBoard itself is untouched) --
// direction=student_to_teacher/student_to_institute just pre-filters the
// same `ads` array the page already built, mirroring what its own
// ?lookingFor= param already did for a direct link.
type Direction = "student_to_teacher" | "student_to_institute" | "teacher_to_institute" | "institute_to_teacher";

function directionFromParam(value: string | string[] | undefined): Direction | null {
  if (
    value === "student_to_teacher" ||
    value === "student_to_institute" ||
    value === "teacher_to_institute" ||
    value === "institute_to_teacher"
  ) {
    return value;
  }
  return null;
}

export default async function RequestsPage({ params, searchParams }: PageProps<"/[locale]/requests">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const dateFormatter = createDateFormatter(locale);
  const t = await getTranslations("requestsPage");
  const resolvedSearchParams = await searchParams;
  const direction = directionFromParam(resolvedSearchParams.direction);

  const supabase = await createClient();

  if (direction === "teacher_to_institute") {
    const { data: rows } = await supabase.rpc("list_public_teacher_seeking_ads");
    const tBoard = await getTranslations("requestsPage.teacherRequests");
    const ads: SimpleAd[] = (rows ?? []).map((row) => ({
      id: row.id,
      badge: tBoard("badge"),
      title: row.title,
      metaLine: [row.subject, row.grade_band, row.mode ? tBoard(`modeOptions.${row.mode}`) : null].filter(Boolean).join(" · "),
      description: row.content,
      createdLabel: dateFormatter.format(new Date(row.created_at)),
    }));
    return (
      <RequestsShell eyebrow={t("hero.eyebrow")} title={tBoard("heroTitle")} subtitle={tBoard("heroSubtitle")}>
        <SimpleAdsBoard ads={ads} tNamespace="requestsPage.teacherRequests" />
      </RequestsShell>
    );
  }

  if (direction === "institute_to_teacher") {
    const { data: rows } = await supabase.rpc("list_public_vacancy_ads");
    const tBoard = await getTranslations("requestsPage.instituteVacancies");
    const ads: SimpleAd[] = (rows ?? []).map((row) => ({
      id: row.id,
      badge: tBoard("badge"),
      title: row.title,
      metaLine: [row.institute_name, row.subject, row.mode ? tBoard(`modeOptions.${row.mode}`) : null, row.location]
        .filter(Boolean)
        .join(" · "),
      description: row.content,
      createdLabel: dateFormatter.format(new Date(row.created_at)),
    }));
    return (
      <RequestsShell eyebrow={t("hero.eyebrow")} title={tBoard("heroTitle")} subtitle={tBoard("heroSubtitle")}>
        <SimpleAdsBoard ads={ads} tNamespace="requestsPage.instituteVacancies" />
      </RequestsShell>
    );
  }

  const { data: adRows } = await supabase.rpc("list_public_wanted_ads");

  // direction=student_to_teacher/student_to_institute (header dropdown,
  // 0143) pre-filters the same way a direct ?lookingFor= link already did —
  // WantedAdsBoard's own "lookingFor" chip still works untouched on top of
  // whatever this narrows to.
  const lookingForFilter = direction === "student_to_teacher" ? "teacher" : direction === "student_to_institute" ? "institute" : null;

  const ads: PublicWantedAd[] = (adRows ?? [])
    .filter((row) => !lookingForFilter || row.looking_for === lookingForFilter)
    .map((row) => ({
      id: row.id,
      lookingFor: row.looking_for as "teacher" | "institute",
      subject: row.subject,
      mode: row.mode as "online" | "physical" | "both" | null,
      gradeLevel: row.grade_level,
      medium: row.medium as "english" | "sinhala" | "tamil" | "other",
      classType: row.class_type as "new" | "revision",
      title: row.title,
      description: sanitizeRichTextNullable(row.description),
      budgetMin: row.budget_min,
      budgetMax: row.budget_max,
      createdLabel: dateFormatter.format(new Date(row.created_at)),
    }));

  return (
    <RequestsShell eyebrow={t("hero.eyebrow")} title={t("hero.title")} subtitle={t("hero.subtitle")}>
      <WantedAdsBoard ads={ads} />
    </RequestsShell>
  );
}

function RequestsShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <>
      {/* Same tinted-band heading shape as /teachers — this is another
       * searchable listing page, not a marketing landing page, so it
       * should match /teachers rather than /advertise. */}
      <section style={{ background: "var(--muted)" }} className="py-5">
        <div className="mx-auto max-w-[1180px] px-7">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="text-[32px]">{title}</h1>
          <p className="text-muted-foreground mb-0">{subtitle}</p>
        </div>
      </section>
      <section className="py-12">
        <div className="mx-auto max-w-[1180px] px-7">{children}</div>
      </section>
    </>
  );
}
