"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/features/status-badge";
import { PhotoViewerPanel } from "@/components/dashboard/inline-file-viewer";
import { createExam, gradeSubmission } from "@/lib/dashboard/exams-actions";
import type { QuestionBankItem } from "@/types/dashboard-exams";

export type TeacherExamRow = {
  id: string;
  title: string;
  durationMinutes: number;
  scheduledLabel: string;
  questionCount: number;
};

export type ExamSubmissionRow = {
  id: string;
  examId: string;
  studentName: string;
  submittedLabel: string | null;
  status: "pending" | "graded";
  grade: number | null;
  feedback: string | null;
  photoUrls: string[];
};

export function ExamsTab({
  exams,
  submissions,
  questions,
}: {
  exams: TeacherExamRow[];
  submissions: ExamSubmissionRow[];
  questions: QuestionBankItem[];
}) {
  const t = useTranslations("teacherDashboard.exams");
  const tq = useTranslations("teacherDashboard.questionBank");
  const tc = useTranslations("teacherDashboard.common");
  const router = useRouter();

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  function setQuestionChecked(id: string, checked: boolean) {
    setSelectedQuestionIds((ids) => (checked ? [...ids, id] : ids.filter((x) => x !== id)));
  }

  function resetForm() {
    setTitle("");
    setDuration("60");
    setScheduledAt("");
    setSelectedQuestionIds([]);
  }

  async function handleCreate() {
    if (!title.trim() || selectedQuestionIds.length === 0 || !scheduledAt) return;
    setSaving(true);
    setError(null);
    const result = await createExam({
      ownerType: "teacher",
      title,
      questionIds: selectedQuestionIds,
      durationMinutes: duration,
      scheduledAt,
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
    router.refresh();
  }

  function handleCancelCreate() {
    resetForm();
    setCreating(false);
  }

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null;
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.exam")}</TableHead>
                <TableHead>{t("columns.duration")}</TableHead>
                <TableHead>{t("columns.date")}</TableHead>
                <TableHead>{t("columns.questions")}</TableHead>
                <TableHead>{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((exam) => {
                const total = submissionCountByExam.get(exam.id) ?? 0;
                const pending = pendingCountByExam.get(exam.id) ?? 0;
                return (
                  <TableRow key={exam.id}>
                    <TableCell className="max-w-64 whitespace-normal font-medium text-foreground">
                      {exam.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t("minutes", { count: exam.durationMinutes })}</TableCell>
                    <TableCell className="text-muted-foreground">{exam.scheduledLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{exam.questionCount}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={total === 0}
                        onClick={() => setSelectedExamId(exam.id)}
                      >
                        {pending > 0 ? t("gradeWithCount", { count: pending }) : t("grade")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedExam && (
        <GradingPanel
          exam={selectedExam}
          submissions={examSubs}
          onClose={() => setSelectedExamId(null)}
        />
      )}
    </div>
  );
}

function GradingPanel({
  exam,
  submissions,
  onClose,
}: {
  exam: TeacherExamRow;
  submissions: ExamSubmissionRow[];
  onClose: () => void;
}) {
  const t = useTranslations("teacherDashboard.exams");
  const router = useRouter();

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
          <SubmissionCard key={submission.id} submission={submission} onGraded={() => router.refresh()} />
        ))}
      </div>
    </div>
  );
}

function SubmissionCard({
  submission,
  onGraded,
}: {
  submission: ExamSubmissionRow;
  onGraded: () => void;
}) {
  const t = useTranslations("teacherDashboard.exams");

  const [editing, setEditing] = useState(submission.status === "pending");
  const [gradeDraft, setGradeDraft] = useState(String(submission.grade ?? ""));
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
