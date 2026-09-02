"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { requestToJoin, joinOpenBatch } from "@/lib/dashboard/batches-actions";
import { LiveClassesTab, type StudentLiveClassRow } from "@/components/dashboard/student/live-classes-tab";
import { ExamsTab, type StudentExamRow } from "@/components/dashboard/student/exams-tab";
import { AssignmentsTab, type StudentAssignmentRow } from "@/components/dashboard/student/assignments-tab";
import { NotesTab, type StudentNoteRow } from "@/components/dashboard/student/notes-tab";

export type MyClassRow = {
  enrollmentId: string;
  ownerId: string;
  batchId: string | null;
  batchTitle: string | null;
  ownerName: string;
  ownerType: "teacher" | "class";
  mode: "online" | "physical" | null;
  scheduleNote: string | null;
  status: "pending" | "accepted" | "declined";
  /** Swaps this row's "Teacher"/"Class" badge and any join-flow wording to campus terminology (0076) — a mixed list can have both, so this is per-row, not page-level. */
  isCampusLecturer: boolean;
};

export type AvailableBatchRow = {
  id: string;
  title: string;
  ownerName: string;
  mode: "online" | "physical";
  location: string | null;
  scheduleNote: string | null;
  isCampusLecturer: boolean;
  courseCode: string | null;
  /** Open-enrollment (0106) — joins instantly via joinOpenBatch instead of
   * requestToJoin's pending request. */
  isOpenEnrollment: boolean;
};

/** Same row shape a content row needs to be matched against one specific
 * enrolled class — every content type (notes/exams/assignments/live) already
 * carries these three fields. */
type Owned = { ownerId: string; ownerType: "teacher" | "class"; batchId: string | null };

function belongsToClass(row: Owned, target: MyClassRow) {
  return (
    row.ownerId === target.ownerId &&
    row.ownerType === target.ownerType &&
    (row.batchId === null || row.batchId === target.batchId)
  );
}

export function ClassesTab({
  myClasses,
  availableBatches,
  notes,
  exams,
  assignments,
  liveClasses,
  reminderClassIds,
  studentName,
}: {
  myClasses: MyClassRow[];
  availableBatches: AvailableBatchRow[];
  notes: StudentNoteRow[];
  exams: StudentExamRow[];
  assignments: StudentAssignmentRow[];
  liveClasses: StudentLiveClassRow[];
  reminderClassIds: string[];
  studentName: string;
}) {
  const t = useTranslations("studentDashboard.classes");
  const tc = useTranslations("studentDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openClassId, setOpenClassId] = useState<string | null>(null);

  async function handleJoin(batchId: string, isOpenEnrollment: boolean) {
    setJoiningId(batchId);
    setError(null);
    const result = isOpenEnrollment ? await joinOpenBatch(batchId) : await requestToJoin(batchId);
    setJoiningId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    refresh();
  }

  const acceptedClasses = myClasses.filter((item) => item.status === "accepted");
  const pendingClasses = myClasses.filter((item) => item.status === "pending");
  const openClass = openClassId ? (acceptedClasses.find((c) => c.enrollmentId === openClassId) ?? null) : null;

  if (openClass) {
    return (
      <ClassWorkspace
        classRow={openClass}
        notes={notes}
        exams={exams}
        assignments={assignments}
        liveClasses={liveClasses}
        reminderClassIds={reminderClassIds}
        studentName={studentName}
        onBack={() => setOpenClassId(null)}
      />
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
        className="mb-5"
      />

      {pendingClasses.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">{t("pendingTitle")}</h2>
          <div className="flex flex-col gap-4">
            {pendingClasses.map((item) => (
              <div
                key={item.enrollmentId}
                className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{item.ownerName}</span>
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      {item.isCampusLecturer
                        ? t("typeCampusLecturer")
                        : item.ownerType === "teacher"
                          ? t("typeTeacher")
                          : t("typeClass")}
                    </span>
                  </div>
                  {item.batchTitle && <div className="text-sm text-muted-foreground">{item.batchTitle}</div>}
                </div>
                <span className="text-sm font-medium text-muted-foreground">{t("pendingStatus")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {acceptedClasses.length === 0 ? (
        <div className="mb-8 rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
          {t("emptyState")}
        </div>
      ) : (
        <div className="mb-8 flex flex-col gap-4">
          {acceptedClasses.map((item) => (
            <div
              key={item.enrollmentId}
              className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{item.ownerName}</span>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {item.ownerType === "teacher" ? t("typeTeacher") : t("typeClass")}
                  </span>
                </div>
                {item.batchTitle && <div className="text-sm text-muted-foreground">{item.batchTitle}</div>}
                {item.scheduleNote && <div className="mt-1 text-xs text-muted-foreground">{item.scheduleNote}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <Link
                  href={`/${item.ownerType === "teacher" ? "teacher" : "class"}/${item.ownerId}`}
                  className="text-sm font-medium text-muted-foreground hover:underline"
                >
                  {t("viewProfile")}
                </Link>
                <Button size="sm" onClick={() => setOpenClassId(item.enrollmentId)}>
                  {t("openClass")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-foreground">{t("browseTitle")}</h2>
      {error && <p className="mb-3 text-sm font-medium text-destructive">{error}</p>}
      {availableBatches.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
          {t("browseEmpty")}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {availableBatches.map((batch) => (
            <div
              key={batch.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="mb-0.5 flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-foreground">
                    {batch.courseCode && <span className="text-muted-foreground">{batch.courseCode} · </span>}
                    {batch.title}
                  </div>
                  {batch.isOpenEnrollment && (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                      {t("openEnrollmentBadge")}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{batch.ownerName}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {batch.mode === "online" ? t("modeOnline") : t("modePhysical")}
                  {batch.location ? ` · ${batch.location}` : ""}
                  {batch.scheduleNote ? ` · ${batch.scheduleNote}` : ""}
                </div>
              </div>
              <Button
                size="sm"
                disabled={joiningId === batch.id}
                onClick={() => handleJoin(batch.id, batch.isOpenEnrollment)}
                className="shrink-0"
              >
                {batch.isOpenEnrollment ? t("joinNow") : batch.isCampusLecturer ? t("requestToEnroll") : t("requestToJoin")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "Layer 2" — everything about one specific class in one place (notes, exams,
 * assignments, live sessions), reusing the exact same tab components the flat
 * "Layer 1" views render, just pre-filtered to this one owner+batch instead of
 * every class at once. See the Student Class Workspace analysis this was
 * built from. Content types carrying no batchId of their own (an owner-wide
 * note, say) still show here — belongsToClass treats an unscoped row as
 * visible from any of that owner's classes, matching how the flat tabs
 * already treat batch-less content.
 */
function ClassWorkspace({
  classRow,
  notes,
  exams,
  assignments,
  liveClasses,
  reminderClassIds,
  studentName,
  onBack,
}: {
  classRow: MyClassRow;
  notes: StudentNoteRow[];
  exams: StudentExamRow[];
  assignments: StudentAssignmentRow[];
  liveClasses: StudentLiveClassRow[];
  reminderClassIds: string[];
  studentName: string;
  onBack: () => void;
}) {
  const t = useTranslations("studentDashboard.classes");

  const classLiveClasses = useMemo(
    () => liveClasses.filter((row) => belongsToClass(row, classRow)),
    [liveClasses, classRow],
  );
  const classExams = useMemo(() => exams.filter((row) => belongsToClass(row, classRow)), [exams, classRow]);
  const classAssignments = useMemo(
    () => assignments.filter((row) => belongsToClass(row, classRow)),
    [assignments, classRow],
  );
  const classNotes = useMemo(() => notes.filter((row) => belongsToClass(row, classRow)), [notes, classRow]);

  return (
    <div>
      <Button type="button" variant="ghost" size="sm" className="mb-4 h-auto p-0 font-medium text-primary hover:underline" onClick={onBack}>
        <ArrowLeft className="size-3.5" />
        {t("backToClasses")}
      </Button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white p-4.5">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-foreground">{classRow.ownerName}</span>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {classRow.isCampusLecturer
                ? t("typeCampusLecturer")
                : classRow.ownerType === "teacher"
                  ? t("typeTeacher")
                  : t("typeClass")}
            </span>
          </div>
          {classRow.batchTitle && <div className="text-sm text-muted-foreground">{classRow.batchTitle}</div>}
          {classRow.scheduleNote && <div className="mt-1 text-xs text-muted-foreground">{classRow.scheduleNote}</div>}
        </div>
        <Link
          href={`/${classRow.ownerType === "teacher" ? "teacher" : "class"}/${classRow.ownerId}`}
          className="shrink-0 text-sm font-medium text-muted-foreground hover:underline"
        >
          {t("viewProfile")}
        </Link>
      </div>

      <div className="flex flex-col gap-8">
        <LiveClassesTab classes={classLiveClasses} studentName={studentName} reminderClassIds={reminderClassIds} />
        <div className="border-t border-dashed border-border pt-8">
          <ExamsTab exams={classExams} />
        </div>
        <div className="border-t border-dashed border-border pt-8">
          <AssignmentsTab assignments={classAssignments} />
        </div>
        <div className="border-t border-dashed border-border pt-8">
          <NotesTab notes={classNotes} studentName={studentName} />
        </div>
      </div>
    </div>
  );
}
