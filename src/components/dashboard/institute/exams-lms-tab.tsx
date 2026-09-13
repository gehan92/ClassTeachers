import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ExamOversightRow = {
  id: string;
  title: string;
  batchTitle: string | null;
  dateLabel: string | null;
  submissionCount: number;
  gradedCount: number;
  avgScorePercent: number | null;
};

/**
 * Read-only rollup of exams teachers already create against this institute's
 * batches — institute staff review results here, they don't author exams
 * themselves (that stays a teacher-side responsibility, same as every other
 * institute batch's content).
 */
export function ExamsLmsTab({ exams }: { exams: ExamOversightRow[] }) {
  const t = useTranslations("instituteDashboard.examsLms");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="rounded-lg border border-border bg-white p-5">
        {exams.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.exam")}</TableHead>
                <TableHead>{t("table.batch")}</TableHead>
                <TableHead>{t("table.date")}</TableHead>
                <TableHead>{t("table.submissions")}</TableHead>
                <TableHead>{t("table.avgScore")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium text-foreground">{exam.title}</TableCell>
                  <TableCell className="text-muted-foreground">{exam.batchTitle ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{exam.dateLabel ?? "—"}</TableCell>
                  <TableCell>{t("table.submissionsValue", { graded: exam.gradedCount, total: exam.submissionCount })}</TableCell>
                  <TableCell>{exam.avgScorePercent === null ? "—" : `${exam.avgScorePercent}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
