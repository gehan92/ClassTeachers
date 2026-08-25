"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/features/status-badge";
import { LockPill } from "@/components/features/lock-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { submitExam } from "@/lib/dashboard/exams-actions";

export type StudentExamQuestion = {
  id: string;
  text: string;
  type: "mcq" | "essay";
  marks: number;
  imageUrl?: string;
  /** MCQ only — the student picks one directly in the app (auto-graded on
   * submit). No correct-answer marker is ever sent to the student. */
  options?: { id: string; text: string; imageUrl?: string }[];
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
};

export function ExamsTab({ exams }: { exams: StudentExamRow[] }) {
  const t = useTranslations("studentDashboard.exams");
  const [activeExamId, setActiveExamId] = useState<string | null>(null);

  const activeExam = activeExamId ? (exams.find((e) => e.id === activeExamId) ?? null) : null;
  if (activeExam) {
    return <ExamWorkspace exam={activeExam} onExit={() => setActiveExamId(null)} />;
  }

  const dueExams = exams.filter((exam) => exam.submission?.status !== "graded");
  const pastExams = exams.filter((exam) => exam.submission?.status === "graded");

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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
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
        <div>
          <p className="mb-3 text-sm text-foreground/80">{t("submittedBody")}</p>
          <Button size="sm" variant="outline" onClick={onOpen}>
            {t("resubmit")}
          </Button>
        </div>
      )}
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
      <p className="text-sm text-foreground">
        {t("questionLabel", { number })}. {question.text}
      </p>
      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a local/optimizable asset
        <img src={question.imageUrl} alt="" className="max-w-sm rounded-md border border-border" />
      )}
    </div>
  );
}

/** MCQ questions are answered directly in the app, not written on paper —
 * see the note on `submitExam` for why this is the piece that lets a
 * pure-MCQ exam skip the photo-upload flow entirely. */
function McqQuestionBlock({
  question,
  number,
  selectedOptionId,
  onSelect,
}: {
  question: StudentExamQuestion;
  number: number;
  selectedOptionId: string | undefined;
  onSelect: (optionId: string) => void;
}) {
  const t = useTranslations("studentDashboard.exams");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-foreground">
        {t("questionLabel", { number })}. {question.text}
      </p>
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
                type="radio"
                name={`mcq-${question.id}`}
                checked={selectedOptionId === option.id}
                onChange={() => onSelect(option.id)}
                className="accent-primary"
              />
              <span className="font-mono text-xs text-muted-foreground">
                {String.fromCharCode(65 + optionIndex)}.
              </span>
              <span>{option.text}</span>
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

function ExamWorkspace({ exam, onExit }: { exam: StudentExamRow; onExit: () => void }) {
  const t = useTranslations("studentDashboard.exams");
  const router = useRouter();
  const [photos, setPhotos] = useState<File[]>([]);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoGrade, setAutoGrade] = useState<{ score: number; maxScore: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const mcqQuestions = exam.questions.filter((q) => q.type === "mcq");
  const essayQuestions = exam.questions.filter((q) => q.type !== "mcq");
  const allMcqAnswered = mcqQuestions.every((q) => Boolean(mcqAnswers[q.id]));
  const canSubmit = allMcqAnswered && (essayQuestions.length === 0 || photos.length > 0);

  function handleAdd(fileList: FileList | null) {
    if (!fileList) return;
    setPhotos((prev) => [...prev, ...Array.from(fileList)]);
  }

  function handleRemove(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("examId", exam.id);
    formData.set("mcqAnswers", JSON.stringify(mcqAnswers));
    for (const photo of photos) formData.append("photos", photo);
    const result = await submitExam(formData);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAutoGrade(result.autoGrade ?? null);
    setSubmitted(true);
    router.refresh();
  }

  if (submitted) {
    return (
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
          <Button className="mt-4" size="sm" variant="outline" onClick={onExit}>
            {t("backToExams")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-160">
      <div className="mb-4">
        <h1 className="mb-1 text-2xl">{exam.title}</h1>
        <p className="text-sm text-muted-foreground">{t("durationLabel", { minutes: exam.durationMinutes })}</p>
      </div>

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
                  selectedOptionId={mcqAnswers[q.id]}
                  onSelect={(optionId) => setMcqAnswers((prev) => ({ ...prev, [q.id]: optionId }))}
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
        <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
          {t("submitExam")}
        </Button>
        <Button variant="outline" onClick={onExit} disabled={saving}>
          {t("backToExams")}
        </Button>
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>
    </div>
  );
}
