import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { studentEnrollments } from "@/lib/mock-data";

export function ClassesTab() {
  const t = useTranslations("studentDashboard.classes");

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-4">
        {studentEnrollments.map((enrollment) => (
          <div
            key={enrollment.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{enrollment.targetName}</span>
                <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {enrollment.targetType === "teacher" ? t("typeTeacher") : t("typeClass")}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">{enrollment.subject}</div>
              <div className="mt-1 text-xs text-muted-foreground">{enrollment.scheduleSummary}</div>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <span className="font-display text-base text-primary">{enrollment.priceDisplay}</span>
              <Link
                href={enrollment.targetHref}
                className="rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-secondary"
              >
                {t("viewProfile")}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
