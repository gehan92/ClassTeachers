"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/features/status-badge";
import { PhotoViewerPanel } from "@/components/dashboard/inline-file-viewer";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { TerminalBlock } from "@/components/dashboard/terminal-block";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { createExam, gradeSubmission, setExamPublished } from "@/lib/dashboard/exams-actions";
import type { QuestionBankItem } from "@/types/dashboard-exams";
import { cn } from "@/lib/utils";

export type TeacherExamBatchOption = { id: string; title: string; studentCount: number };
export type TeacherExamStudentOption = { id: string; name: string; batchId: string | null };

export type TeacherExamRow = {
  id: string;
  title: string;
  durationMinutes: number;
  scheduledAtIso: string | null;
  scheduledLabel: string;
  questionCount: number;
  questionIds: string[];
  batchTitle: string | null;
  published: boolean;
};

const PAGE_SIZE = 10;
const ALL_BATCHES_FILTER = "all";
const ALL_STATUS_FILTER = "all";
const ALL_DURATION_FILTER = "all";
const ALL_QUESTIONS_FILTER = "all";

const NO_BATCH = "all";

export type ExamSubmissionRow = {
  id: string;
  examId: string;
  studentName: string;
  submittedLabel: string | null;
  status: "pending" | "graded";
  grade: number | null;
  feedback: string | null;
  photoUrls: string[];
  /** Auto-computed at submit time (see submitExam) — set whenever the exam
   * has any MCQ questions, regardless of whether it also has essay ones. */
  mcqScore: number | null;
  mcqMaxScore: number | null;
  /** Code/Terminal questions — questionId -> the student's typed answer,
   * always manually graded like essay photos are. */
  codeAnswers: Record<string, string>;
};

export function ExamsTab({
  exams,
  submissions,
  questions,
  batches,
  totalStudentsCount,
  studentPool,
}: {
  exams: TeacherExamRow[];
  submissions: ExamSubmissionRow[];
  questions: QuestionBankItem[];
  batches: TeacherExamBatchOption[];
  totalStudentsCount: number;
  studentPool: TeacherExamStudentOption[];
}) {
  const t = useTranslations("teacherDashboard.exams");
  const tq = useTranslations("teacherDashboard.questionBank");
  const tc = useTranslations("teacherDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [batchId, setBatchId] = useState<string>(NO_BATCH);
  const [excludedStudentIds, setExcludedStudentIds] = useState<Set<string>>(new Set());
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [previewExamId, setPreviewExamId] = useState<string | null>(null);
  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null);

  const [filterQuery, setFilterQuery] = useState("");
  const [filterBatch, setFilterBatch] = useState(ALL_BATCHES_FILTER);
  const [filterDuration, setFilterDuration] = useState(ALL_DURATION_FILTER);
  const [filterStatus, setFilterStatus] = useState(ALL_STATUS_FILTER);
  const [filterQuestions, setFilterQuestions] = useState(ALL_QUESTIONS_FILTER);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [page, setPage] = useState(1);

  const poolForBatch = studentPool.filter((s) => batchId === NO_BATCH || s.batchId === batchId);

  const filtersActive =
    filterQuery.trim() !== "" ||
    filterBatch !== ALL_BATCHES_FILTER ||
    filterDuration !== ALL_DURATION_FILTER ||
    filterStatus !== ALL_STATUS_FILTER ||
    filterQuestions !== ALL_QUESTIONS_FILTER ||
    filterDateFrom !== "" ||
    filterDateTo !== "";

  const distinctBatchTitles = useMemo(() => {
    const set = new Set<string>();
    for (const e of exams) if (e.batchTitle) set.add(e.batchTitle);
    return Array.from(set).sort();
  }, [exams]);
  const hasUnscopedExam = exams.some((e) => e.batchTitle === null);

  const filteredExams = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const fromDate = filterDateFrom ? new Date(`${filterDateFrom}T00:00:00`) : null;
    const toDate = filterDateTo ? new Date(`${filterDateTo}T23:59:59`) : null;
    return exams.filter((e) => {
      if (q && !e.title.toLowerCase().includes(q) && !(e.batchTitle ?? "").toLowerCase().includes(q)) return false;
      if (filterBatch === "unscoped" && e.batchTitle !== null) return false;
      if (filterBatch !== ALL_BATCHES_FILTER && filterBatch !== "unscoped" && e.batchTitle !== filterBatch) return false;
      if (filterDuration === "under30" && e.durationMinutes >= 30) return false;
      if (filterDuration === "30to60" && (e.durationMinutes < 30 || e.durationMinutes > 60)) return false;
      if (filterDuration === "over60" && e.durationMinutes <= 60) return false;
      if (filterStatus === "published" && !e.published) return false;
      if (filterStatus === "draft" && e.published) return false;
      if (filterQuestions === "1to5" && (e.questionCount < 1 || e.questionCount > 5)) return false;
      if (filterQuestions === "6to10" && (e.questionCount < 6 || e.questionCount > 10)) return false;
      if (filterQuestions === "11plus" && e.questionCount <= 10) return false;
      if (fromDate && (!e.scheduledAtIso || new Date(e.scheduledAtIso) < fromDate)) return false;
      if (toDate && (!e.scheduledAtIso || new Date(e.scheduledAtIso) > toDate)) return false;
      return true;
    });
  }, [exams, filterQuery, filterBatch, filterDuration, filterStatus, filterQuestions, filterDateFrom, filterDateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredExams.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedExams = filteredExams.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function clearFilters() {
    setFilterQuery("");
    setFilterBatch(ALL_BATCHES_FILTER);
    setFilterDuration(ALL_DURATION_FILTER);
    setFilterStatus(ALL_STATUS_FILTER);
    setFilterQuestions(ALL_QUESTIONS_FILTER);
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(1);
  }

  async function handleTogglePublished(examId: string, next: boolean) {
    setTogglingPublishId(examId);
    const result = await setExamPublished(examId, next);
    setTogglingPublishId(null);
    if (!result.error) refresh();
  }

  function setQuestionChecked(id: string, checked: boolean) {
    setSelectedQuestionIds((ids) => (checked ? [...ids, id] : ids.filter((x) => x !== id)));
  }

  function handleBatchChange(value: string | null) {
    setBatchId(value ?? NO_BATCH);
    // Different pool of students — a leftover exclusion set from the
    // previous batch wouldn't map to the right people here.
    setExcludedStudentIds(new Set());
  }

  function toggleStudent(studentId: string) {
    setExcludedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function resetForm() {
    setTitle("");
    setDuration("60");
    setScheduledAt("");
    setSelectedQuestionIds([]);
    setBatchId(NO_BATCH);
    setExcludedStudentIds(new Set());
  }

  async function handleCreate() {
    if (!title.trim() || selectedQuestionIds.length === 0 || !scheduledAt) return;
    setSaving(true);
    setError(null);
    // Nothing excluded = every current member of the pool gets in — see the
    // comment on exam_participants (0060) for why "everyone" stays unsent.
    const participantStudentIds =
      excludedStudentIds.size > 0
        ? poolForBatch.filter((s) => !excludedStudentIds.has(s.id)).map((s) => s.id)
        : undefined;
    const result = await createExam({
      ownerType: "teacher",
      title,
      questionIds: selectedQuestionIds,
      durationMinutes: duration,
      // Converted here in the browser — see the note in
      // live-classes-actions.ts's createLiveClassSchema for why.
      scheduledAt: new Date(scheduledAt).toISOString(),
      batchId: batchId !== NO_BATCH ? batchId : undefined,
      participantStudentIds,
    });
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

  function handleCancelCreate() {
    resetForm();
    setCreating(false);
  }

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null;
  const previewExam = exams.find((e) => e.id === previewExamId) ?? null;
  const examSubs = useMemo(
    () => submissions.filter((s) => s.examId === selectedExamId),
    [submissions, selectedExamId],
  );
  const pendingCountByExam = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of submissions) {
      if (s.status === "pending") map.set(s.examId, (map.get(s.examId) ?? 0) + 1);
    }
    return map;
  }, [submissions]);
  const submissionCountByExam = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of submissions) map.set(s.examId, (map.get(s.examId) ?? 0) + 1);
    return map;
  }, [submissions]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {created && <span className="text-sm font-medium text-success">{tc("added")}</span>}
          <Button type="button" onClick={() => setCreating((v) => !v)}>
            {t("createExam")}
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
          <h3 className="mb-4 text-lg">{t("form.title")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="exam-title">{t("form.titleLabel")}</Label>
              <Input
                id="exam-title"
                placeholder={t("form.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exam-duration">{t("form.durationLabel")}</Label>
              <Input
                id="exam-duration"
                type="number"
                min="1"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exam-date">{t("form.dateLabel")}</Label>
              <Input
                id="exam-date"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>{t("form.batchLabel")}</Label>
              <Select value={batchId} onValueChange={handleBatchChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BATCH}>
                    {t("form.allStudentsOption")} ({totalStudentsCount})
                  </SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.title} ({batch.studentCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {poolForBatch.length > 0 && (
              <div className="rounded-md border border-border p-3 sm:col-span-2">
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={excludedStudentIds.size === 0}
                    onChange={(e) => setExcludedStudentIds(e.target.checked ? new Set() : new Set(poolForBatch.map((s) => s.id)))}
                  />
                  {t("form.selectAll")}
                </label>
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {poolForBatch.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={!excludedStudentIds.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <Label>{t("form.questionsLabel")}</Label>
            {questions.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted-foreground">{t("form.noQuestionsForBatch")}</p>
            ) : (
              <div className="mt-1.5 flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-md border border-border p-3">
                {questions.map((q) => (
                  <label key={q.id} className="flex items-start gap-2.5 text-sm">
                    <Checkbox
                      className="mt-0.5"
                      checked={selectedQuestionIds.includes(q.id)}
                      onCheckedChange={(checked) => setQuestionChecked(q.id, checked === true)}
                    />
                    <span>
                      {q.text}{" "}
                      <span className="text-muted-foreground">
                        ({tq(`typeLabel.${q.type}`)} · {t("form.questionMarks", { marks: q.marks })})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleCreate} disabled={saving}>
              {tc("add")}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancelCreate} disabled={saving}>
              {tc("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("examsHeading")}</h3>
        {exams.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("grading.noSubmissions")}</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-3.5">
              <div className="grid min-w-48 flex-1 gap-1.5">
                <Label htmlFor="exam-filter-search">{t("filters.searchLabel")}</Label>
                <Input
                  id="exam-filter-search"
                  placeholder={t("filters.searchPlaceholder")}
                  value={filterQuery}
                  onChange={(e) => {
                    setFilterQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="grid w-44 gap-1.5">
                <Label>{t("filters.batchLabel")}</Label>
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
                    <SelectItem value={ALL_BATCHES_FILTER}>{t("filters.allBatches")}</SelectItem>
                    {hasUnscopedExam && (
                      <SelectItem value="unscoped">{t("form.allStudentsOption")}</SelectItem>
                    )}
                    {distinctBatchTitles.map((title) => (
                      <SelectItem key={title} value={title}>
                        {title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid w-40 gap-1.5">
                <Label>{t("filters.durationLabel")}</Label>
                <Select
                  value={filterDuration}
                  onValueChange={(v) => {
                    setFilterDuration(v ?? ALL_DURATION_FILTER);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_DURATION_FILTER}>{t("filters.durationAny")}</SelectItem>
                    <SelectItem value="under30">{t("filters.durationUnder30")}</SelectItem>
                    <SelectItem value="30to60">{t("filters.duration30to60")}</SelectItem>
                    <SelectItem value="over60">{t("filters.durationOver60")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid w-36 gap-1.5">
                <Label>{t("filters.questionsLabel")}</Label>
                <Select
                  value={filterQuestions}
                  onValueChange={(v) => {
                    setFilterQuestions(v ?? ALL_QUESTIONS_FILTER);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_QUESTIONS_FILTER}>{t("filters.questionsAny")}</SelectItem>
                    <SelectItem value="1to5">{t("filters.questions1to5")}</SelectItem>
                    <SelectItem value="6to10">{t("filters.questions6to10")}</SelectItem>
                    <SelectItem value="11plus">{t("filters.questions11plus")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid w-36 gap-1.5">
                <Label>{t("filters.statusLabel")}</Label>
                <Select
                  value={filterStatus}
                  onValueChange={(v) => {
                    setFilterStatus(v ?? ALL_STATUS_FILTER);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STATUS_FILTER}>{t("filters.statusAny")}</SelectItem>
                    <SelectItem value="published">{t("published")}</SelectItem>
                    <SelectItem value="draft">{t("draft")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid w-36 gap-1.5">
                <Label htmlFor="exam-filter-from">{t("filters.dateFromLabel")}</Label>
                <Input
                  id="exam-filter-from"
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => {
                    setFilterDateFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="grid w-36 gap-1.5">
                <Label htmlFor="exam-filter-to">{t("filters.dateToLabel")}</Label>
                <Input
                  id="exam-filter-to"
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => {
                    setFilterDateTo(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              {filtersActive && (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  {t("filters.clearFilters")}
                </Button>
              )}
            </div>

            {filteredExams.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("filters.noResults")}</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("columns.exam")}</TableHead>
                      <TableHead>{t("columns.batch")}</TableHead>
                      <TableHead>{t("columns.duration")}</TableHead>
                      <TableHead>{t("columns.date")}</TableHead>
                      <TableHead>{t("columns.questions")}</TableHead>
                      <TableHead>{t("columns.status")}</TableHead>
                      <TableHead>{t("columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedExams.map((exam) => {
                      const total = submissionCountByExam.get(exam.id) ?? 0;
                      const pending = pendingCountByExam.get(exam.id) ?? 0;
                      return (
                        <TableRow key={exam.id}>
                          <TableCell className="max-w-64 whitespace-normal font-medium text-foreground">
                            {exam.title}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {exam.batchTitle ?? t("form.allStudentsOption")}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {t("minutes", { count: exam.durationMinutes })}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{exam.scheduledLabel}</TableCell>
                          <TableCell className="text-muted-foreground">{exam.questionCount}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={exam.published}
                                disabled={togglingPublishId === exam.id}
                                onCheckedChange={(checked) => handleTogglePublished(exam.id, checked)}
                              />
                              <StatusBadge variant={exam.published ? "active" : "pending"}>
                                {exam.published ? t("published") : t("draft")}
                              </StatusBadge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewExamId(exam.id)}>
                                {t("previewAction")}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={total === 0}
                                onClick={() => setSelectedExamId(exam.id)}
                              >
                                {pending > 0 ? t("gradeWithCount", { count: pending }) : t("grade")}
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
                    {t("pagination.showingCount", {
                      shown: pagedExams.length,
                      total: filteredExams.length,
                    })}
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
          </>
        )}
      </div>

      {previewExam && (
        <ExamPreviewPanel exam={previewExam} questions={questions} onClose={() => setPreviewExamId(null)} />
      )}

      {selectedExam && (
        <GradingPanel
          exam={selectedExam}
          submissions={examSubs}
          questions={questions}
          onClose={() => setSelectedExamId(null)}
        />
      )}
    </div>
  );
}

/** Lets the teacher check the paper before publishing — the exact
 * question/option list and order a student would see, plus the correct
 * answer(s) highlighted (which a student's own view never shows). */
function ExamPreviewPanel({
  exam,
  questions,
  onClose,
}: {
  exam: TeacherExamRow;
  questions: QuestionBankItem[];
  onClose: () => void;
}) {
  const t = useTranslations("teacherDashboard.exams");
  const tq = useTranslations("teacherDashboard.questionBank");
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const examQuestions = exam.questionIds.map((id) => questionById.get(id)).filter((q): q is QuestionBankItem => Boolean(q));

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg">{t("preview.heading", { title: exam.title })}</h3>
          <p className="text-sm text-muted-foreground">
            {exam.published ? t("preview.publishedNote") : t("preview.draftNote")}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("preview.close")}
        </Button>
      </div>
      {examQuestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("preview.empty")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {examQuestions.map((q, index) => (
            <div key={q.id} className="rounded-md border border-border p-3.5">
              <p className="mb-2 text-sm text-foreground">
                {t("preview.questionLabel", { number: index + 1 })}.{" "}
                {!q.codeFormat && q.text}{" "}
                <span className="text-muted-foreground">
                  ({tq(`typeLabel.${q.type}`)}
                  {q.type === "mcq" ? ` · ${tq(q.multiSelect ? "form.answerModeMulti" : "form.answerModeSingle")}` : ""} ·{" "}
                  {t("form.questionMarks", { marks: q.marks })})
                </span>
              </p>
              {q.codeFormat && <TerminalBlock className="mb-2">{q.text}</TerminalBlock>}
              {q.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL
                <img src={q.imageUrl} alt="" className="mb-2 max-w-sm rounded-md border border-border" />
              )}
              {q.type === "mcq" && q.options && (
                <ul className="flex flex-col gap-1.5 pl-1">
                  {q.options.map((option, optionIndex) => {
                    const isCorrect = (q.correctOptionIds ?? []).includes(option.id);
                    return (
                      <li
                        key={option.id}
                        className={cn(
                          "flex flex-wrap items-center gap-2 rounded-sm border px-2.5 py-1.5 text-sm",
                          isCorrect ? "border-success bg-success/10 font-medium text-success" : "border-border text-foreground/80",
                        )}
                      >
                        <span className="font-mono text-xs">{String.fromCharCode(65 + optionIndex)}.</span>
                        {q.codeFormat ? <TerminalBlock compact>{option.text}</TerminalBlock> : <span>{option.text}</span>}
                        {option.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL
                          <img src={option.imageUrl} alt="" className="max-h-20 rounded-sm border border-border" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {q.type === "code" && q.sampleAnswer && (
                <div className="mt-1">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("preview.referenceAnswerLabel")}</p>
                  <TerminalBlock>{q.sampleAnswer}</TerminalBlock>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GradingPanel({
  exam,
  submissions,
  questions,
  onClose,
}: {
  exam: TeacherExamRow;
  submissions: ExamSubmissionRow[];
  questions: QuestionBankItem[];
  onClose: () => void;
}) {
  const t = useTranslations("teacherDashboard.exams");
  const tc = useTranslations("teacherDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const codeQuestions = exam.questionIds
    .map((id) => questionById.get(id))
    .filter((q): q is QuestionBankItem => Boolean(q) && q?.type === "code");

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg">{t("grading.heading", { title: exam.title })}</h3>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("grading.close")}
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
          <SubmissionCard
            key={submission.id}
            submission={submission}
            codeQuestions={codeQuestions}
            onGraded={() => refresh()}
          />
        ))}
      </div>
    </div>
  );
}

function SubmissionCard({
  submission,
  codeQuestions,
  onGraded,
}: {
  submission: ExamSubmissionRow;
  codeQuestions: QuestionBankItem[];
  onGraded: () => void;
}) {
  const t = useTranslations("teacherDashboard.exams");

  const [editing, setEditing] = useState(submission.status === "pending");
  // Pending + has an auto-graded MCQ portion (a mixed exam) — start the
  // teacher off from that score instead of blank, so they're only adding
  // marks for the essay part rather than re-tallying the MCQs by hand.
  const [gradeDraft, setGradeDraft] = useState(
    String(submission.grade ?? (submission.status === "pending" ? (submission.mcqScore ?? "") : "")),
  );
  const [feedbackDraft, setFeedbackDraft] = useState(submission.feedback ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingFiles, setViewingFiles] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await gradeSubmission({ submissionId: submission.id, grade: gradeDraft, feedback: feedbackDraft });
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

      {submission.mcqScore !== null && submission.mcqMaxScore !== null && (
        <p className="mb-3 text-xs text-muted-foreground">
          {t("grading.autoScore", { score: submission.mcqScore, max: submission.mcqMaxScore })}
        </p>
      )}

      {codeQuestions.length > 0 && (
        <div className="mb-3 flex flex-col gap-2.5">
          <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("grading.codeHeading")}
          </div>
          {codeQuestions.map((q) => (
            <div key={q.id} className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">{q.text}</p>
              {submission.codeAnswers[q.id] ? (
                <TerminalBlock>{submission.codeAnswers[q.id]}</TerminalBlock>
              ) : (
                <p className="text-sm text-muted-foreground">{t("grading.noCodeAnswer")}</p>
              )}
            </div>
          ))}
        </div>
      )}

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
            closeLabel={t("grading.hideFiles")}
            onClose={() => setViewingFiles(false)}
          />
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setViewingFiles(true)}>
            {t("grading.viewFiles", { count: submission.photoUrls.length })}
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
