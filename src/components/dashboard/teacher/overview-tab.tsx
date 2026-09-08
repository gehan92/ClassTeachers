"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { StatCard } from "@/components/dashboard/stat-card";
import { useLiveCall } from "@/components/dashboard/live-call-context";
import { notifyLiveClassStarted } from "@/lib/dashboard/live-classes-actions";

const cardClass = "rounded-lg border border-border bg-white p-4.5";
const linkButtonClass =
  "inline-flex w-fit items-center rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60";

export type NextLiveClass = {
  id: string;
  title: string;
  scheduledLabel: string;
  joinLink: string | null;
};

export function OverviewTab({
  teacherName,
  activeStudentsCount,
  averageRating,
  reviewsCount,
  pendingSubmissionsCount,
  upcomingClassesCount,
  nextLiveClass,
}: {
  teacherName: string;
  activeStudentsCount: number;
  averageRating: string | null;
  reviewsCount: number;
  pendingSubmissionsCount: number;
  upcomingClassesCount: number;
  nextLiveClass: NextLiveClass | null;
}) {
  const t = useTranslations("teacherDashboard.overview");
  const { startCall } = useLiveCall();
  const router = useRouter();

  function handleStartNextClass() {
    if (!nextLiveClass?.joinLink) return;
    startCall({
      liveClassId: nextLiveClass.id,
      title: nextLiveClass.title,
      subtitle: nextLiveClass.scheduledLabel,
      roomUrl: nextLiveClass.joinLink,
      displayName: teacherName,
      isHost: true,
    });
    notifyLiveClassStarted(nextLiveClass.id);
    // The call itself keeps running (LiveCallProvider lives above the tab
    // switch), but the attendance roster to mark it from only exists in the
    // Live Classes tab -- jump there so starting a class doesn't strand the
    // teacher on Home with no way to mark attendance.
    router.push({ pathname: "/teacher", query: { tab: "live" } });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">{t("greeting", { name: teacherName.split(" ")[0] })}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Link href={{ pathname: "/teacher", query: { tab: "students" } }}>
          <StatCard label={t("stats.activeStudents")} value={activeStudentsCount} />
        </Link>
        <Link href={{ pathname: "/teacher", query: { tab: "live" } }}>
          <StatCard label={t("stats.upcomingClasses")} value={upcomingClassesCount} />
        </Link>
        {/* No payments/transactions table exists yet — earnings can't be computed from real data, so this one isn't a link to anything. */}
        <StatCard label={t("stats.earnings")} value={t("stats.earningsUnavailable")} />
        <Link href={{ pathname: "/teacher", query: { tab: "reviews" } }}>
          <StatCard
            label={t("stats.rating")}
            value={averageRating ?? "—"}
            delta={reviewsCount > 0 ? t("stats.ratingDelta", { count: reviewsCount }) : undefined}
          />
        </Link>
        <Link href={{ pathname: "/teacher", query: { tab: "exams" } }}>
          <StatCard label={t("stats.submissions")} value={pendingSubmissionsCount} />
        </Link>
      </div>

      <div>
        <h3 className="mb-4 text-lg">{t("quickActionsHeading")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className={cardClass}>
            <div className="mb-1 font-semibold text-foreground">
              {nextLiveClass ? nextLiveClass.title : t("actions.classHeadingEmpty")}
            </div>
            <p className="mb-3.5 text-sm text-muted-foreground">
              {nextLiveClass ? nextLiveClass.scheduledLabel : t("actions.classBodyEmpty")}
            </p>
            <button
              type="button"
              className={linkButtonClass}
              disabled={!nextLiveClass?.joinLink}
              onClick={handleStartNextClass}
            >
              {t("actions.classAction")}
            </button>
          </div>

          <div className={cardClass}>
            <div className="mb-1 font-semibold text-foreground">
              {pendingSubmissionsCount > 0
                ? t("actions.gradingHeading", { count: pendingSubmissionsCount })
                : t("actions.gradingHeadingEmpty")}
            </div>
            <p className="mb-3.5 text-sm text-muted-foreground">{t("actions.gradingBody")}</p>
            <Link href={{ pathname: "/teacher", query: { tab: "exams" } }} className={linkButtonClass}>
              {t("actions.gradingAction")}
            </Link>
          </div>

          <div className={cardClass}>
            <div className="mb-1 font-semibold text-foreground">{t("actions.assignmentHeading")}</div>
            <p className="mb-3.5 text-sm text-muted-foreground">{t("actions.assignmentBody")}</p>
            <Link href={{ pathname: "/teacher", query: { tab: "assignments" } }} className={linkButtonClass}>
              {t("actions.assignmentAction")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
