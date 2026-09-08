"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { StatCard } from "@/components/dashboard/stat-card";
import { useLiveCall } from "@/components/dashboard/live-call-context";
import { notifyLiveClassStarted } from "@/lib/dashboard/live-classes-actions";
import { messageFor, type NotificationRow, type Translator } from "@/components/dashboard/notification-bell";

const cardClass = "rounded-lg border border-border bg-white p-4.5";
const linkButtonClass =
  "inline-flex w-fit items-center rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60";

// Device-local, not per-account — seeing the orientation card again on a
// browser/profile that already dismissed it is a bigger papercut than one
// teacher seeing it twice across two devices. No server round trip needed
// for a one-time UI hint like this.
const TIPS_DISMISSED_KEY = "cp_teacher_dashboard_tips_dismissed";

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
  notifications,
}: {
  teacherName: string;
  activeStudentsCount: number;
  averageRating: string | null;
  reviewsCount: number;
  pendingSubmissionsCount: number;
  upcomingClassesCount: number;
  nextLiveClass: NextLiveClass | null;
  /** Same rows the header bell shows (0105) — reused here as a plain
   * activity feed rather than queried again, newest first already. */
  notifications: NotificationRow[];
}) {
  const t = useTranslations("teacherDashboard.overview");
  const tn = useTranslations("notifications") as unknown as Translator;
  const locale = useLocale();
  const { startCall } = useLiveCall();
  const router = useRouter();
  const dateFormatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(TIPS_DISMISSED_KEY)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage, not derived render state
        setShowTips(true);
      }
    } catch {
      // Storage blocked (private mode, locked-down browser) — just skip the
      // one-time tip rather than fail the whole tab over it.
    }
  }, []);

  function handleDismissTips() {
    setShowTips(false);
    try {
      localStorage.setItem(TIPS_DISMISSED_KEY, "1");
    } catch {
      // Nothing to do if storage isn't available — it'll just show again next visit.
    }
  }

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

      {showTips && (
        <div className="relative rounded-lg border border-primary/20 bg-primary/5 p-4.5 pr-11">
          <button
            type="button"
            onClick={handleDismissTips}
            aria-label={t("tips.dismiss")}
            className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <h3 className="font-semibold text-foreground">{t("tips.heading")}</h3>
          </div>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li>{t("tips.classes")}</li>
            <li>{t("tips.content")}</li>
            <li>{t("tips.students")}</li>
            <li>{t("tips.ads")}</li>
            <li>{t("tips.institute")}</li>
          </ul>
        </div>
      )}

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
        <h3 className="mb-4 text-lg">{t("activityHeading")}</h3>
        <div className={cardClass}>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("activityEmpty")}</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {notifications.slice(0, 6).map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <p className="text-sm text-foreground">{messageFor(tn, n)}</p>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {dateFormatter.format(new Date(n.createdAt))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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
