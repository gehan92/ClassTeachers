import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StatCard } from "@/components/dashboard/stat-card";

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
}: {
  studentName: string;
  classesCount: number;
  nextLiveTitle: string | null;
  nextLiveTeacherName: string | null;
  nextLiveLabel: string | null;
  examsDueCount: number;
  dueExamTitles: string[];
  notesCount: number;
}) {
  const t = useTranslations("studentDashboard.overview");

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-1 text-2xl">{t("greeting", { name: studentName.split(" ")[0] })}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("statClasses")} value={classesCount} />
        <StatCard label={t("statNextLive")} value={nextLiveLabel ?? t("statNextLiveEmpty")} />
        <StatCard label={t("statExamsDue")} value={examsDueCount} />
        <StatCard label={t("statNotes")} value={notesCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

        {notesCount > 0 ? (
          <ActionCard
            heading={t("actionNotesTitle", { count: notesCount })}
            body={t("actionNotesBody")}
            actionLabel={t("actionNotesCta")}
            tab="notes"
          />
        ) : (
          <ActionCard
            heading={t("actionNotesEmptyTitle")}
            body={t("actionNotesEmptyBody")}
            actionLabel={t("actionNotesCta")}
            tab="notes"
          />
        )}
      </div>
    </div>
  );
}
