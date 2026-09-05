"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/features/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PdfViewerPanel } from "@/components/dashboard/inline-file-viewer";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { usePagination } from "@/lib/hooks/use-pagination";
import { groupByClass } from "@/lib/dashboard/group-by-class";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { submitAssignment } from "@/lib/dashboard/assignments-actions";

export type StudentAssignmentRow = {
  id: string;
  title: string;
  teacherName: string;
  ownerId: string;
  ownerType: "teacher" | "class";
  batchId: string | null;
  batchTitle: string | null;
  lessonTitle: string | null;
  dueLabel: string | null;
  dueAtIso: string | null;
  fileUrl: string;
  submission: {
    status: "pending" | "graded";
    grade: number | null;
    feedback: string | null;
    submittedLabel: string | null;
    photoUrls: string[];
  } | null;
};

export function AssignmentsTab({
  assignments,
  hideHeading,
  scope = "workspace",
  tNamespace = "studentDashboard.assignments",
}: {
  assignments: StudentAssignmentRow[];
  hideHeading?: boolean;
  /** "workspace" (default) is the full submit/resubmit view, used inside one
   * opened class's Accordion. "history" is the flat, top-level sidebar tab —
   * records and marks only; uploading an answer only happens inside My
   * Classes, per Gehan's explicit split. */
  scope?: "workspace" | "history";
  /** Lets Homework reuse this exact component with its own heading/labels
   * instead of "Assignments" copy. */
  tNamespace?: string;
}) {
  const t = useTranslations(tNamespace);
  const tc = useTranslations("studentDashboard.common");
  const [now] = useState(() => Date.now());
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [viewingWorksheetId, setViewingWorksheetId] = useState<string | null>(null);
  const [viewingResultId, setViewingResultId] = useState<string | null>(null);
  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(assignments.length);
  const pagedAssignments = assignments.slice(offset, offset + pageSize);

  const viewingWorksheet = viewingWorksheetId
    ? (assignments.find((a) => a.id === viewingWorksheetId) ?? null)
    : null;
  if (viewingWorksheet) {
    return (
      <PdfViewerPanel
        title={viewingWorksheet.title}
        subtitle={viewingWorksheet.teacherName}
        fileUrl={viewingWorksheet.fileUrl}
        closeLabel={tc("close")}
        onClose={() => setViewingWorksheetId(null)}
      />
    );
  }

  const viewingResult = viewingResultId ? (assignments.find((a) => a.id === viewingResultId) ?? null) : null;
  if (viewingResult) {
    return (
      <AssignmentResultPanel assignment={viewingResult} tNamespace={tNamespace} onClose={() => setViewingResultId(null)} />
    );
  }

  const activeAssignment = activeAssignmentId
    ? (assignments.find((a) => a.id === activeAssignmentId) ?? null)
    : null;
  if (activeAssignment) {
    return (
      <SubmitWorkspace
        assignment={activeAssignment}
        tNamespace={tNamespace}
        onExit={() => setActiveAssignmentId(null)}
        onViewWorksheet={() => setViewingWorksheetId(activeAssignment.id)}
      />
    );
  }

  return (
    <div>
      {!hideHeading && (
        <div className="mb-5">
          <h1 className="mb-1 text-2xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white">
        {assignments.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t("empty")}</p>
        ) : scope === "history" ? (
          <div className="p-4">
            {(() => {
              const groups = groupByClass(
                pagedAssignments.map((assignment) => ({ ...assignment, ownerName: assignment.teacherName })),
              );
              return (
                <Accordion multiple defaultValue={groups.map((g) => g.key)}>
                  {groups.map((group) => (
                    <AccordionItem key={group.key} value={group.key}>
                      <AccordionTrigger className="text-sm font-semibold text-foreground">{group.heading}</AccordionTrigger>
                      <AccordionPanel>
                        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                          {group.rows.map((assignment) => (
                            <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-foreground">{assignment.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {assignment.dueLabel ? t("dueLabel", { date: assignment.dueLabel }) : "—"}
                                </div>
                              </div>
                              <AssignmentActions
                                assignment={assignment}
                                scope={scope}
                                now={now}
                                tNamespace={tNamespace}
                                onOpen={() => setActiveAssignmentId(assignment.id)}
                                onViewWorksheet={() => setViewingWorksheetId(assignment.id)}
                                onViewResult={() => setViewingResultId(assignment.id)}
                              />
                            </div>
                          ))}
                        </div>
                      </AccordionPanel>
                    </AccordionItem>
                  ))}
                </Accordion>
              );
            })()}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colAssignment")}</TableHead>
                <TableHead>{t("tableTeacher")}</TableHead>
                <TableHead>{t("colDue")}</TableHead>
                <TableHead>{t("colAction")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedAssignments.map((assignment) => (
                <AssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  scope={scope}
                  now={now}
                  tNamespace={tNamespace}
                  onOpen={() => setActiveAssignmentId(assignment.id)}
                  onViewWorksheet={() => setViewingWorksheetId(assignment.id)}
                  onViewResult={() => setViewingResultId(assignment.id)}
                />
              ))}
            </TableBody>
          </Table>
        )}
        {assignments.length > 0 && (
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            showingLabel={tc("pagination.showingCount", {
              shown: pagedAssignments.length,
              total: assignments.length,
            })}
            previousLabel={tc("pagination.previous")}
            nextLabel={tc("pagination.next")}
            pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
          />
        )}
      </div>
    </div>
  );
}

/**
 * One row per assignment, past and upcoming together with a status badge
 * telling them apart — same shape as LiveClassesTab's single table,
 * replacing the old split "Due now" (grouped-by-class cards) / "Past
 * results" table (Gehan flagged the split as clutter once he saw Live
 * Classes handle it as one list).
 */
function AssignmentRow({
  assignment,
  scope,
  now,
  tNamespace,
  onOpen,
  onViewWorksheet,
  onViewResult,
}: {
  assignment: StudentAssignmentRow;
  scope: "workspace" | "history";
  now: number;
  tNamespace: string;
  onOpen: () => void;
  onViewWorksheet: () => void;
  onViewResult: () => void;
}) {
  const t = useTranslations(tNamespace);

  return (
    <TableRow>
      <TableCell className="max-w-72 whitespace-normal font-medium text-foreground">
        {assignment.title}
        {(assignment.batchTitle || assignment.lessonTitle) && (
          <div className="text-xs font-normal text-muted-foreground">
            {[assignment.batchTitle, assignment.lessonTitle].filter(Boolean).join(" · ")}
          </div>
        )}
      </TableCell>
      <TableCell className="whitespace-normal text-muted-foreground">{assignment.teacherName}</TableCell>
      <TableCell className="whitespace-normal text-muted-foreground">
        {assignment.dueLabel ? t("dueLabel", { date: assignment.dueLabel }) : "—"}
      </TableCell>
      <TableCell>
        <AssignmentActions
          assignment={assignment}
          scope={scope}
          now={now}
          tNamespace={tNamespace}
          onOpen={onOpen}
          onViewWorksheet={onViewWorksheet}
          onViewResult={onViewResult}
        />
      </TableCell>
    </TableRow>
  );
}

/** The assignment row's action cell — worksheet/result links plus either the
 * submit flow (workspace scope) or a records-only status badge (history
 * scope) — shared between the flat table (AssignmentRow) and the grouped
 * Accordion rows (history scope). */
function AssignmentActions({
  assignment,
  scope,
  now,
  tNamespace,
  onOpen,
  onViewWorksheet,
  onViewResult,
}: {
  assignment: StudentAssignmentRow;
  scope: "workspace" | "history";
  now: number;
  tNamespace: string;
  onOpen: () => void;
  onViewWorksheet: () => void;
  onViewResult: () => void;
}) {
  const t = useTranslations(tNamespace);
  const isHistory = scope === "history";
  const isPastDue = assignment.dueAtIso !== null && new Date(assignment.dueAtIso).getTime() < now;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onViewWorksheet}>
        {t("viewWorksheet")}
      </Button>
      {assignment.submission?.status === "graded" ? (
        <>
          <StatusBadge variant="graded">{assignment.submission.grade ?? "—"}</StatusBadge>
          <Button type="button" variant="ghost" size="sm" onClick={onViewResult}>
            {t("viewResult")}
          </Button>
        </>
      ) : assignment.submission?.status === "pending" ? (
        <>
          <StatusBadge variant="pending">{t("pendingGrading")}</StatusBadge>
          <Button type="button" variant="ghost" size="sm" onClick={onViewResult}>
            {t("viewSubmission")}
          </Button>
          {!isHistory && (
            <Button size="sm" variant="outline" onClick={onOpen}>
              {t("resubmit")}
            </Button>
          )}
        </>
      ) : isHistory ? (
        isPastDue ? (
          <StatusBadge variant="flagged">{t("missed")}</StatusBadge>
        ) : (
          <StatusBadge variant="closed">{t("notSubmitted")}</StatusBadge>
        )
      ) : (
        <Button size="sm" onClick={onOpen}>
          {t("submitAnswer")}
        </Button>
      )}
    </div>
  );
}

function PhotoDropzone({
  files,
  tNamespace,
  onAdd,
  onRemove,
}: {
  files: File[];
  tNamespace: string;
  onAdd: (files: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  const t = useTranslations(tNamespace);
  const inputId = useId();

  return (
    <div>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-secondary/30 px-4 py-6 text-sm font-medium text-primary hover:bg-secondary/50"
      >
        <Camera className="size-4" />
        {t("addPhotos")}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          onAdd(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-sm border border-border bg-secondary/20 px-2.5 py-1.5 text-xs text-foreground/80"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SubmitWorkspace({
  assignment,
  tNamespace,
  onExit,
  onViewWorksheet,
}: {
  assignment: StudentAssignmentRow;
  tNamespace: string;
  onExit: () => void;
  onViewWorksheet: () => void;
}) {
  const t = useTranslations(tNamespace);
  const tc = useTranslations("studentDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleAdd(fileList: FileList | null) {
    if (!fileList) return;
    setPhotos((prev) => [...prev, ...Array.from(fileList)]);
  }

  function handleRemove(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (photos.length === 0) return;
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("assignmentId", assignment.id);
    for (const photo of photos) formData.append("photos", photo);
    const result = await submitAssignment(formData);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
    refresh();
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-160">
        <h1 className="mb-4 text-2xl">{assignment.title}</h1>
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-2 text-lg">{t("submittedTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("submittedPendingNote")}</p>
          <RefreshStatus
            pending={isRefreshing}
            stuck={refreshStuck}
            pendingLabel={tc("updatingList")}
            stuckLabel={tc("updateStuck")}
            reloadLabel={tc("reloadPage")}
            className="mt-3"
          />
          <Button className="mt-4" size="sm" variant="outline" onClick={onExit}>
            {t("backToAssignments")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-160">
      <div className="mb-4">
        <h1 className="mb-1 text-2xl">{assignment.title}</h1>
        {assignment.dueLabel && (
          <p className="text-sm text-muted-foreground">{t("dueLabel", { date: assignment.dueLabel })}</p>
        )}
      </div>

      <div className="mb-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-3 h-auto p-0 font-semibold text-primary hover:underline"
          onClick={onViewWorksheet}
        >
          {t("viewWorksheet")}
        </Button>
        <p className="mb-2 text-xs text-muted-foreground">{t("submitInstructions")}</p>
        <PhotoDropzone files={photos} tNamespace={tNamespace} onAdd={handleAdd} onRemove={handleRemove} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleSubmit} disabled={photos.length === 0 || saving}>
          {t("submitAnswer")}
        </Button>
        <Button variant="outline" onClick={onExit} disabled={saving}>
          {t("backToAssignments")}
        </Button>
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>
    </div>
  );
}

function AssignmentResultPanel({
  assignment,
  tNamespace,
  onClose,
}: {
  assignment: StudentAssignmentRow;
  tNamespace: string;
  onClose: () => void;
}) {
  const t = useTranslations(tNamespace);
  const tc = useTranslations("studentDashboard.common");
  const photoUrls = assignment.submission?.photoUrls ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{assignment.title}</div>
          <div className="text-xs text-muted-foreground">
            {assignment.teacherName}
            {assignment.batchTitle ? ` · ${assignment.batchTitle}` : ""}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>
          {tc("close")}
        </Button>
      </div>

      {assignment.submission?.status === "graded" && (
        <div className="mb-5 flex flex-wrap items-center gap-5 rounded-lg border border-border bg-white p-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("resultGradeHeading")}
            </div>
            <div className="text-lg font-semibold text-foreground">{assignment.submission.grade ?? "—"}</div>
          </div>
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {assignment.submission.feedback || t("resultNoFeedback")}
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t("resultWorksheetHeading")}</h3>
          <div className="h-[70vh] overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
            <iframe
              src={`${assignment.fileUrl}#toolbar=0&navpanes=0&view=FitH`}
              title={assignment.title}
              className="size-full"
            />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t("resultAnswerHeading")}</h3>
          {photoUrls.length === 0 ? (
            <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
              {t("resultNoAnswer")}
            </div>
          ) : (
            <div className="flex h-[70vh] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-white p-3">
              {photoUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a local/optimizable asset
                <img key={url} src={url} alt="" className="w-full rounded-md border border-border" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
