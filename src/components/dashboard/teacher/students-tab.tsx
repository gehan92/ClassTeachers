"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { avatarGradientClass } from "@/lib/avatar-color";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { usePagination } from "@/lib/hooks/use-pagination";
import { respondToJoinRequest } from "@/lib/dashboard/batches-actions";
import type { AnalyticsExamResultRow, AnalyticsAttendanceRow } from "@/components/dashboard/teacher/analytics-tab";

export type TeacherStudentRow = {
  id: string;
  name: string;
  batch: string;
  joinedAt: string;
  phone: string | null;
};

export type TeacherJoinRequestRow = {
  id: string;
  studentName: string;
  batch: string;
  requestedAt: string;
};

export function StudentsTab({
  students,
  requests: initialRequests,
  examResults,
  attendance,
}: {
  students: TeacherStudentRow[];
  requests: TeacherJoinRequestRow[];
  /** Already computed for the Analytics tab (analyticsExamResults) — reused
   * here rather than re-queried, filtered per-student when the profile
   * dialog opens. */
  examResults: AnalyticsExamResultRow[];
  attendance: AnalyticsAttendanceRow[];
}) {
  const t = useTranslations("teacherDashboard.students");
  const tc = useTranslations("teacherDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [query, setQuery] = useState("");
  const [viewingStudent, setViewingStudent] = useState<TeacherStudentRow | null>(null);
  // Read straight from the prop (filtered by a locally-handled set), not a
  // useState copy — see the identical fix + note in question-bank-tab.tsx.
  const [handledRequestIds, setHandledRequestIds] = useState<Set<string>>(new Set());
  const requests = initialRequests.filter((r) => !handledRequestIds.has(r.id));
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declineReasonByRequestId, setDeclineReasonByRequestId] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.batch.toLowerCase().includes(q),
    );
  }, [students, query]);

  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(filtered.length);
  const pagedStudents = filtered.slice(offset, offset + pageSize);

  async function handleRespond(id: string, accept: boolean) {
    setRespondingId(id);
    setError(null);
    const result = await respondToJoinRequest(id, accept, undefined, accept ? undefined : declineReasonByRequestId[id]);
    setRespondingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setHandledRequestIds((prev) => new Set(prev).add(id));
    // Accepting moves the student into the roster below, which reads
    // straight from the `students` prop — needs a refetch to show up.
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl">{t("heading")}</h1>
        <Input
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-64"
        />
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
      />

      {requests.length > 0 && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-3 text-lg">{t("requests.heading")}</h3>
          {error && <p className="mb-3 text-sm font-medium text-destructive">{error}</p>}
          <div className="flex flex-col divide-y divide-border">
            {requests.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-foreground">{request.studentName}</p>
                  <p className="text-sm text-muted-foreground">
                    {request.batch} · {request.requestedAt}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder={t("requests.declineReasonPlaceholder")}
                    value={declineReasonByRequestId[request.id] ?? ""}
                    onChange={(e) =>
                      setDeclineReasonByRequestId((prev) => ({ ...prev, [request.id]: e.target.value }))
                    }
                    className="h-8 w-44 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleRespond(request.id, true)}
                    disabled={respondingId === request.id}
                  >
                    {t("requests.accept")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRespond(request.id, false)}
                    disabled={respondingId === request.id}
                  >
                    {t("requests.decline")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.student")}</TableHead>
              <TableHead>{t("columns.batch")}</TableHead>
              <TableHead>{t("columns.joined")}</TableHead>
              <TableHead>{t("columns.contact")}</TableHead>
              <TableHead className="text-right">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedStudents.map((student) => (
              <TableRow key={student.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar size="sm">
                      <AvatarFallback className={avatarGradientClass(student.name)}>
                        {student.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{student.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{student.batch}</TableCell>
                <TableCell className="text-muted-foreground">{student.joinedAt}</TableCell>
                <TableCell className="text-muted-foreground">
                  {student.phone ? (
                    <a href={`tel:${student.phone}`} className="font-medium text-primary hover:underline">
                      {student.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => setViewingStudent(student)}
                  >
                    {t("columns.view")}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtered.length > 0 && (
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            showingLabel={tc("pagination.showingCount", { shown: pagedStudents.length, total: filtered.length })}
            previousLabel={tc("pagination.previous")}
            nextLabel={tc("pagination.next")}
            pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
          />
        )}
      </div>

      <Dialog open={viewingStudent !== null} onOpenChange={(open) => !open && setViewingStudent(null)}>
        <DialogContent className="max-w-md">
          {viewingStudent && (
            <>
              <DialogHeader>
                <DialogTitle>{viewingStudent.name}</DialogTitle>
                <DialogDescription>
                  {viewingStudent.batch} · {t("profileDialog.joined", { date: viewingStudent.joinedAt })}
                </DialogDescription>
              </DialogHeader>

              {viewingStudent.phone && (
                <a href={`tel:${viewingStudent.phone}`} className="text-sm font-medium text-primary hover:underline">
                  {viewingStudent.phone}
                </a>
              )}

              <div className="flex flex-col gap-4">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">{t("profileDialog.attendanceHeading")}</h4>
                  {(() => {
                    const rows = attendance.filter((a) => a.studentId === viewingStudent.id);
                    if (rows.length === 0) {
                      return <p className="text-sm text-muted-foreground">{t("profileDialog.attendanceEmpty")}</p>;
                    }
                    const present = rows.filter((r) => r.status === "present").length;
                    const late = rows.filter((r) => r.status === "late").length;
                    const absent = rows.filter((r) => r.status === "absent").length;
                    return (
                      <p className="text-sm text-muted-foreground">
                        {t("profileDialog.attendanceSummary", { present, late, absent })}
                      </p>
                    );
                  })()}
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">{t("profileDialog.gradesHeading")}</h4>
                  {(() => {
                    const rows = examResults.filter((r) => r.studentId === viewingStudent.id);
                    if (rows.length === 0) {
                      return <p className="text-sm text-muted-foreground">{t("profileDialog.gradesEmpty")}</p>;
                    }
                    return (
                      <div className="flex flex-col divide-y divide-border">
                        {rows.map((r) => (
                          <div key={r.examId} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                            <span className="text-foreground">{r.examTitle}</span>
                            <span className="font-mono text-muted-foreground">
                              {r.status === "graded" && r.scorePercent !== null
                                ? `${r.scorePercent}%`
                                : t("profileDialog.gradePending")}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
