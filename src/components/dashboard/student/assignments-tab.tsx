"use client";

import { useId, useMemo, useState } from "react";
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
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { submitAssignment } from "@/lib/dashboard/assignments-actions";
import { groupByClass } from "@/lib/dashboard/group-by-class";

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
  fileUrl: string;
  submission: {
    status: "pending" | "graded";
    grade: number | null;
    feedback: string | null;
    submittedLabel: string | null;
    photoUrls: string[];
  } | null;
};

export function AssignmentsTab({ assignments }: { assignments: StudentAssignmentRow[] }) {
  const t = useTranslations("studentDashboard.assignments");
  const tc = useTranslations("studentDashboard.common");
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [viewingWorksheetId, setViewingWorksheetId] = useState<string | null>(null);
  const [viewingResultId, setViewingResultId] = useState<string | null>(null);

  const dueAssignments = assignments.filter((a) => a.submission?.status !== "graded");
  const pastAssignments = assignments.filter((a) => a.submission?.status === "graded");
  const groupedDue = useMemo(
    () => groupByClass(dueAssignments.map((a) => ({ ...a, ownerName: a.teacherName }))),
    [dueAssignments],
  );

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
    return <AssignmentResultPanel assignment={viewingResult} onClose={() => setViewingResultId(null)} />;
  }

  const activeAssignment = activeAssignmentId
    ? (assignments.find((a) => a.id === activeAssignmentId) ?? null)
    : null;
  if (activeAssignment) {
    return (
      <SubmitWorkspace
        assignment={activeAssignment}
        onExit={() => setActiveAssignmentId(null)}
        onViewWorksheet={() => setViewingWorksheetId(activeAssignment.id)}
      />
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <h2 className="mb-1 text-lg font-semibold text-foreground">{t("dueTitle")}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{t("dueSubtitle")}</p>

      {dueAssignments.length === 0 ? (
        <div className="mb-8 rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
          {t("dueEmpty")}
        </div>
      ) : (
        <div className="mb-8 flex flex-col gap-5">
          {groupedDue.map((group) => (
            <div key={group.key}>
              <h3 className="mb-2 text-sm font-semibold text-foreground">{group.heading}</h3>
              <div className="flex flex-col gap-3">
                {group.rows.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onOpen={() => setActiveAssignmentId(assignment.id)}
                    onViewWorksheet={() => setViewingWorksheetId(assignment.id)}
                    onViewResult={() => setViewingResultId(assignment.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-foreground">{t("pastTitle")}</h2>
      <div className="rounded-lg border border-border bg-white">
        {pastAssignments.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">{t("pastEmpty")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tableAssignment")}</TableHead>
                <TableHead>{t("tableTeacher")}</TableHead>
                <TableHead>{t("tableGrade")}</TableHead>
                <TableHead>{t("tableFeedback")}</TableHead>
                <TableHead>{t("tableDate")}</TableHead>
                <TableHead>{t("tableResult")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pastAssignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium whitespace-normal text-foreground">{assignment.title}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{assignment.teacherName}</TableCell>
                  <TableCell className="text-muted-foreground">{assignment.submission?.grade ?? "—"}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">
                    {assignment.submission?.feedback ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">
                    {assignment.submission?.submittedLabel ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold text-primary hover:underline"
                      onClick={() => setViewingResultId(assignment.id)}
                    >
                      {t("viewResult")}
                    </Button>
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

function AssignmentCard({
  assignment,
  onOpen,
  onViewWorksheet,
  onViewResult,
}: {
  assignment: StudentAssignmentRow;
  onOpen: () => void;
  onViewWorksheet: () => void;
  onViewResult: () => void;
}) {
  const t = useTranslations("studentDashboard.assignments");

  return (
    <div className="rounded-lg border border-border bg-white p-4.5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-foreground">{assignment.title}</div>
        {assignment.submission?.status === "pending" && (
          <StatusBadge variant="pending">{t("pendingGrading")}</StatusBadge>
        )}
      </div>
      {(assignment.lessonTitle || assignment.dueLabel) && (
        <p className="mb-3.5 text-sm text-muted-foreground">
          {[assignment.lessonTitle, assignment.dueLabel ? t("dueLabel", { date: assignment.dueLabel }) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="ghost" size="sm" className="h-auto p-0 font-semibold text-primary hover:underline" onClick={onViewWorksheet}>
          {t("viewWorksheet")}
        </Button>
        {!assignment.submission && (
          <Button size="sm" onClick={onOpen}>
            {t("submitAnswer")}
          </Button>
        )}
        {assignment.submission?.status === "pending" && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-0 font-semibold text-primary hover:underline"
              onClick={onViewResult}
            >
              {t("viewSubmission")}
            </Button>
            <Button size="sm" variant="outline" onClick={onOpen}>
              {t("resubmit")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function PhotoDropzone({
  files,
  onAdd,
  onRemove,
}: {
  files: File[];
  onAdd: (files: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  const t = useTranslations("studentDashboard.assignments");
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
  onExit,
  onViewWorksheet,
}: {
  assignment: StudentAssignmentRow;
  onExit: () => void;
  onViewWorksheet: () => void;
}) {
  const t = useTranslations("studentDashboard.assignments");
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
        <PhotoDropzone files={photos} onAdd={handleAdd} onRemove={handleRemove} />
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

function AssignmentResultPanel({ assignment, onClose }: { assignment: StudentAssignmentRow; onClose: () => void }) {
  const t = useTranslations("studentDashboard.assignments");
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
