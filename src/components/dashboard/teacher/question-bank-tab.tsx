"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createQuestion, updateQuestion, deleteQuestion } from "@/lib/dashboard/question-bank-actions";
import type { QuestionBankItem } from "@/types/dashboard-exams";
import type { GradeBand } from "@/types/grade-band";
import { cn } from "@/lib/utils";

const GRADE_BANDS: GradeBand[] = ["1-5", "6-9", "10-11", "12-13", "campus"];
const LANGUAGES: QuestionBankItem["language"][] = ["en", "si", "ta"];
const ALL_GRADES = "all";
const ALL_BATCHES = "all";
const ALL_LANGUAGES = "all";
const NO_BATCH = "none";
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

type FormState = {
  text: string;
  topic: string;
  gradeBand: GradeBand;
  batchId: string;
  difficulty: QuestionBankItem["difficulty"];
  marks: string;
  type: QuestionBankItem["type"];
  language: QuestionBankItem["language"];
  optionTexts: string[];
  correctIndex: string;
};

const BLANK_FORM: FormState = {
  text: "",
  topic: "",
  gradeBand: "12-13",
  batchId: NO_BATCH,
  difficulty: "medium",
  marks: "1",
  type: "mcq",
  language: "en",
  optionTexts: ["", "", "", ""],
  correctIndex: "0",
};

export function QuestionBankTab({
  initialQuestions,
  batches,
}: {
  initialQuestions: QuestionBankItem[];
  batches: { id: string; title: string }[];
}) {
  const t = useTranslations("teacherDashboard.questionBank");
  const tc = useTranslations("teacherDashboard.common");
  const tg = useTranslations("search");
  const router = useRouter();

  const [questions] = useState<QuestionBankItem[]>(initialQuestions);

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>(ALL_GRADES);
  const [batchFilter, setBatchFilter] = useState<string>(ALL_BATCHES);
  const [languageFilter, setLanguageFilter] = useState<string>(ALL_LANGUAGES);

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [added, setAdded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      const matchesSearch = !q || item.topic.toLowerCase().includes(q) || item.text.toLowerCase().includes(q);
      const matchesGrade = gradeFilter === ALL_GRADES || item.gradeBand === gradeFilter;
      const matchesBatch = batchFilter === ALL_BATCHES || item.batchId === batchFilter;
      const matchesLanguage = languageFilter === ALL_LANGUAGES || item.language === languageFilter;
      return matchesSearch && matchesGrade && matchesBatch && matchesLanguage;
    });
  }, [questions, search, gradeFilter, batchFilter, languageFilter]);

  function openCreate() {
    setForm(BLANK_FORM);
    setEditingId(null);
    setError(null);
    setFormMode("create");
  }

  function openEdit(question: QuestionBankItem) {
    const optionTexts = question.options?.map((o) => o.text) ?? ["", "", "", ""];
    const correctIndex = question.options?.findIndex((o) => o.id === question.correctOptionId) ?? 0;
    setForm({
      text: question.text,
      topic: question.topic,
      gradeBand: question.gradeBand,
      batchId: question.batchId ?? NO_BATCH,
      difficulty: question.difficulty,
      marks: String(question.marks),
      type: question.type,
      language: question.language,
      optionTexts: optionTexts.length >= MIN_OPTIONS ? optionTexts : ["", "", "", ""],
      correctIndex: String(Math.max(correctIndex, 0)),
    });
    setEditingId(question.id);
    setError(null);
    setFormMode("edit");
  }

  function closeForm() {
    setFormMode(null);
    setEditingId(null);
    setForm(BLANK_FORM);
    setError(null);
  }

  function addOption() {
    setForm((f) => (f.optionTexts.length >= MAX_OPTIONS ? f : { ...f, optionTexts: [...f.optionTexts, ""] }));
  }

  function removeOption(index: number) {
    setForm((f) => {
      if (f.optionTexts.length <= MIN_OPTIONS) return f;
      const optionTexts = f.optionTexts.filter((_, i) => i !== index);
      const removedIndex = Number(f.correctIndex);
      let correctIndex = removedIndex;
      if (removedIndex === index) correctIndex = 0;
      else if (removedIndex > index) correctIndex = removedIndex - 1;
      return { ...f, optionTexts, correctIndex: String(correctIndex) };
    });
  }

  async function handleSubmit() {
    if (!form.text.trim() || !form.topic.trim()) return;
    const localId = editingId ?? `q-${Date.now()}`;
    const options =
      form.type === "mcq"
        ? form.optionTexts.map((optText, i) => ({
            id: `${localId}-o${i + 1}`,
            text: optText.trim() || t("form.optionFallback", { number: i + 1 }),
          }))
        : undefined;
    const correctOptionId = form.type === "mcq" ? options?.[Number(form.correctIndex)]?.id : undefined;

    setSaving(true);
    setError(null);
    const result =
      formMode === "edit" && editingId
        ? await updateQuestion(editingId, {
            text: form.text.trim(),
            topic: form.topic.trim(),
            gradeBand: form.gradeBand,
            batchId: form.batchId === NO_BATCH ? undefined : form.batchId,
            type: form.type,
            difficulty: form.difficulty,
            marks: form.marks,
            language: form.language,
            options,
            correctOptionId,
          })
        : await createQuestion({
            ownerType: "teacher",
            text: form.text.trim(),
            topic: form.topic.trim(),
            gradeBand: form.gradeBand,
            batchId: form.batchId === NO_BATCH ? undefined : form.batchId,
            type: form.type,
            difficulty: form.difficulty,
            marks: form.marks,
            language: form.language,
            options,
            correctOptionId,
          });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    closeForm();
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    router.refresh();
  }

  async function handleDelete(questionId: string) {
    setDeletingId(questionId);
    const result = await deleteQuestion(questionId);
    setDeletingId(null);
    if (!result.error) {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {added && <span className="text-sm font-medium text-success">{tc("added")}</span>}
          <Button type="button" onClick={() => (formMode ? closeForm() : openCreate())}>
            {t("addQuestion")}
          </Button>
        </div>
      </div>

      {formMode && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-4 text-lg">{formMode === "edit" ? t("form.editTitle") : t("form.title")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="qb-text">{t("form.textLabel")}</Label>
              <Textarea
                id="qb-text"
                placeholder={t("form.textPlaceholder")}
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qb-topic">{t("form.topicLabel")}</Label>
              <Input
                id="qb-topic"
                placeholder={t("form.topicPlaceholder")}
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qb-marks">{t("form.marksLabel")}</Label>
              <Input
                id="qb-marks"
                type="number"
                min="1"
                inputMode="numeric"
                value={form.marks}
                onChange={(e) => setForm((f) => ({ ...f, marks: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qb-grade">{t("form.gradeLabel")}</Label>
              <Select
                value={form.gradeBand}
                onValueChange={(value) => setForm((f) => ({ ...f, gradeBand: value as GradeBand }))}
              >
                <SelectTrigger id="qb-grade" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_BANDS.map((band) => (
                    <SelectItem key={band} value={band}>
                      {tg(`grades.${band}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qb-batch">{t("form.batchLabel")}</Label>
              <Select value={form.batchId} onValueChange={(value) => setForm((f) => ({ ...f, batchId: value ?? NO_BATCH }))}>
                <SelectTrigger id="qb-batch" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BATCH}>{t("form.batchAny")}</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qb-difficulty">{t("form.difficultyLabel")}</Label>
              <Select
                value={form.difficulty}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, difficulty: value as QuestionBankItem["difficulty"] }))
                }
              >
                <SelectTrigger id="qb-difficulty" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">{t("difficultyLabel.easy")}</SelectItem>
                  <SelectItem value="medium">{t("difficultyLabel.medium")}</SelectItem>
                  <SelectItem value="hard">{t("difficultyLabel.hard")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qb-language">{t("form.languageLabel")}</Label>
              <Select
                value={form.language}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, language: value as QuestionBankItem["language"] }))
                }
              >
                <SelectTrigger id="qb-language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {t(`languages.${lang}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("form.typeLabel")}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={form.type === "mcq" ? "default" : "outline"}
                  onClick={() => setForm((f) => ({ ...f, type: "mcq" }))}
                >
                  {t("form.typeMcq")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={form.type === "essay" ? "default" : "outline"}
                  onClick={() => setForm((f) => ({ ...f, type: "essay" }))}
                >
                  {t("form.typeEssay")}
                </Button>
              </div>
            </div>

            {form.type === "mcq" && (
              <div className="grid gap-2 sm:col-span-2">
                <Label>{t("form.optionsLabel")}</Label>
                <RadioGroup
                  value={form.correctIndex}
                  onValueChange={(value) => setForm((f) => ({ ...f, correctIndex: value }))}
                >
                  {form.optionTexts.map((val, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <RadioGroupItem value={String(i)} />
                      <Input
                        placeholder={t("form.optionPlaceholder", { number: i + 1 })}
                        value={val}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            optionTexts: f.optionTexts.map((o, idx) => (idx === i ? e.target.value : o)),
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 px-2 text-muted-foreground hover:text-destructive"
                        disabled={form.optionTexts.length <= MIN_OPTIONS}
                        onClick={() => removeOption(i)}
                        aria-label={t("form.removeOption")}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </RadioGroup>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit gap-1.5"
                  disabled={form.optionTexts.length >= MAX_OPTIONS}
                  onClick={addOption}
                >
                  <Plus className="size-3.5" />
                  {t("form.addOption")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("form.correctHint")}</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleSubmit} disabled={saving}>
              {formMode === "edit" ? tc("save") : tc("add")}
            </Button>
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>
              {tc("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Input
            placeholder={t("filters.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64"
          />
          <Select value={gradeFilter} onValueChange={(value) => setGradeFilter(value as string)}>
            <SelectTrigger className="w-full sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_GRADES}>{t("filters.allGrades")}</SelectItem>
              {GRADE_BANDS.map((band) => (
                <SelectItem key={band} value={band}>
                  {tg(`grades.${band}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={batchFilter} onValueChange={(value) => setBatchFilter(value as string)}>
            <SelectTrigger className="w-full sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_BATCHES}>{t("filters.allBatches")}</SelectItem>
              {batches.map((batch) => (
                <SelectItem key={batch.id} value={batch.id}>
                  {batch.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={languageFilter} onValueChange={(value) => setLanguageFilter(value as string)}>
            <SelectTrigger className="w-full sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LANGUAGES}>{t("filters.allLanguages")}</SelectItem>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {t(`languages.${lang}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("emptyState")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.question")}</TableHead>
                <TableHead>{t("columns.topic")}</TableHead>
                <TableHead>{t("columns.grade")}</TableHead>
                <TableHead>{t("columns.batch")}</TableHead>
                <TableHead>{t("columns.type")}</TableHead>
                <TableHead>{t("columns.language")}</TableHead>
                <TableHead>{t("columns.difficulty")}</TableHead>
                <TableHead>{t("columns.marks")}</TableHead>
                <TableHead>{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((q) => (
                <Fragment key={q.id}>
                  <TableRow>
                    <TableCell className="max-w-80 truncate text-foreground">{q.text}</TableCell>
                    <TableCell className="text-muted-foreground">{q.topic}</TableCell>
                    <TableCell className="text-muted-foreground">{tg(`grades.${q.gradeBand}`)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {q.batchId ? (batches.find((b) => b.id === q.batchId)?.title ?? q.batchId) : t("batchAnyLabel")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t(`typeLabel.${q.type}`)}</TableCell>
                    <TableCell className="text-muted-foreground">{t(`languages.${q.language}`)}</TableCell>
                    <TableCell
                      className={cn(
                        q.difficulty === "hard" && "text-lock",
                        q.difficulty === "medium" && "text-accent-deep",
                        q.difficulty === "easy" && "text-success",
                      )}
                    >
                      {t(`difficultyLabel.${q.difficulty}`)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{q.marks}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingId((id) => (id === q.id ? null : q.id))}
                        >
                          {viewingId === q.id ? t("hide") : t("view")}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(q)}>
                          {t("edit")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === q.id}
                          onClick={() => handleDelete(q.id)}
                        >
                          {t("delete")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {viewingId === q.id && (
                    <TableRow>
                      <TableCell colSpan={9} className="bg-secondary/20">
                        <p className="mb-3 text-sm whitespace-pre-wrap text-foreground">{q.text}</p>
                        {q.type === "mcq" && q.options && (
                          <ul className="flex flex-col gap-1.5">
                            {q.options.map((option) => {
                              const isCorrect = option.id === q.correctOptionId;
                              return (
                                <li
                                  key={option.id}
                                  className={cn(
                                    "flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-sm",
                                    isCorrect
                                      ? "border-success bg-success/10 font-medium text-success"
                                      : "border-border text-foreground/80",
                                  )}
                                >
                                  {isCorrect ? <Check className="size-3.5 shrink-0" /> : <span className="size-3.5 shrink-0" />}
                                  {option.text}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
