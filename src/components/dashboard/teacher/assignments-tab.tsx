"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/features/status-badge";
import { PdfViewerPanel, PhotoViewerPanel } from "@/components/dashboard/inline-file-viewer";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { createAssignment, deleteAssignment, gradeAssignmentSubmission } from "@/lib/dashboard/assignments-actions";

export type TeacherLessonOption = { id: string; title: string };
export type TeacherBatchOption = { id: string; title: string };

export type TeacherAssignmentRow = {
  id: string;
  title: string;
  batchId: string | null;
  batchTitle: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
  dueAtIso: string | null;
  dueLabel: string | null;
  fileUrl: string;
};

const ALL_BATCHES_FILTER = "all";
const ALL_LESSONS_FILTER = "all";
const PAGE_SIZE = 10;

export type AssignmentSubmissionRow = {
  id: string;
  assignmentId: string;
  studentName: string;
  submittedLabel: string | null;
  status: "pending" | "graded";
  grade: number | null;
  feedback: string | null;
  photoUrls: string[];
};

const NO_BATCH = "general";
const NO_LESSON = "none";

export function AssignmentsTab({
  assignments,
  submissions,
  batches,
  lessons,
}: {
  assignments: TeacherAssignmentRow[];
  submissions: AssignmentSubmissionRow[];
  batches: TeacherBatchOption[];
  lessons: TeacherLessonOption[];
}) {
  const t = useTranslations("teacherDashboard.assignments");
  const tc = useTranslations("teacherDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const fileInputId = useId();

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [batchId, setBatchId] = useState<string>(NO_BATCH);
  const [lessonId, setLessonId] = useState<string>(NO_LESSON);
  const [dueAt, setDueAt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [viewingWorksheetId, setViewingWorksheetId] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setBatchId(NO_BATCH);
    setLessonId(NO_LESSON);
    setDueAt("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCreate() {
    const file = fileInputRef.current?.files?.[0];
    if (!title.trim() || !file) {
      setError(t("form.missingFields"));
      return;
    }
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("ownerType", "teacher");
    formData.set("title", title.trim());
    if (batchId !== NO_BATCH) formData.set("batchId", batchId);
    if (lessonId !== NO_LESSON) formData.set("lessonId", lessonId);
    // Converted here in the browser — see the note in
    // live-classes-actions.ts's createLiveClassSchema for why.
    if (dueAt) formData.set("dueAt", new Date(dueAt).toISOString());
    formData.set("file", file);

    const result = await createAssignment(formData);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    resetForm();
    setCreating(false);
    setCreated(true);
    setTimeout(() => setCreated(false), 2500);
    refresh();
  }

  async function handleDelete(assignmentId: string) {
    setDeletingId(assignmentId);
    const result = await deleteAssignment(assignmentId);
    setDeletingId(null);
    if (!result.error) {
      refresh();
    }
  }

  const selectedAssignment = assignments.find((a) => a.id === selectedAssignmentId) ?? null;
  const viewingWorksheet = assignments.find((a) => a.id === viewingWorksheetId) ?? null;
  const assignmentSubs = useMemo(
    () => submissions.filter((s) => s.assignmentId === selectedAssignmentId),
    [submissions, selectedAssignmentId],
  );
  const pendingCountByAssignment = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of submissions) {
      if (s.status === "pending") map.set(s.assignmentId, (map.get(s.assignmentId) ?? 0) + 1);
    }
    return map;
  }, [submissions]);
  const submissionCountByAssignment = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of submissions) map.set(s.assignmentId, (map.get(s.assignmentId) ?? 0) + 1);
    return map;
  }, [submissions]);

  const [filterQuery, setFilterQuery] = useState("");
  const [filterBatch, setFilterBatch] = useState(ALL_BATCHES_FILTER);
  const [filterLesson, setFilterLesson] = useState(ALL_LESSONS_FILTER);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtersActive =
    filterQuery.trim() !== "" || filterBatch !== ALL_BATCHES_FILTER || filterLesson !== ALL_LESSONS_FILTER;

  const filteredAssignments = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const list = assignments.filter((a) => {
      if (
        q &&
        !a.title.toLowerCase().includes(q) &&
        !(a.batchTitle ?? "").toLowerCase().includes(q) &&
        !(a.lessonTitle ?? "").toLowerCase().includes(q)
      )
        return false;
      if (filterBatch === NO_BATCH && a.batchId !== null) return false;
      if (filterBatch !== ALL_BATCHES_FILTER && filterBatch !== NO_BATCH && a.batchId !== filterBatch) return false;
      if (filterLesson === NO_LESSON && a.lessonId !== null) return false;
      if (filterLesson !== ALL_LESSONS_FILTER && filterLesson !== NO_LESSON && a.lessonId !== filterLesson)
        return false;
      return true;
    });
    // Assignments with no due date always trail, regardless of sort direction.
    return [...list].sort((a, b) => {
      const ta = a.dueAtIso ? new Date(a.dueAtIso).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.dueAtIso ? new Date(b.dueAtIso).getTime() : Number.POSITIVE_INFINITY;
      if (ta === tb) return 0;
      if (ta === Number.POSITIVE_INFINITY) return 1;
      if (tb === Number.POSITIVE_INFINITY) return -1;
      return sortDir === "asc" ? ta - tb : tb - ta;
    });
  }, [assignments, filterQuery, filterBatch, filterLesson, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedAssignments = filteredAssignments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function clearFilters() {
    setFilterQuery("");
    setFilterBatch(ALL_BATCHES_FILTER);
    setFilterLesson(ALL_LESSONS_FILTER);
    setPage(1);
  }

  if (viewingWorksheet) {
    return (
      <PdfViewerPanel
        title={viewingWorksheet.title}
        subtitle={viewingWorksheet.batchTitle ?? t("form.noBatch")}
        fileUrl={viewingWorksheet.fileUrl}
        closeLabel={tc("close")}
        onClose={() => setViewingWorksheetId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {created && <span className="text-sm font-medium text-success">{tc("added")}</span>}
          <Button type="button" onClick={() => setCreating((v) => !v)}>
            {t("uploadTute")}
          </Button>
        </div>
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
      />

      {creating && (
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="assignment-title">{t("form.titleLabel")}</Label>
              <Input
                id="assignment-title"
                placeholder={t("titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assignment-batch">{t("form.batchLabel")}</Label>
              <Select value={batchId} onValueChange={(value) => setBatchId(value ?? NO_BATCH)}>
                <SelectTrigger id="assignment-batch" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BATCH}>{t("form.noBatch")}</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assignment-lesson">{t("form.lessonLabel")}</Label>
              <Select value={lessonId} onValueChange={(value) => setLessonId(value ?? NO_LESSON)}>
                <SelectTrigger id="assignment-lesson" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LESSON}>{t("form.noLesson")}</SelectItem>
                  {lessons.map((lesson) => (
                    <SelectItem key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assignment-due">{t("form.dueLabel")}</Label>
              <Input id="assignment-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={fileInputId}>{t("form.fileLabel")}</Label>
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="text-sm text-foreground file:mr-3 file:rounded-sm file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-secondary-foreground"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button type="button" onClick={handleCreate} disabled={saving}>
              {tc("add")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                setCreating(false);
              }}
            >
              {tc("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5">
          <p className="py-6 text-center text-sm text-muted-foreground">{t("emptyState")}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-3.5">
            <div className="grid min-w-48 flex-1 gap-1.5">
              <Label htmlFor="assignment-filter-search">{t("filters.searchLabel")}</Label>
              <Input
                id="assignment-filter-search"
                placeholder={t("filters.searchPlaceholder")}
                value={filterQuery}
                onChange={(e) => {
                  setFilterQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="grid w-44 gap-1.5">
              <Label>{t("form.batchLabel")}</Label>
              <Select
                value={filterBatch}
                onValueChange={(v) => {
                  setFilterBatch(v ?? ALL_BATCHES_FILTER);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_BATCHES_FILTER}>{t("filters.allClasses")}</SelectItem>
                  <SelectItem value={NO_BATCH}>{t("form.noBatch")}</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-44 gap-1.5">
              <Label>{t("form.lessonLabel")}</Label>
              <Select
                value={filterLesson}
                onValueChange={(v) => {
                  setFilterLesson(v ?? ALL_LESSONS_FILTER);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_LESSONS_FILTER}>{t("filters.allLessons")}</SelectItem>
                  <SelectItem value={NO_LESSON}>{t("form.noLesson")}</SelectItem>
                  {lessons.map((lesson) => (
                    <SelectItem key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-44 gap-1.5">
              <Label>{t("filters.sortLabel")}</Label>
              <Select value={sortDir} onValueChange={(v) => setSortDir(v === "desc" ? "desc" : "asc")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">{t("filters.sortSoonest")}</SelectItem>
                  <SelectItem value="desc">{t("filters.sortLatest")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filtersActive && (
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                {t("filters.clearFilters")}
              </Button>
            )}
          </div>

          {filteredAssignments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("filters.noResults")}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.title")}</TableHead>
                    <TableHead>{t("columns.batch")}</TableHead>
                    <TableHead>{t("columns.lesson")}</TableHead>
                    <TableHead>{t("columns.due")}</TableHead>
                    <TableHead>{t("columns.worksheet")}</TableHead>
                    <TableHead>{t("columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedAssignments.map((assignment) => {
                    const total = submissionCountByAssignment.get(assignment.id) ?? 0;
                    const pending = pendingCountByAssignment.get(assignment.id) ?? 0;
                    return (
                      <TableRow key={assignment.id}>
                        <TableCell className="max-w-64 whitespace-normal font-medium text-foreground">
                          {assignment.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {assignment.batchTitle ?? t("form.noBatch")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {assignment.lessonTitle ?? t("form.noLesson")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{assignment.dueLabel ?? "—"}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 font-semibold text-primary hover:underline"
                            onClick={() => setViewingWorksheetId(assignment.id)}
                          >
                            {t("viewWorksheet")}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={total === 0}
                              onClick={() => setSelectedAssignmentId(assignment.id)}
                            >
                              {pending > 0 ? t("gradeWithCount", { count: pending }) : t("grade")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={deletingId === assignment.id}
                              onClick={() => handleDelete(assignment.id)}
                            >
                              {t("delete")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {t("pagination.showingCount", { shown: pagedAssignments.length, total: filteredAssignments.length })}
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {t("pagination.previous")}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t("pagination.pageInfo", { page: currentPage, totalPages })}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      {t("pagination.next")}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {selectedAssignment && (
        <GradingPanel
          assignment={selectedAssignment}
          submissions={assignmentSubs}
          onClose={() => setSelectedAssignmentId(null)}
        />
      )}
    </div>
  );
}

function GradingPanel({
  assignment,
  submissions,
  onClose,
}: {
  assignment: TeacherAssignmentRow;
  submissions: AssignmentSubmissionRow[];
  onClose: () => void;
}) {
  const t = useTranslations("teacherDashboard.assignments");
  const tc = useTranslations("teacherDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg">{t("grading.heading", { title: assignment.title })}</h3>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {tc("close")}
        </Button>
      </div>
      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
        className="mb-3"
      />
      <div className="flex flex-col gap-4">
        {submissions.length === 0 && <p className="text-sm text-muted-foreground">{t("grading.noSubmissions")}</p>}
        {submissions.map((submission) => (
          <SubmissionCard key={submission.id} submission={submission} onGraded={() => refresh()} />
        ))}
      </div>
    </div>
  );
}

function SubmissionCard({
  submission,
  onGraded,
}: {
  submission: AssignmentSubmissionRow;
  onGraded: () => void;
}) {
  const t = useTranslations("teacherDashboard.assignments");
  const tc = useTranslations("teacherDashboard.common");

  const [editing, setEditing] = useState(submission.status === "pending");
  const [gradeDraft, setGradeDraft] = useState(String(submission.grade ?? ""));
  const [feedbackDraft, setFeedbackDraft] = useState(submission.feedback ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingFiles, setViewingFiles] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await gradeAssignmentSubmission({
      submissionId: submission.id,
      grade: gradeDraft,
      feedback: feedbackDraft,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    onGraded();
  }

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium text-foreground">{submission.studentName}</div>
          {submission.submittedLabel && <div className="text-xs text-muted-foreground">{submission.submittedLabel}</div>}
        </div>
        {submission.status === "graded" && !editing && (
          <StatusBadge variant="graded">{t("grading.graded")}</StatusBadge>
        )}
        {submission.status === "pending" && <StatusBadge variant="pending">{t("grading.awaitingGrading")}</StatusBadge>}
      </div>

      <div className="mb-3">
        <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {t("grading.filesHeading")}
        </div>
        {submission.photoUrls.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("grading.noFiles")}</p>
        ) : viewingFiles ? (
          <PhotoViewerPanel
            title={t("grading.filesHeading")}
            photoUrls={submission.photoUrls}
            closeLabel={tc("close")}
            onClose={() => setViewingFiles(false)}
          />
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setViewingFiles(true)}>
            {t("grading.viewFilesCount", { count: submission.photoUrls.length })}
          </Button>
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        {editing ? (
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start">
            <div className="grid w-full gap-1.5 sm:w-32">
              <Label htmlFor={`grade-${submission.id}`}>{t("grading.scoreLabel")}</Label>
              <Input
                id={`grade-${submission.id}`}
                type="number"
                min="0"
                value={gradeDraft}
                onChange={(e) => setGradeDraft(e.target.value)}
              />
            </div>
            <div className="grid w-full flex-1 gap-1.5">
              <Label htmlFor={`feedback-${submission.id}`}>{t("grading.feedbackLabel")}</Label>
              <Textarea
                id={`feedback-${submission.id}`}
                placeholder={t("grading.feedbackPlaceholder")}
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
              />
            </div>
            <Button type="button" size="sm" className="sm:mt-6" onClick={handleSave} disabled={saving}>
              {t("grading.saveGrade")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-foreground">{t("grading.totalScore", { score: submission.grade ?? 0 })}</div>
            {submission.feedback && <p className="max-w-96 text-sm text-muted-foreground">{submission.feedback}</p>}
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
              {t("grading.editGrade")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
