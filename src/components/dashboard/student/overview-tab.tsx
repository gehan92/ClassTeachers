"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StatCard } from "@/components/dashboard/stat-card";

// Device-local, not per-account -- a one-time UI hint doesn't need a server
// round trip (same pattern as the teacher dashboard's own tips card).
const TIPS_DISMISSED_KEY = "cp_student_dashboard_tips_dismissed";

function ActionCard({
  heading,
  body,
  actionLabel,
  tab,
}: {
  heading: string;
  body: string;
  actionLabel: string;
  tab: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4.5">
      <div className="mb-1 font-semibold text-foreground">{heading}</div>
      <p className="mb-3.5 text-sm text-muted-foreground">{body}</p>
      <Link
        href={{ pathname: "/student", query: { tab } }}
        className="inline-block rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-secondary"
      >
        {actionLabel}
      </Link>
    </div>
  );
}

// Joins up to two titles as a natural English list ("A", "A and B", "A, B
// and 1 more") — good enough for this card; the rest of the codebase
// doesn't localize list grammar elsewhere either.
function joinTitles(titles: string[], totalCount: number): string {
  const remaining = totalCount - titles.length;
  if (titles.length === 0) return "";
  if (titles.length === 1) return remaining > 0 ? `${titles[0]} and ${remaining} more` : titles[0];
  return remaining > 0 ? `${titles[0]}, ${titles[1]} and ${remaining} more` : `${titles[0]} and ${titles[1]}`;
}

export function OverviewTab({
  studentName,
  classesCount,
  nextLiveTitle,
  nextLiveTeacherName,
  nextLiveLabel,
  examsDueCount,
  dueExamTitles,
  notesCount,
  assignmentsDueCount,
  dueAssignmentTitles,
  unreadMessagesCount,
}: {
  studentName: string;
  classesCount: number;
  nextLiveTitle: string | null;
  nextLiveTeacherName: string | null;
  nextLiveLabel: string | null;
  examsDueCount: number;
  dueExamTitles: string[];
  notesCount: number;
  assignmentsDueCount: number;
  dueAssignmentTitles: string[];
  unreadMessagesCount: number;
}) {
  const t = useTranslations("studentDashboard.overview");

  const [showTips, setShowTips] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(TIPS_DISMISSED_KEY)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage, not derived render state
        setShowTips(true);
      }
    } catch {
      // Storage blocked (private mode, locked-down browser) -- just skip the one-time tip.
    }
  }, []);
  function handleDismissTips() {
    setShowTips(false);
    try {
      localStorage.setItem(TIPS_DISMISSED_KEY, "1");
    } catch {
      // Nothing to do if storage isn't available -- it'll just show again next visit.
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-1 text-2xl">{t("greeting", { name: studentName.split(" ")[0] })}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {showTips && (
        <div className="relative mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4.5 pr-11">
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
            <li>{t("tips.coursework")}</li>
            <li>{t("tips.progress")}</li>
            <li>{t("tips.messages")}</li>
            <li>{t("tips.promote")}</li>
          </ul>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label={t("statClasses")} value={classesCount} />
        <StatCard label={t("statNextLive")} value={nextLiveLabel ?? t("statNextLiveEmpty")} />
        <StatCard label={t("statExamsDue")} value={examsDueCount} />
        <StatCard label={t("statAssignmentsDue")} value={assignmentsDueCount} />
        <StatCard label={t("statNotes")} value={notesCount} />
        <StatCard label={t("statUnreadMessages")} value={unreadMessagesCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {nextLiveTitle && nextLiveLabel ? (
          <ActionCard
            heading={t("actionLiveTitle", { title: nextLiveTitle, time: nextLiveLabel })}
            body={t("actionLiveBody", { teacher: nextLiveTeacherName ?? "—" })}
            actionLabel={t("actionLiveCta")}
            tab="live"
          />
        ) : (
          <ActionCard
            heading={t("actionLiveEmptyTitle")}
            body={t("actionLiveEmptyBody")}
            actionLabel={t("actionLiveCta")}
            tab="live"
          />
        )}

        {assignmentsDueCount > 0 ? (
          <ActionCard
            heading={t("actionAssignmentsTitle", { count: assignmentsDueCount })}
            body={t("actionAssignmentsBody", { titles: joinTitles(dueAssignmentTitles, assignmentsDueCount) })}
            actionLabel={t("actionAssignmentsCta")}
            tab="assignments"
          />
        ) : (
          <ActionCard
            heading={t("actionAssignmentsEmptyTitle")}
            body={t("actionAssignmentsEmptyBody")}
            actionLabel={t("actionAssignmentsCta")}
            tab="assignments"
          />
        )}

        {examsDueCount > 0 ? (
          <ActionCard
            heading={t("actionExamsTitle", { count: examsDueCount })}
            body={t("actionExamsBody", { titles: joinTitles(dueExamTitles, examsDueCount) })}
            actionLabel={t("actionExamsCta")}
            tab="exams"
          />
        ) : (
          <ActionCard
            heading={t("actionExamsEmptyTitle")}
            body={t("actionExamsEmptyBody")}
            actionLabel={t("actionExamsCta")}
            tab="exams"
          />
        )}

        <ActionCard
          heading={t("actionCalendarTitle")}
          body={t("actionCalendarBody")}
          actionLabel={t("actionCalendarCta")}
          tab="calendar"
        />
      </div>
    </div>
  );
}
