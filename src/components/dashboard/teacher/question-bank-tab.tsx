"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ImagePlus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
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

type OptionRow = {
  id: string; // "" means this row didn't exist before this edit
  text: string;
  existingImageUrl: string | null;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  removeImage: boolean;
};

type FormState = {
  text: string;
  topic: string;
  gradeBand: GradeBand;
  batchId: string;
  difficulty: QuestionBankItem["difficulty"];
  marks: string;
  type: QuestionBankItem["type"];
  language: QuestionBankItem["language"];
  optionRows: OptionRow[];
  /** More than one checked = "select all that apply" for students. */
  correctIndexes: Set<number>;
  questionImageExistingUrl: string | null;
  questionImageFile: File | null;
  questionImagePreviewUrl: string | null;
  removeQuestionImage: boolean;
};

function blankOptionRow(): OptionRow {
  return { id: "", text: "", existingImageUrl: null, imageFile: null, imagePreviewUrl: null, removeImage: false };
}

function blankForm(): FormState {
  return {
    text: "",
    topic: "",
    gradeBand: "12-13",
    batchId: NO_BATCH,
    difficulty: "medium",
    marks: "1",
    type: "mcq",
    language: "en",
    optionRows: [blankOptionRow(), blankOptionRow(), blankOptionRow(), blankOptionRow()],
    correctIndexes: new Set([0]),
    questionImageExistingUrl: null,
    questionImageFile: null,
    questionImagePreviewUrl: null,
    removeQuestionImage: false,
  };
}

function ImagePicker({
  existingUrl,
  previewUrl,
  removed,
  onPick,
  onClear,
  addLabel,
  removeLabel,
  small,
}: {
  existingUrl: string | null;
  previewUrl: string | null;
  removed: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
  addLabel: string;
  removeLabel: string;
  small?: boolean;
}) {
  const shownUrl = previewUrl ?? (removed ? null : existingUrl);
  if (shownUrl) {
    return (
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL or a local blob: object preview */}
        <img
          src={shownUrl}
          alt=""
          className={cn("rounded-sm border border-border object-cover", small ? "size-12" : "h-24 w-32")}
        />
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          {removeLabel}
        </Button>
      </div>
    );
  }
  return (
    <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
      <ImagePlus className="size-3.5" />
      {addLabel}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

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
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  // Read straight from the prop, not a useState snapshot — a useState
  // initializer only runs once, on mount, so after create/edit/delete
  // refresh the router and the server sends a fresh initialQuestions prop, a
  // useState copy would keep showing the stale list until a full page
  // reload remounts the component. Every sibling tab (Notes, Assignments,
  // Live Classes, Exams) already reads its list prop directly for this
  // exact reason — this one didn't, and that's what made delete/edit look
  // like they "didn't work" until the browser was manually refreshed.
  const questions = initialQuestions;

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>(ALL_GRADES);
  const [batchFilter, setBatchFilter] = useState<string>(ALL_BATCHES);
  const [languageFilter, setLanguageFilter] = useState<string>(ALL_LANGUAGES);

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [added, setAdded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  // Blob: object URLs from freshly picked files are only ever read while
  // the form is open — revoke them on unmount/reset so they don't leak.
  useEffect(() => {
    return () => {
      if (form.questionImagePreviewUrl) URL.revokeObjectURL(form.questionImagePreviewUrl);
      for (const row of form.optionRows) if (row.imagePreviewUrl) URL.revokeObjectURL(row.imagePreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup runs only on unmount, not on every keystroke
  }, []);

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
    setForm(blankForm());
    setEditingId(null);
    setError(null);
    setFormMode("create");
  }

  function openEdit(question: QuestionBankItem) {
    const optionRows: OptionRow[] = (question.options ?? []).map((o) => ({
      id: o.id,
      text: o.text,
      existingImageUrl: o.imageUrl ?? null,
      imageFile: null,
      imagePreviewUrl: null,
      removeImage: false,
    }));
    while (optionRows.length < 4) optionRows.push(blankOptionRow());
    const correctIds = new Set(question.correctOptionIds ?? []);
    const correctIndexes = new Set(
      (question.options ?? []).flatMap((o, i) => (correctIds.has(o.id) ? [i] : [])),
    );
    setForm({
      text: question.text,
      topic: question.topic,
      gradeBand: question.gradeBand,
      batchId: question.batchId ?? NO_BATCH,
      difficulty: question.difficulty,
      marks: String(question.marks),
      type: question.type,
      language: question.language,
      optionRows,
      correctIndexes: correctIndexes.size > 0 ? correctIndexes : new Set([0]),
      questionImageExistingUrl: question.imageUrl ?? null,
      questionImageFile: null,
      questionImagePreviewUrl: null,
      removeQuestionImage: false,
    });
    setEditingId(question.id);
    setError(null);
    setFormMode("edit");
  }

  function closeForm() {
    if (form.questionImagePreviewUrl) URL.revokeObjectURL(form.questionImagePreviewUrl);
    for (const row of form.optionRows) if (row.imagePreviewUrl) URL.revokeObjectURL(row.imagePreviewUrl);
    setFormMode(null);
    setEditingId(null);
    setForm(blankForm());
    setError(null);
  }

  function addOption() {
    setForm((f) => (f.optionRows.length >= MAX_OPTIONS ? f : { ...f, optionRows: [...f.optionRows, blankOptionRow()] }));
  }

  function removeOption(index: number) {
    setForm((f) => {
      if (f.optionRows.length <= MIN_OPTIONS) return f;
      const removedRow = f.optionRows[index];
      if (removedRow.imagePreviewUrl) URL.revokeObjectURL(removedRow.imagePreviewUrl);
      const optionRows = f.optionRows.filter((_, i) => i !== index);
      const correctIndexes = new Set(
        [...f.correctIndexes].flatMap((i) => {
          if (i === index) return [];
          return [i > index ? i - 1 : i];
        }),
      );
      return { ...f, optionRows, correctIndexes: correctIndexes.size > 0 ? correctIndexes : new Set([0]) };
    });
  }

  function updateOptionRow(index: number, patch: Partial<OptionRow>) {
    setForm((f) => ({ ...f, optionRows: f.optionRows.map((row, i) => (i === index ? { ...row, ...patch } : row)) }));
  }

  function toggleCorrectIndex(index: number) {
    setForm((f) => {
      const next = new Set(f.correctIndexes);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { ...f, correctIndexes: next };
    });
  }

  function pickOptionImage(index: number, file: File) {
    setForm((f) => {
      const row = f.optionRows[index];
      if (row.imagePreviewUrl) URL.revokeObjectURL(row.imagePreviewUrl);
      const optionRows = f.optionRows.map((r, i) =>
        i === index ? { ...r, imageFile: file, imagePreviewUrl: URL.createObjectURL(file), removeImage: false } : r,
      );
      return { ...f, optionRows };
    });
  }

  function clearOptionImage(index: number) {
    setForm((f) => {
      const row = f.optionRows[index];
      if (row.imagePreviewUrl) URL.revokeObjectURL(row.imagePreviewUrl);
      const optionRows = f.optionRows.map((r, i) =>
        i === index ? { ...r, imageFile: null, imagePreviewUrl: null, removeImage: true } : r,
      );
      return { ...f, optionRows };
    });
  }

  function pickQuestionImage(file: File) {
    setForm((f) => {
      if (f.questionImagePreviewUrl) URL.revokeObjectURL(f.questionImagePreviewUrl);
      return { ...f, questionImageFile: file, questionImagePreviewUrl: URL.createObjectURL(file), removeQuestionImage: false };
    });
  }

  function clearQuestionImage() {
    setForm((f) => {
      if (f.questionImagePreviewUrl) URL.revokeObjectURL(f.questionImagePreviewUrl);
      return { ...f, questionImageFile: null, questionImagePreviewUrl: null, removeQuestionImage: true };
    });
  }

  async function handleSubmit() {
    if (!form.text.trim() || !form.topic.trim()) return;

    const fd = new FormData();
    if (formMode !== "edit") fd.set("ownerType", "teacher");
    fd.set("text", form.text.trim());
    fd.set("topic", form.topic.trim());
    fd.set("gradeBand", form.gradeBand);
    if (form.batchId !== NO_BATCH) fd.set("batchId", form.batchId);
    fd.set("type", form.type);
    fd.set("difficulty", form.difficulty);
    fd.set("marks", form.marks);
    fd.set("language", form.language);
    fd.set("correctIndexes", JSON.stringify([...form.correctIndexes]));
    if (form.questionImageFile) fd.set("questionImage", form.questionImageFile);
    if (form.removeQuestionImage) fd.set("removeQuestionImage", "1");

    if (form.type === "mcq") {
      const rows = form.optionRows.filter((row) => row.text.trim());
      fd.set("optionCount", String(form.optionRows.length));
      form.optionRows.forEach((row, i) => {
        fd.set(`optionText-${i}`, row.text.trim() || t("form.optionFallback", { number: i + 1 }));
        if (row.id) fd.set(`optionId-${i}`, row.id);
        if (row.imageFile) fd.set(`optionImage-${i}`, row.imageFile);
        if (row.removeImage) fd.set(`optionRemoveImage-${i}`, "1");
      });
      if (rows.length < MIN_OPTIONS) {
        setError(t("form.correctHint"));
        return;
      }
      if (form.correctIndexes.size === 0) {
        setError(t("form.correctHint"));
        return;
      }
    }

    setSaving(true);
    setError(null);
    const result =
      formMode === "edit" && editingId ? await updateQuestion(editingId, fd) : await createQuestion(fd);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    closeForm();
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    refresh();
  }

  async function handleDelete(questionId: string) {
    setDeletingId(questionId);
    const result = await deleteQuestion(questionId);
    setDeletingId(null);
    if (!result.error) {
      refresh();
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

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
      />

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
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>{t("form.questionImageLabel")}</Label>
              <ImagePicker
                existingUrl={form.questionImageExistingUrl}
                previewUrl={form.questionImagePreviewUrl}
                removed={form.removeQuestionImage}
                onPick={pickQuestionImage}
                onClear={clearQuestionImage}
                addLabel={t("form.addImage")}
                removeLabel={t("form.removeImage")}
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
                <div className="flex flex-col gap-2">
                  {form.optionRows.map((row, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-2.5">
                      <div className="flex items-center gap-2.5">
                        <Checkbox checked={form.correctIndexes.has(i)} onCheckedChange={() => toggleCorrectIndex(i)} />
                        <Input
                          placeholder={t("form.optionPlaceholder", { number: i + 1 })}
                          value={row.text}
                          onChange={(e) => updateOptionRow(i, { text: e.target.value })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 px-2 text-muted-foreground hover:text-destructive"
                          disabled={form.optionRows.length <= MIN_OPTIONS}
                          onClick={() => removeOption(i)}
                          aria-label={t("form.removeOption")}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                      <div className="ml-6">
                        <ImagePicker
                          existingUrl={row.existingImageUrl}
                          previewUrl={row.imagePreviewUrl}
                          removed={row.removeImage}
                          onPick={(file) => pickOptionImage(i, file)}
                          onClear={() => clearOptionImage(i)}
                          addLabel={t("form.addImage")}
                          removeLabel={t("form.removeImage")}
                          small
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit gap-1.5"
                  disabled={form.optionRows.length >= MAX_OPTIONS}
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
                        <p className="mb-2 text-sm whitespace-pre-wrap text-foreground">{q.text}</p>
                        {q.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL
                          <img src={q.imageUrl} alt="" className="mb-3 max-w-sm rounded-md border border-border" />
                        )}
                        {q.type === "mcq" && q.options && (
                          <ul className="flex flex-col gap-1.5">
                            {q.options.map((option) => {
                              const isCorrect = (q.correctOptionIds ?? []).includes(option.id);
                              return (
                                <li
                                  key={option.id}
                                  className={cn(
                                    "flex flex-wrap items-center gap-2 rounded-sm border px-2.5 py-1.5 text-sm",
                                    isCorrect
                                      ? "border-success bg-success/10 font-medium text-success"
                                      : "border-border text-foreground/80",
                                  )}
                                >
                                  {isCorrect ? <Check className="size-3.5 shrink-0" /> : <span className="size-3.5 shrink-0" />}
                                  {option.text}
                                  {option.imageUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL
                                    <img src={option.imageUrl} alt="" className="h-12 w-12 rounded-sm border border-border object-cover" />
                                  )}
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
