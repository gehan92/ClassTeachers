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

export function OverviewTab({
  studentName,
  classesCount,
  nextLiveLabel,
  examsDueCount,
  notesCount,
}: {
  studentName: string;
  classesCount: number;
  nextLiveLabel: string | null;
  examsDueCount: number;
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
        <ActionCard
          heading={t("actionLiveTitle")}
          body={t("actionLiveBody")}
          actionLabel={t("actionLiveCta")}
          tab="live"
        />
        <ActionCard
          heading={t("actionExamsTitle")}
          body={t("actionExamsBody")}
          actionLabel={t("actionExamsCta")}
          tab="exams"
        />
        <ActionCard
          heading={t("actionNotesTitle")}
          body={t("actionNotesBody")}
          actionLabel={t("actionNotesCta")}
          tab="notes"
        />
      </div>
    </div>
  );
}
