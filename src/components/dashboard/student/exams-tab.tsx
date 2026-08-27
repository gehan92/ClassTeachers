"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/features/status-badge";
import { LockPill } from "@/components/features/lock-pill";
import { TerminalBlock } from "@/components/dashboard/terminal-block";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { useIsMounted } from "@/lib/hooks/use-is-mounted";
import { submitExam } from "@/lib/dashboard/exams-actions";
import { cn } from "@/lib/utils";

export type StudentExamQuestion = {
  id: string;
  text: string;
  type: "mcq" | "essay" | "code";
  marks: number;
  imageUrl?: string;
  /** MCQ only — the student picks one (or more, if multiSelect) directly in
   * the app (auto-graded on submit). No correct-answer marker is ever sent
   * to the student. */
  options?: { id: string; text: string; imageUrl?: string }[];
  /** MCQ only — true when the teacher set up this question as "select all
   * that apply", so the app renders checkboxes instead of a single radio.
   * Just the shape of the question, not which options are actually correct. */
  multiSelect?: boolean;
  /** Renders the question stem (and, for MCQ, each option) as a dark,
   * monospace terminal block — for IT/programming questions with code. */
  codeFormat?: boolean;
  /** MCQ only — the correct option id(s). Only ever populated once this
   * question's exam is graded AND the teacher opted the exam into
   * reveal_answers (0079) — undefined the rest of the time, same
   * never-leak-the-answer-key rule as during the exam itself. */
  correctOptionIds?: string[];
  /** "code" type only — the teacher's own reference answer, shown alongside
   * the student's own answer. Same reveal-gated rule as correctOptionIds. */
  sampleAnswer?: string;
};
export type StudentExamRow = {
  id: string;
  title: string;
  teacherName: string;
  durationMinutes: number;
  scheduledLabel: string;
  isOpen: boolean;
  questions: StudentExamQuestion[];
  submission: {
    status: "pending" | "graded";
    grade: number | null;
    feedback: string | null;
    submittedLabel: string | null;
  } | null;
  /** The student's own answers, for the answer-review panel — only
   * populated when this exam is graded and reveal-gated (0079); null
   * otherwise, which also doubles as "no review available" for the UI. */
  reviewAnswers: { mcqAnswers: Record<string, string[]>; codeAnswers: Record<string, string> } | null;
};

export function ExamsTab({ exams }: { exams: StudentExamRow[] }) {
  const t = useTranslations("studentDashboard.exams");
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [reviewExamId, setReviewExamId] = useState<string | null>(null);

  const activeExam = activeExamId ? (exams.find((e) => e.id === activeExamId) ?? null) : null;
  if (activeExam) {
    return <ExamWorkspace exam={activeExam} onExit={() => setActiveExamId(null)} />;
  }

  const dueExams = exams.filter((exam) => exam.submission?.status !== "graded");
  const pastExams = exams.filter((exam) => exam.submission?.status === "graded");
  const reviewExam = reviewExamId ? (exams.find((e) => e.id === reviewExamId) ?? null) : null;

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <h2 className="mb-1 text-lg font-semibold text-foreground">{t("dueTitle")}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{t("dueSubtitle")}</p>

      {dueExams.length === 0 ? (
        <div className="mb-8 rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
          {t("dueEmpty")}
        </div>
      ) : (
        <div className="mb-8 flex flex-col gap-4">
          {dueExams.map((exam) => (
            <ExamCard key={exam.id} exam={exam} onOpen={() => setActiveExamId(exam.id)} />
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-foreground">{t("pastTitle")}</h2>
      <div className="rounded-lg border border-border bg-white">
        {pastExams.length === 0 ? (
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
                <TableHead>{t("tableAnswers")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pastExams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium whitespace-normal text-foreground">{exam.title}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{exam.teacherName}</TableCell>
                  <TableCell className="text-muted-foreground">{exam.submission?.grade ?? "—"}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">
                    {exam.submission?.feedback ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">
                    {exam.submission?.submittedLabel ?? "—"}
                  </TableCell>
                  <TableCell>
                    {exam.reviewAnswers ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setReviewExamId(exam.id)}>
                        {t("viewAnswers")}
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {reviewExam && <AnswerReviewPanel exam={reviewExam} onClose={() => setReviewExamId(null)} />}
    </div>
  );
}

function ExamCard({ exam, onOpen }: { exam: StudentExamRow; onOpen: () => void }) {
  const t = useTranslations("studentDashboard.exams");

  return (
    <div className="rounded-lg border border-border bg-white p-4.5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-foreground">{exam.title}</div>
        {!exam.isOpen && <LockPill>{t("notOpenYet")}</LockPill>}
        {exam.isOpen && exam.submission?.status === "pending" && (
          <StatusBadge variant="pending">{t("pendingGrading")}</StatusBadge>
        )}
      </div>
      <p className="mb-3.5 text-sm text-muted-foreground">
        {t("durationLabel", { minutes: exam.durationMinutes })} · {exam.scheduledLabel}
      </p>

      {!exam.isOpen && <p className="text-sm text-muted-foreground">{t("scheduledLabel", { date: exam.scheduledLabel })}</p>}

      {exam.isOpen && !exam.submission && (
        <Button size="sm" onClick={onOpen}>
          {t("startExam")}
        </Button>
      )}

      {exam.isOpen && exam.submission?.status === "pending" && (
        <p className="text-sm text-foreground/80">{t("submittedBody")}</p>
      )}
    </div>
  );
}

/** Read-only per-question breakdown — the student's own answer next to the
 * correct one, once the teacher has both graded the exam and opted it into
 * reveal_answers (0079). exam.reviewAnswers is the single gate for this
 * whole panel; it's null for every exam that hasn't opted in. */
function AnswerReviewPanel({ exam, onClose }: { exam: StudentExamRow; onClose: () => void }) {
  const t = useTranslations("studentDashboard.exams");
  if (!exam.reviewAnswers) return null;
  const { mcqAnswers, codeAnswers } = exam.reviewAnswers;

  return (
    <div className="mt-4 rounded-lg border border-border bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg">{t("answerReviewHeading", { title: exam.title })}</h3>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("closeAnswers")}
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {exam.questions.map((q, index) => {
          const selectedIds = mcqAnswers[q.id] ?? [];
          const correctSet = new Set(q.correctOptionIds ?? []);
          return (
            <div key={q.id} className="rounded-md border border-border p-3.5">
              <p className="mb-2 text-sm text-foreground">
                {t("questionLabel", { number: index + 1 })}.{" "}
                {!q.codeFormat && q.text}
              </p>
              {q.codeFormat && <TerminalBlock className="mb-2">{q.text}</TerminalBlock>}
              {q.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a local/optimizable asset
                <img src={q.imageUrl} alt="" className="mb-2 max-w-sm rounded-md border border-border" />
              )}
              {q.type === "mcq" && q.options && (
                <ul className="flex flex-col gap-1.5 pl-1">
                  {q.options.map((option, optionIndex) => {
                    const isCorrect = correctSet.has(option.id);
                    const isSelected = selectedIds.includes(option.id);
                    return (
                      <li
                        key={option.id}
                        className={cn(
                          "flex flex-wrap items-center gap-2 rounded-sm border px-2.5 py-1.5 text-sm",
                          isCorrect
                            ? "border-success bg-success/10 font-medium text-success"
                            : isSelected
                              ? "border-destructive bg-destructive/10 text-destructive"
                              : "border-border text-foreground/80",
                        )}
                      >
                        <span className="font-mono text-xs">{String.fromCharCode(65 + optionIndex)}.</span>
                        {q.codeFormat ? <TerminalBlock compact>{option.text}</TerminalBlock> : <span>{option.text}</span>}
                        {isSelected && <span className="text-xs font-medium">{t("yourAnswerTag")}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
              {q.type === "code" && (
                <div className="mt-1 flex flex-col gap-3">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("yourAnswerLabel")}</p>
                    {codeAnswers[q.id] ? (
                      <TerminalBlock>{codeAnswers[q.id]}</TerminalBlock>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("noAnswerGiven")}</p>
                    )}
                  </div>
                  {q.sampleAnswer && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("referenceAnswerLabel")}</p>
                      <TerminalBlock>{q.sampleAnswer}</TerminalBlock>
                    </div>
                  )}
                </div>
              )}
              {q.type === "essay" && <p className="mt-1 text-xs text-muted-foreground">{t("essayNoAnswerKey")}</p>}
            </div>
          );
        })}
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

function QuestionBlock({ question, number }: { question: StudentExamQuestion; number: number }) {
  const t = useTranslations("studentDashboard.exams");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-foreground">{t("questionLabel", { number })}.</p>
      {question.codeFormat ? (
        <TerminalBlock>{question.text}</TerminalBlock>
      ) : (
        <p className="-mt-1.5 text-sm text-foreground">{question.text}</p>
      )}
      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a local/optimizable asset
        <img src={question.imageUrl} alt="" className="max-w-sm rounded-md border border-border" />
      )}
    </div>
  );
}

/** Code/Terminal questions are typed directly in the app, not written on
 * paper — same idea as MCQ auto-answering, but the answer is free-form code
 * text a teacher grades manually (see the note on `submitExam`). */
function CodeQuestionBlock({
  question,
  number,
  value,
  onChange,
}: {
  question: StudentExamQuestion;
  number: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("studentDashboard.exams");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-foreground">{t("questionLabel", { number })}.</p>
      {question.codeFormat ? (
        <TerminalBlock>{question.text}</TerminalBlock>
      ) : (
        <p className="-mt-1.5 text-sm text-foreground">{question.text}</p>
      )}
      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a local/optimizable asset
        <img src={question.imageUrl} alt="" className="max-w-sm rounded-md border border-border" />
      )}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("codeAnswerPlaceholder")}
        className="min-h-32 border-[#1f2a44] bg-[#0b1120] font-mono text-sm text-[#d1f7dc] placeholder:text-[#5a6b8c] focus-visible:ring-primary/50"
      />
    </div>
  );
}

/** MCQ questions are answered directly in the app, not written on paper —
 * see the note on `submitExam` for why this is the piece that lets a
 * pure-MCQ exam skip the photo-upload flow entirely. */
function McqQuestionBlock({
  question,
  number,
  selectedOptionIds,
  onToggle,
}: {
  question: StudentExamQuestion;
  number: number;
  selectedOptionIds: string[];
  onToggle: (optionId: string) => void;
}) {
  const t = useTranslations("studentDashboard.exams");
  const multiSelect = Boolean(question.multiSelect);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-foreground">
        {t("questionLabel", { number })}.{" "}
        {!question.codeFormat && question.text}
        {multiSelect && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t("selectAllHint")}</span>}
      </p>
      {question.codeFormat && <TerminalBlock>{question.text}</TerminalBlock>}
      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a local/optimizable asset
        <img src={question.imageUrl} alt="" className="max-w-sm rounded-md border border-border" />
      )}
      {question.options && question.options.length > 0 && (
        <div className="flex flex-col gap-1.5 pl-4">
          {question.options.map((option, optionIndex) => (
            <label
              key={option.id}
              className="flex flex-wrap items-center gap-2 rounded-md p-1.5 text-sm text-foreground/80 hover:bg-secondary/40"
            >
              <input
                type={multiSelect ? "checkbox" : "radio"}
                name={multiSelect ? undefined : `mcq-${question.id}`}
                checked={selectedOptionIds.includes(option.id)}
                onChange={() => onToggle(option.id)}
                className="accent-primary"
              />
              <span className="font-mono text-xs text-muted-foreground">
                {String.fromCharCode(65 + optionIndex)}.
              </span>
              {question.codeFormat ? <TerminalBlock compact>{option.text}</TerminalBlock> : <span>{option.text}</span>}
              {option.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a local/optimizable asset
                <img src={option.imageUrl} alt="" className="max-h-24 rounded-sm border border-border" />
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCountdown(totalSeconds: number) {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const LOW_TIME_THRESHOLD_SECONDS = 5 * 60;

function ExamWorkspace({ exam, onExit }: { exam: StudentExamRow; onExit: () => void }) {
  const t = useTranslations("studentDashboard.exams");
  const tc = useTranslations("studentDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [photos, setPhotos] = useState<File[]>([]);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string[]>>({});
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoGrade, setAutoGrade] = useState<{ score: number; maxScore: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const mounted = useIsMounted();
  const [timeLeft, setTimeLeft] = useState(() => exam.durationMinutes * 60);
  const autoSubmittedRef = useRef(false);
  const mcqQuestions = exam.questions.filter((q) => q.type === "mcq");
  const essayQuestions = exam.questions.filter((q) => q.type === "essay");
  const codeQuestions = exam.questions.filter((q) => q.type === "code");
  const allMcqAnswered = mcqQuestions.every((q) => (mcqAnswers[q.id]?.length ?? 0) > 0);
  const allCodeAnswered = codeQuestions.every((q) => (codeAnswers[q.id]?.trim().length ?? 0) > 0);
  const canSubmit = allMcqAnswered && allCodeAnswered && (essayQuestions.length === 0 || photos.length > 0);

  // Full-screen takeover: lock background scroll while this is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (submitted) return;
    const id = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [submitted]);

  function handleAdd(fileList: FileList | null) {
    if (!fileList) return;
    setPhotos((prev) => [...prev, ...Array.from(fileList)]);
  }

  function handleRemove(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(forced = false) {
    if (!forced && !canSubmit) return;
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("examId", exam.id);
    formData.set("mcqAnswers", JSON.stringify(mcqAnswers));
    formData.set("codeAnswers", JSON.stringify(codeAnswers));
    if (forced) formData.set("timeExpired", "1");
    for (const photo of photos) formData.append("photos", photo);
    const result = await submitExam(formData);
    setSaving(false);
    if (result.error) {
      // A forced (timeout) submit failing server-side has nowhere else to
      // go — surface it, but there's no more time left to fix and retry.
      setError(result.error);
      return;
    }
    setAutoGrade(result.autoGrade ?? null);
    setSubmitted(true);
    refresh();
  }

  useEffect(() => {
    if (timeLeft > 0 || submitted || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    void handleSubmit(true);
    // handleSubmit closes over current answers/photos each render; only the
    // 0-crossing should retrigger this, not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, submitted]);

  function handleExit() {
    if (window.confirm(t("exitConfirm"))) onExit();
  }

  const lowOnTime = timeLeft <= LOW_TIME_THRESHOLD_SECONDS;

  const content = submitted ? (
    <div className="mx-auto max-w-160">
      <h1 className="mb-4 text-2xl">{exam.title}</h1>
      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-2 text-lg">{t("submittedTitle")}</h3>
        <p className="text-sm text-muted-foreground">
          {autoGrade
            ? t("autoGradedNote", { score: autoGrade.score, max: autoGrade.maxScore })
            : mcqQuestions.length > 0
              ? t("essayPendingNote")
              : t("essayOnlyPendingNote")}
        </p>
        <RefreshStatus
          pending={isRefreshing}
          stuck={refreshStuck}
          pendingLabel={tc("updatingList")}
          stuckLabel={tc("updateStuck")}
          reloadLabel={tc("reloadPage")}
          className="mt-3"
        />
        <Button className="mt-4" size="sm" variant="outline" onClick={onExit}>
          {t("backToExams")}
        </Button>
      </div>
    </div>
  ) : (
    <div className="mx-auto max-w-160">
      <div className="mb-6">
        {mcqQuestions.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("mcqSectionTitle")}
            </h3>
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-4">
              {mcqQuestions.map((q, index) => (
                <McqQuestionBlock
                  key={q.id}
                  question={q}
                  number={index + 1}
                  selectedOptionIds={mcqAnswers[q.id] ?? []}
                  onToggle={(optionId) =>
                    setMcqAnswers((prev) => {
                      const current = prev[q.id] ?? [];
                      if (!q.multiSelect) return { ...prev, [q.id]: [optionId] };
                      const next = current.includes(optionId)
                        ? current.filter((id) => id !== optionId)
                        : [...current, optionId];
                      return { ...prev, [q.id]: next };
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}
        {codeQuestions.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("codeSectionTitle")}
            </h3>
            <div className="flex flex-col gap-5 rounded-lg border border-border bg-white p-4">
              {codeQuestions.map((q, index) => (
                <CodeQuestionBlock
                  key={q.id}
                  question={q}
                  number={index + 1}
                  value={codeAnswers[q.id] ?? ""}
                  onChange={(value) => setCodeAnswers((prev) => ({ ...prev, [q.id]: value }))}
                />
              ))}
            </div>
          </div>
        )}
        {essayQuestions.length > 0 && (
          <div>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("essaySectionTitle")}
            </h3>
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-4">
              {essayQuestions.map((q, index) => (
                <QuestionBlock key={q.id} question={q} number={index + 1} />
              ))}
            </div>
            <p className="mt-3 mb-2 text-xs text-muted-foreground">{t("essayInstructions")}</p>
            <PhotoDropzone files={photos} onAdd={handleAdd} onRemove={handleRemove} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => handleSubmit()} disabled={!canSubmit || saving}>
          {t("submitExam")}
        </Button>
        <Button variant="outline" onClick={handleExit} disabled={saving}>
          {t("backToExams")}
        </Button>
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>
    </div>
  );

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-white px-4 py-3 sm:px-8">
        <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">{exam.title}</h1>
        {!submitted && (
          <div
            role="timer"
            aria-label={t("timeRemainingLabel")}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 font-mono text-sm font-semibold tabular-nums",
              lowOnTime ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground",
            )}
          >
            {formatCountdown(timeLeft)}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">{content}</div>
    </div>,
    document.body,
  );
}
