import { useTranslations } from "next-intl";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/features/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StudentExamRow } from "@/components/dashboard/student/exams-tab";
import type { StudentAssignmentRow } from "@/components/dashboard/student/assignments-tab";

export type ProgressAttendanceRow = {
  id: string;
  sessionTitle: string;
  teacherName: string;
  dateLabel: string;
  status: "present" | "absent" | "late";
};

const attendanceBadgeVariant = {
  present: "active",
  late: "pending",
  absent: "flagged",
} as const;

/**
 * A retrospective "how has this gone so far" view — attendance, exam
 * results, assignment grades all in one place — deliberately distinct from
 * Overview's "what's next" framing. Written generically enough to serve
 * whoever's actually reading the dashboard: the student themselves, or a
 * parent account (same `student` DB role, no separate persona flag — see
 * the signup role split) checking in on a child's progress.
 */
export function ProgressTab({
  attendance,
  attendanceRatePercent,
  exams,
  assignments,
}: {
  attendance: ProgressAttendanceRow[];
  attendanceRatePercent: number | null;
  exams: StudentExamRow[];
  assignments: StudentAssignmentRow[];
}) {
  const t = useTranslations("studentDashboard.progress");

  const gradedExams = exams.filter((e) => e.submission?.status === "graded");
  const gradedAssignments = assignments.filter((a) => a.submission?.status === "graded");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("statAttendance")}
          value={attendanceRatePercent === null ? "—" : `${attendanceRatePercent}%`}
        />
        <StatCard label={t("statSessions")} value={attendance.length} />
        <StatCard label={t("statExamsGraded")} value={`${gradedExams.length}/${exams.length}`} />
        <StatCard label={t("statAssignmentsGraded")} value={`${gradedAssignments.length}/${assignments.length}`} />
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("attendanceHeading")}</h3>
        {attendance.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("attendanceEmpty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tableSession")}</TableHead>
                <TableHead>{t("tableTeacher")}</TableHead>
                <TableHead>{t("tableDate")}</TableHead>
                <TableHead>{t("tableStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium whitespace-normal text-foreground">{row.sessionTitle}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{row.teacherName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.dateLabel}</TableCell>
                  <TableCell>
                    <StatusBadge variant={attendanceBadgeVariant[row.status]}>
                      {t(`attendanceStatus.${row.status}`)}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("examsHeading")}</h3>
        {exams.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("examsEmpty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tableExam")}</TableHead>
                <TableHead>{t("tableTeacher")}</TableHead>
                <TableHead>{t("tableGrade")}</TableHead>
                <TableHead>{t("tableStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium whitespace-normal text-foreground">{exam.title}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{exam.teacherName}</TableCell>
                  <TableCell className="text-muted-foreground">{exam.submission?.grade ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge variant={exam.submission?.status === "graded" ? "active" : "pending"}>
                      {exam.submission?.status === "graded" ? t("statusGraded") : t("statusPending")}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("assignmentsHeading")}</h3>
        {assignments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("assignmentsEmpty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tableAssignment")}</TableHead>
                <TableHead>{t("tableTeacher")}</TableHead>
                <TableHead>{t("tableGrade")}</TableHead>
                <TableHead>{t("tableStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium whitespace-normal text-foreground">{assignment.title}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{assignment.teacherName}</TableCell>
                  <TableCell className="text-muted-foreground">{assignment.submission?.grade ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge variant={assignment.submission?.status === "graded" ? "active" : "pending"}>
                      {assignment.submission?.status === "graded" ? t("statusGraded") : t("statusPending")}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
