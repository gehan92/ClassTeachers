"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/features/status-badge";
import { questionBank, examDefs, examSubmissions, teacherBatches } from "@/lib/mock-data";
import type { ExamDef, ExamSubmission, QuestionBankItem } from "@/types/dashboard-exams";
import { cn } from "@/lib/utils";

const TEACHER_BATCH_IDS = teacherBatches.map((b) => b.id);

function examStatusVariant(status: ExamDef["status"]) {
  if (status === "open") return "active" as const;
  if (status === "upcoming") return "upcoming" as const;
  return "closed" as const;
}

export function ExamsTab() {
  const t = useTranslations("teacherDashboard.exams");
  const tq = useTranslations("teacherDashboard.questionBank");
  const tc = useTranslations("teacherDashboard.common");
  const tg = useTranslations("search");

  const [exams, setExams] = useState<ExamDef[]>(() =>
    examDefs.filter((e) => TEACHER_BATCH_IDS.includes(e.batchId)),
  );
  const [submissions, setSubmissions] = useState<ExamSubmission[]>(examSubmissions);

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [batchId, setBatchId] = useState<string>(teacherBatches[0]?.id ?? "");
  const [duration, setDuration] = useState("60");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [created, setCreated] = useState(false);

  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  const batchQuestions = useMemo(
    () => questionBank.filter((q) => !q.batchId || q.batchId === batchId),
    [batchId],
  );

  function setQuestionChecked(id: string, checked: boolean) {
    setSelectedQuestionIds((ids) => (checked ? [...ids, id] : ids.filter((x) => x !== id)));
  }

  function resetForm() {
    setTitle("");
    setBatchId(teacherBatches[0]?.id ?? "");
    setDuration("60");
    setScheduledAt("");
    setSelectedQuestionIds([]);
  }

  function handleCreate() {
    if (!title.trim() || !batchId || selectedQuestionIds.length === 0) return;
    const batch = teacherBatches.find((b) => b.id === batchId);
    if (!batch) return;
    const chosen = questionBank.filter((q) => selectedQuestionIds.includes(q.id));
    const hasMcq = chosen.some((q) => q.type === "mcq");
    const hasEssay = chosen.some((q) => q.type === "essay");
    const examType: ExamDef["examType"] = hasMcq && hasEssay ? "mixed" : hasMcq ? "mcq" : "essay";

    const newExam: ExamDef = {
      id: `e-${Date.now()}`,
      title: title.trim(),
      batchId,
      gradeBand: batch.gradeBand,
      durationMin: Number(duration) || 60,
      scheduledAt: scheduledAt.trim() || "TBC",
      questionIds: selectedQuestionIds,
      examType,
      status: "upcoming",
    };

    setExams((list) => [...list, newExam]);
    resetForm();
    setCreating(false);
    setCreated(true);
    setTimeout(() => setCreated(false), 2500);
  }

  function handleCancelCreate() {
    resetForm();
    setCreating(false);
  }

  function handleSaveGrade(submissionId: string, teacherScore: number, feedback: string) {
    setSubmissions((list) =>
      list.map((s) => (s.id === submissionId ? { ...s, teacherScore, feedback, state: "graded" } : s)),
    );
  }

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null;
  const examSubs = selectedExam ? submissions.filter((s) => s.examId === selectedExam.id) : [];

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
              <Label htmlFor="exam-batch">{t("form.batchLabel")}</Label>
              <Select
                value={batchId}
                onValueChange={(value) => {
                  setBatchId(value as string);
                  setSelectedQuestionIds([]);
                }}
              >
                <SelectTrigger id="exam-batch" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teacherBatches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="exam-date">{t("form.dateLabel")}</Label>
              <Input
                id="exam-date"
                placeholder={t("form.datePlaceholder")}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4">
            <Label>{t("form.questionsLabel")}</Label>
            {batchQuestions.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted-foreground">{t("form.noQuestionsForBatch")}</p>
            ) : (
              <div className="mt-1.5 flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-md border border-border p-3">
                {batchQuestions.map((q) => (
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

          <div className="mt-4 flex gap-3">
            <Button type="button" onClick={handleCreate}>
              {tc("add")}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancelCreate}>
              {tc("cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("examsHeading")}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.exam")}</TableHead>
              <TableHead>{t("columns.batch")}</TableHead>
              <TableHead>{t("columns.grade")}</TableHead>
              <TableHead>{t("columns.duration")}</TableHead>
              <TableHead>{t("columns.date")}</TableHead>
              <TableHead>{t("columns.questions")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exams.map((exam) => {
              const batch = teacherBatches.find((b) => b.id === exam.batchId);
              const examSubsCount = submissions.filter((s) => s.examId === exam.id).length;
              return (
                <TableRow key={exam.id}>
                  <TableCell className="max-w-64 whitespace-normal font-medium text-foreground">
                    {exam.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{batch?.title ?? exam.batchId}</TableCell>
                  <TableCell className="text-muted-foreground">{tg(`grades.${exam.gradeBand}`)}</TableCell>
                  <TableCell className="text-muted-foreground">{t("minutes", { count: exam.durationMin })}</TableCell>
                  <TableCell className="text-muted-foreground">{exam.scheduledAt}</TableCell>
                  <TableCell className="text-muted-foreground">{exam.questionIds.length}</TableCell>
                  <TableCell>
                    <StatusBadge variant={examStatusVariant(exam.status)}>{t(`status.${exam.status}`)}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={examSubsCount === 0}
                      onClick={() => setSelectedExamId(exam.id)}
                    >
                      {t("grade")}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedExam && (
        <GradingPanel
          exam={selectedExam}
          submissions={examSubs}
          onSaveGrade={handleSaveGrade}
          onClose={() => setSelectedExamId(null)}
        />
      )}
    </div>
  );
}

function GradingPanel({
  exam,
  submissions,
  onSaveGrade,
  onClose,
}: {
  exam: ExamDef;
  submissions: ExamSubmission[];
  onSaveGrade: (id: string, score: number, feedback: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("teacherDashboard.exams");

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg">{t("grading.heading", { title: exam.title })}</h3>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("grading.close")}
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {submissions.length === 0 && <p className="text-sm text-muted-foreground">{t("grading.noSubmissions")}</p>}
        {submissions.map((submission) => (
          <SubmissionCard key={submission.id} exam={exam} submission={submission} onSaveGrade={onSaveGrade} />
        ))}
      </div>
    </div>
  );
}

function SubmissionCard({
  exam,
  submission,
  onSaveGrade,
}: {
  exam: ExamDef;
  submission: ExamSubmission;
  onSaveGrade: (id: string, score: number, feedback: string) => void;
}) {
  const t = useTranslations("teacherDashboard.exams");

  const [showFiles, setShowFiles] = useState(false);
  const [editing, setEditing] = useState(false);
  const [scoreDraft, setScoreDraft] = useState(String(submission.teacherScore ?? ""));
  const [feedbackDraft, setFeedbackDraft] = useState(submission.feedback ?? "");

  if (submission.state === "not_started") {
    return (
      <div className="flex items-center justify-between rounded-md border border-border p-3.5">
        <span className="font-medium text-foreground">{submission.studentName}</span>
        <span className="text-sm text-muted-foreground">{t("grading.notStarted")}</span>
      </div>
    );
  }

  const examQuestions = exam.questionIds
    .map((id) => questionBank.find((q) => q.id === id))
    .filter((q): q is QuestionBankItem => Boolean(q));
  const mcqQuestions = examQuestions.filter((q) => q.type === "mcq");
  const essayQuestions = examQuestions.filter((q) => q.type === "essay");
  const mcqMax = mcqQuestions.reduce((sum, q) => sum + q.marks, 0);
  const totalScore = (submission.autoScore ?? 0) + (submission.teacherScore ?? 0);

  function handleSave() {
    onSaveGrade(submission.id, Number(scoreDraft) || 0, feedbackDraft.trim());
    setEditing(false);
  }

  const showGradeForm = essayQuestions.length > 0 && (submission.state === "submitted" || editing);

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium text-foreground">{submission.studentName}</div>
          {submission.submittedAt && <div className="text-xs text-muted-foreground">{submission.submittedAt}</div>}
        </div>
        {submission.state === "graded" && !editing && (
          <StatusBadge variant="graded">{t("grading.graded")}</StatusBadge>
        )}
        {submission.state === "submitted" && (
          <StatusBadge variant="pending">{t("grading.awaitingGrading")}</StatusBadge>
        )}
        {submission.state === "in_progress" && (
          <StatusBadge variant="upcoming">{t("grading.inProgress")}</StatusBadge>
        )}
      </div>

      {mcqQuestions.length > 0 && submission.answers && (
        <div className="mb-3">
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("grading.mcqHeading")}
          </div>
          <ul className="flex flex-col gap-1">
            {mcqQuestions.map((q) => {
              const answerId = submission.answers?.[q.id];
              const isCorrect = answerId === q.correctOptionId;
              const answerText = q.options?.find((o) => o.id === answerId)?.text ?? "—";
              return (
                <li key={q.id} className={cn("text-sm", isCorrect ? "text-success" : "text-lock")}>
                  {q.text} — {answerText} {isCorrect ? "✓" : "✗"}
                </li>
              );
            })}
          </ul>
          {submission.autoScore !== undefined && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("grading.autoScore", { score: submission.autoScore, max: mcqMax })}
            </p>
          )}
        </div>
      )}

      {essayQuestions.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("grading.essayHeading")}
            </span>
            {submission.essayFiles && submission.essayFiles.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowFiles((v) => !v)}>
                {showFiles ? t("grading.hideFiles") : t("grading.viewFiles", { count: submission.essayFiles.length })}
              </Button>
            )}
          </div>
          {(!submission.essayFiles || submission.essayFiles.length === 0) && (
            <p className="text-sm text-muted-foreground">{t("grading.noFiles")}</p>
          )}
          {showFiles && submission.essayFiles && submission.essayFiles.length > 0 && (
            <EssayPreview
              studentName={submission.studentName}
              date={submission.submittedAt ?? ""}
              files={submission.essayFiles}
            />
          )}
        </div>
      )}

      {essayQuestions.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          {showGradeForm ? (
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start">
              <div className="grid w-full gap-1.5 sm:w-32">
                <Label htmlFor={`score-${submission.id}`}>{t("grading.scoreLabel")}</Label>
                <Input
                  id={`score-${submission.id}`}
                  type="number"
                  min="0"
                  value={scoreDraft}
                  onChange={(e) => setScoreDraft(e.target.value)}
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
              <Button type="button" size="sm" className="sm:mt-6" onClick={handleSave}>
                {t("grading.saveGrade")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-foreground">
                {t("grading.totalScore", { score: totalScore, max: submission.maxScore ?? 0 })}
              </div>
              {submission.feedback && <p className="max-w-96 text-sm text-muted-foreground">{submission.feedback}</p>}
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
                {t("grading.editGrade")}
              </Button>
            </div>
          )}
        </div>
      )}

      {essayQuestions.length === 0 && submission.state === "graded" && (
        <div className="mt-3 border-t border-border pt-3 text-sm text-foreground">
          {t("grading.totalScore", { score: totalScore, max: submission.maxScore ?? 0 })}
        </div>
      )}
    </div>
  );
}

function EssayPreview({ studentName, date, files }: { studentName: string; date: string; files: string[] }) {
  const t = useTranslations("teacherDashboard.exams");

  return (
    <div className="relative mt-2 overflow-hidden rounded-lg border border-border bg-white p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex select-none items-center justify-center rotate-[-25deg] text-3xl font-bold text-foreground opacity-10"
      >
        {studentName} · {date}
      </div>
      <div className="relative flex flex-col gap-1.5">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{t("grading.filesHeading")}</p>
        <ul className="list-disc pl-5 text-sm text-foreground/80">
          {files.map((file) => (
            <li key={file}>{file}</li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted-foreground">{t("grading.previewNote")}</p>
      </div>
    </div>
  );
}
