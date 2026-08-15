"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StatusBadge } from "@/components/features/status-badge";
import { LockPill } from "@/components/features/lock-pill";
import { ExamTimer } from "@/components/features/exam-timer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  examDefs,
  examSubmissions,
  questionBank,
  studentEnrollments,
  CURRENT_STUDENT,
} from "@/lib/mock-data";
import type { ExamDef, ExamSubmission, QuestionBankItem } from "@/types/dashboard-exams";

/** Static "today" label, matching the hardcoded convention used across the
 * other student-dashboard tabs (see notes-tab.tsx / reviews-tab.tsx). */
const TODAY_LABEL = "14 Aug 2026";

/** Auto-grades the MCQ portion of an exam against a student's answers. */
function scoreOf(exam: ExamDef, answers: Record<string, string>) {
  let autoScore = 0;
  let maxScore = 0;
  for (const qid of exam.questionIds) {
    const q = questionBank.find((item) => item.id === qid);
    if (!q) continue;
    maxScore += q.marks;
    if (q.type === "mcq" && answers[q.id] && answers[q.id] === q.correctOptionId) {
      autoScore += q.marks;
    }
  }
  return { autoScore, maxScore };
}

function examHasEssay(exam: ExamDef) {
  return exam.questionIds.some((qid) => questionBank.find((q) => q.id === qid)?.type === "essay");
}

/** The enrollment linking the signed-in student to this batch — used to display a teacher name. */
function teacherNameForBatch(batchId: string) {
  return studentEnrollments.find((e) => e.batchId === batchId)?.targetName ?? "—";
}

export function ExamsTab() {
  const t = useTranslations("studentDashboard.exams");
  const [submissions, setSubmissions] = useState<ExamSubmission[]>(examSubmissions);
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [timerStarts, setTimerStarts] = useState<Record<string, number>>({});
  const [resubmitExamId, setResubmitExamId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Class-scoped visibility: only exams for batches the student is actually enrolled in.
  const myBatchIds = studentEnrollments
    .map((e) => e.batchId)
    .filter((id): id is string => Boolean(id));
  const visibleExams = examDefs.filter((exam) => myBatchIds.includes(exam.batchId));

  function getSubmission(examId: string) {
    return submissions.find((s) => s.examId === examId && s.studentId === CURRENT_STUDENT.id);
  }

  function upsertSubmission(examId: string, patch: Partial<ExamSubmission>) {
    setSubmissions((prev) => {
      const idx = prev.findIndex((s) => s.examId === examId && s.studentId === CURRENT_STUDENT.id);
      if (idx === -1) {
        const created: ExamSubmission = {
          id: `sub-${Date.now()}`,
          examId,
          studentId: CURRENT_STUDENT.id,
          studentName: CURRENT_STUDENT.name,
          state: "not_started",
          ...patch,
        };
        return [...prev, created];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function flashMessage(message: string) {
    setFlash(message);
    setTimeout(() => setFlash(null), 2500);
  }

  function handleStart(exam: ExamDef) {
    setTimerStarts((prev) => (prev[exam.id] ? prev : { ...prev, [exam.id]: Date.now() }));
    upsertSubmission(exam.id, { state: "in_progress", startedAt: TODAY_LABEL });
    setActiveExamId(exam.id);
  }

  function handleSubmit(exam: ExamDef, answers: Record<string, string>, essayFiles: string[]) {
    const { autoScore, maxScore } = scoreOf(exam, answers);
    const hasEssay = examHasEssay(exam);
    upsertSubmission(exam.id, {
      state: hasEssay ? "submitted" : "graded",
      answers,
      essayFiles,
      autoScore,
      maxScore,
      submittedAt: TODAY_LABEL,
    });
  }

  const activeExam = activeExamId ? (examDefs.find((e) => e.id === activeExamId) ?? null) : null;

  // handleStart always records a timerStarts entry before setActiveExamId, so by the
  // time this renders the entry is guaranteed to exist — the non-null assertion avoids
  // calling Date.now() (an impure function) here in the render body as a fallback.
  if (activeExam && timerStarts[activeExam.id] !== undefined) {
    return (
      <ExamWorkspace
        exam={activeExam}
        submission={getSubmission(activeExam.id)}
        startedAtMs={timerStarts[activeExam.id]!}
        onSubmit={(answers, essayFiles) => handleSubmit(activeExam, answers, essayFiles)}
        onExit={() => setActiveExamId(null)}
      />
    );
  }

  const dueExams = visibleExams.filter((exam) => getSubmission(exam.id)?.state !== "graded");
  const pastSubmissions = submissions.filter(
    (s) => s.studentId === CURRENT_STUDENT.id && s.state === "graded",
  );

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">{t("dueTitle")}</h2>
        {flash && <span className="text-sm font-medium text-success">{flash}</span>}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("dueSubtitle")}</p>

      {dueExams.length === 0 ? (
        <div className="mb-8 rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
          {t("dueEmpty")}
        </div>
      ) : (
        <div className="mb-8 flex flex-col gap-4">
          {dueExams.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              submission={getSubmission(exam.id)}
              onStart={() => handleStart(exam)}
              isResubmitting={resubmitExamId === exam.id}
              onOpenResubmit={() => setResubmitExamId(exam.id)}
              onCloseResubmit={() => setResubmitExamId(null)}
              onResubmit={(essayFiles) => {
                upsertSubmission(exam.id, { essayFiles, submittedAt: TODAY_LABEL });
                setResubmitExamId(null);
                flashMessage(t("resubmitSuccess"));
              }}
            />
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-foreground">{t("pastTitle")}</h2>
      <div className="rounded-lg border border-border bg-white">
        {pastSubmissions.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">{t("pastEmpty")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tableExam")}</TableHead>
                <TableHead>{t("tableTeacher")}</TableHead>
                <TableHead>{t("tableGrade")}</TableHead>
                <TableHead>{t("tableFeedback")}</TableHead>
                <TableHead>{t("tableDate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pastSubmissions.map((sub) => {
                const exam = examDefs.find((e) => e.id === sub.examId);
                if (!exam) return null;
                const score = sub.teacherScore ?? sub.autoScore ?? 0;
                const grade = sub.maxScore !== undefined ? `${score}/${sub.maxScore}` : `${score}`;
                return (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium whitespace-normal text-foreground">
                      {exam.title}
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      {teacherNameForBatch(exam.batchId)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{grade}</TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      {sub.feedback ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      {sub.submittedAt ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function ExamCard({
  exam,
  submission,
  onStart,
  isResubmitting,
  onOpenResubmit,
  onCloseResubmit,
  onResubmit,
}: {
  exam: ExamDef;
  submission: ExamSubmission | undefined;
  onStart: () => void;
  isResubmitting: boolean;
  onOpenResubmit: () => void;
  onCloseResubmit: () => void;
  onResubmit: (essayFiles: string[]) => void;
}) {
  const t = useTranslations("studentDashboard.exams");
  const state = submission?.state ?? "not_started";

  return (
    <div className="rounded-lg border border-border bg-white p-4.5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-foreground">{exam.title}</div>
        {exam.status === "upcoming" && <LockPill>{t("notOpenYet")}</LockPill>}
        {exam.status === "open" && state === "submitted" && (
          <StatusBadge variant="pending">{t("pendingGrading")}</StatusBadge>
        )}
      </div>
      <p className="mb-3.5 text-sm text-muted-foreground">
        {t("durationLabel", { minutes: exam.durationMin })} · {exam.scheduledAt}
      </p>

      {exam.status === "upcoming" && (
        <p className="text-sm text-muted-foreground">{t("scheduledLabel", { date: exam.scheduledAt })}</p>
      )}

      {exam.status === "open" && state === "not_started" && (
        <Button size="sm" onClick={onStart}>
          {t("startExam")}
        </Button>
      )}

      {exam.status === "open" && state === "in_progress" && (
        <Button size="sm" onClick={onStart}>
          {t("continueExam")}
        </Button>
      )}

      {exam.status === "open" && state === "submitted" && (
        <div>
          <p className="mb-3 text-sm text-foreground/80">{t("submittedBody")}</p>
          {isResubmitting ? (
            <ResubmitPanel
              essayFiles={submission?.essayFiles ?? []}
              onCancel={onCloseResubmit}
              onSubmit={onResubmit}
            />
          ) : (
            <Button size="sm" variant="outline" onClick={onOpenResubmit}>
              {t("resubmit")}
            </Button>
          )}
        </div>
      )}

      {exam.status === "closed" && !submission && (
        <p className="text-sm text-muted-foreground">{t("examClosedNotAttempted")}</p>
      )}
    </div>
  );
}

function PhotoDropzone({
  photos,
  onAdd,
  onRemove,
}: {
  photos: string[];
  onAdd: (files: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  const t = useTranslations("studentDashboard.exams");
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
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onAdd(e.target.files);
          e.target.value = "";
        }}
      />
      {photos.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {photos.map((name, i) => (
            <li
              key={`${name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-sm border border-border bg-secondary/20 px-2.5 py-1.5 text-xs text-foreground/80"
            >
              <span className="truncate">{name}</span>
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

function ResubmitPanel({
  essayFiles,
  onCancel,
  onSubmit,
}: {
  essayFiles: string[];
  onCancel: () => void;
  onSubmit: (essayFiles: string[]) => void;
}) {
  const t = useTranslations("studentDashboard.exams");
  const [photos, setPhotos] = useState<string[]>(essayFiles);

  function handleAdd(files: FileList | null) {
    if (!files) return;
    setPhotos((prev) => [...prev, ...Array.from(files).map((f) => f.name)]);
  }

  function handleRemove(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/10 p-4">
      <h4 className="mb-2 text-sm font-semibold text-foreground">{t("resubmitPanelTitle")}</h4>
      <PhotoDropzone photos={photos} onAdd={handleAdd} onRemove={handleRemove} />
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => onSubmit(photos)}>
          {t("resubmitSubmit")}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

function ExamWorkspace({
  exam,
  submission,
  startedAtMs,
  onSubmit,
  onExit,
}: {
  exam: ExamDef;
  submission: ExamSubmission | undefined;
  startedAtMs: number;
  onSubmit: (answers: Record<string, string>, essayFiles: string[]) => void;
  onExit: () => void;
}) {
  const t = useTranslations("studentDashboard.exams");
  const [answers, setAnswers] = useState<Record<string, string>>(submission?.answers ?? {});
  const [photos, setPhotos] = useState<string[]>(submission?.essayFiles ?? []);
  const [result, setResult] = useState<{ autoScore: number; maxScore: number; hasEssay: boolean } | null>(
    null,
  );

  const questions = exam.questionIds
    .map((qid) => questionBank.find((q) => q.id === qid))
    .filter((q): q is QuestionBankItem => Boolean(q));
  const mcqQuestions = questions.filter((q) => q.type === "mcq");
  const essayQuestions = questions.filter((q) => q.type === "essay");
  const hasEssay = essayQuestions.length > 0;

  function handleAddPhoto(files: FileList | null) {
    if (!files) return;
    setPhotos((prev) => [...prev, ...Array.from(files).map((f) => f.name)]);
  }

  function handleRemovePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function submitNow() {
    const { autoScore, maxScore } = scoreOf(exam, answers);
    onSubmit(answers, photos);
    setResult({ autoScore, maxScore, hasEssay });
  }

  if (result) {
    return (
      <div className="mx-auto max-w-160">
        <h1 className="mb-4 text-2xl">{exam.title}</h1>
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-2 text-lg">{result.hasEssay ? t("submittedTitle") : t("gradedResultTitle")}</h3>
          <p className="mb-2 text-2xl font-semibold text-primary">
            {t("scoreLabel", { score: result.autoScore, max: result.maxScore })}
          </p>
          <p className="text-sm text-muted-foreground">
            {result.hasEssay ? t("essayPendingNote") : t("gradedResultBody")}
          </p>
          <Button className="mt-4" size="sm" variant="outline" onClick={onExit}>
            {t("backToExams")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-160">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">{t("durationLabel", { minutes: exam.durationMin })}</p>
        </div>
        <ExamTimer startedAt={startedAtMs} durationMin={exam.durationMin} onExpire={submitNow} />
      </div>

      {mcqQuestions.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("mcqSectionTitle")}
          </h3>
          <div className="flex flex-col gap-4">
            {mcqQuestions.map((q, index) => (
              <div key={q.id} className="rounded-lg border border-border bg-white p-4">
                <div className="mb-3 text-sm font-medium text-foreground">
                  {t("questionLabel", { number: index + 1 })}. {q.text}
                </div>
                <RadioGroup
                  value={answers[q.id] ?? ""}
                  onValueChange={(value) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: String(value ?? "") }))
                  }
                >
                  {q.options?.map((opt) => {
                    const optionInputId = `${q.id}-${opt.id}`;
                    return (
                      <div key={opt.id} className="flex items-center gap-2.5">
                        <RadioGroupItem value={opt.id} id={optionInputId} />
                        <Label htmlFor={optionInputId} className="font-normal">
                          {opt.text}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasEssay && (
        <div className="mb-6">
          <h3 className="mb-3 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("essaySectionTitle")}
          </h3>
          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-white p-4">
            {essayQuestions.map((q, index) => (
              <p key={q.id} className="text-sm text-foreground">
                {t("questionLabel", { number: mcqQuestions.length + index + 1 })}. {q.text}
              </p>
            ))}
          </div>
          <p className="mb-2 text-xs text-muted-foreground">{t("essayInstructions")}</p>
          <PhotoDropzone photos={photos} onAdd={handleAddPhoto} onRemove={handleRemovePhoto} />
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={submitNow} disabled={hasEssay && photos.length === 0}>
          {t("submitExam")}
        </Button>
        <Button variant="outline" onClick={onExit}>
          {t("backToExams")}
        </Button>
      </div>
    </div>
  );
}
