"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StatCard } from "@/components/dashboard/stat-card";

const cardClass = "rounded-lg border border-border bg-white p-4.5";
const linkButtonClass =
  "inline-flex w-fit items-center rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60";

export function OverviewTab({
  teacherName,
  activeStudentsCount,
  averageRating,
  reviewsCount,
  pendingSubmissionsCount,
}: {
  teacherName: string;
  activeStudentsCount: number;
  averageRating: string | null;
  reviewsCount: number;
  pendingSubmissionsCount: number;
}) {
  const t = useTranslations("teacherDashboard.overview");
  const [classStarted, setClassStarted] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">{t("greeting", { name: teacherName.split(" ")[0] })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link href="/teacher?tab=exams" className="rounded-sm bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground hover:opacity-90">
          {t("createExam")}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.activeStudents")} value={activeStudentsCount} />
        {/* No payments/transactions table exists yet — earnings can't be computed from real data. */}
        <StatCard label={t("stats.earnings")} value={t("stats.earningsUnavailable")} />
        <StatCard
          label={t("stats.rating")}
          value={averageRating ?? "—"}
          delta={reviewsCount > 0 ? t("stats.ratingDelta", { count: reviewsCount }) : undefined}
        />
        <StatCard label={t("stats.submissions")} value={pendingSubmissionsCount} />
      </div>

      <div>
        <h3 className="mb-4 text-lg">{t("quickActionsHeading")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className={cardClass}>
            <div className="mb-1 font-semibold text-foreground">{t("actions.classHeading")}</div>
            <p className="mb-3.5 text-sm text-muted-foreground">{t("actions.classBody")}</p>
            <button
              type="button"
              className={linkButtonClass}
              disabled={classStarted}
              onClick={() => setClassStarted(true)}
            >
              {classStarted ? t("actions.classStarted") : t("actions.classAction")}
            </button>
          </div>

          <div className={cardClass}>
            <div className="mb-1 font-semibold text-foreground">{t("actions.gradingHeading")}</div>
            <p className="mb-3.5 text-sm text-muted-foreground">{t("actions.gradingBody")}</p>
            <Link href="/teacher?tab=exams" className={linkButtonClass}>
              {t("actions.gradingAction")}
            </Link>
          </div>

          <div className={cardClass}>
            <div className="mb-1 font-semibold text-foreground">{t("actions.reviewHeading")}</div>
            <p className="mb-3.5 text-sm text-muted-foreground italic">&ldquo;{t("actions.reviewBody")}&rdquo;</p>
            <Link href="/teacher?tab=reviews" className={linkButtonClass}>
              {t("actions.reviewAction")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
