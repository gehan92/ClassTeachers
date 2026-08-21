"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createQuestion } from "@/lib/dashboard/question-bank-actions";
import type { QuestionBankItem } from "@/types/dashboard-exams";
import type { GradeBand } from "@/types/grade-band";
import { cn } from "@/lib/utils";

const GRADE_BANDS: GradeBand[] = ["1-5", "6-9", "10-11", "12-13", "campus"];
const ALL_GRADES = "all";
const ALL_BATCHES = "all";
const NO_BATCH = "none";

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

  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [gradeBand, setGradeBand] = useState<GradeBand>("12-13");
  const [batchId, setBatchId] = useState<string>(NO_BATCH);
  const [difficulty, setDifficulty] = useState<QuestionBankItem["difficulty"]>("medium");
  const [marks, setMarks] = useState("1");
  const [type, setType] = useState<QuestionBankItem["type"]>("mcq");
  const [optionTexts, setOptionTexts] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState("0");
  const [added, setAdded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      const matchesSearch = !q || item.topic.toLowerCase().includes(q) || item.text.toLowerCase().includes(q);
      const matchesGrade = gradeFilter === ALL_GRADES || item.gradeBand === gradeFilter;
      const matchesBatch = batchFilter === ALL_BATCHES || item.batchId === batchFilter;
      return matchesSearch && matchesGrade && matchesBatch;
    });
  }, [questions, search, gradeFilter, batchFilter]);

  function resetForm() {
    setText("");
    setTopic("");
    setGradeBand("12-13");
    setBatchId(NO_BATCH);
    setDifficulty("medium");
    setMarks("1");
    setType("mcq");
    setOptionTexts(["", "", "", ""]);
    setCorrectIndex("0");
  }

  async function handleAdd() {
    if (!text.trim() || !topic.trim()) return;
    const localId = `q-${Date.now()}`;
    const options =
      type === "mcq"
        ? optionTexts.map((optText, i) => ({
            id: `${localId}-o${i + 1}`,
            text: optText.trim() || t("form.optionFallback", { number: i + 1 }),
          }))
        : undefined;
    const correctOptionId = type === "mcq" ? options?.[Number(correctIndex)]?.id : undefined;

    setSaving(true);
    setError(null);
    const result = await createQuestion({
      ownerType: "teacher",
      text: text.trim(),
      topic: topic.trim(),
      gradeBand,
      batchId: batchId === NO_BATCH ? undefined : batchId,
      type,
      difficulty,
      marks,
      options,
      correctOptionId,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    resetForm();
    setAdding(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    router.refresh();
  }

  function handleCancel() {
    resetForm();
    setAdding(false);
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
          <Button type="button" onClick={() => setAdding((v) => !v)}>
            {t("addQuestion")}
          </Button>
        </div>
      </div>

      {adding && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-4 text-lg">{t("form.title")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="qb-text">{t("form.textLabel")}</Label>
              <Textarea
                id="qb-text"
                placeholder={t("form.textPlaceholder")}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qb-topic">{t("form.topicLabel")}</Label>
              <Input
                id="qb-topic"
                placeholder={t("form.topicPlaceholder")}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qb-marks">{t("form.marksLabel")}</Label>
              <Input
                id="qb-marks"
                type="number"
                min="1"
                inputMode="numeric"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qb-grade">{t("form.gradeLabel")}</Label>
              <Select value={gradeBand} onValueChange={(value) => setGradeBand(value as GradeBand)}>
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
              <Select value={batchId} onValueChange={(value) => setBatchId(value as string)}>
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
                value={difficulty}
                onValueChange={(value) => setDifficulty(value as QuestionBankItem["difficulty"])}
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
              <Label>{t("form.typeLabel")}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={type === "mcq" ? "default" : "outline"}
                  onClick={() => setType("mcq")}
                >
                  {t("form.typeMcq")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={type === "essay" ? "default" : "outline"}
                  onClick={() => setType("essay")}
                >
                  {t("form.typeEssay")}
                </Button>
              </div>
            </div>

            {type === "mcq" && (
              <div className="grid gap-2 sm:col-span-2">
                <Label>{t("form.optionsLabel")}</Label>
                <RadioGroup value={correctIndex} onValueChange={setCorrectIndex}>
                  {optionTexts.map((val, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <RadioGroupItem value={String(i)} />
                      <Input
                        placeholder={t("form.optionPlaceholder", { number: i + 1 })}
                        value={val}
                        onChange={(e) =>
                          setOptionTexts((opts) => opts.map((o, idx) => (idx === i ? e.target.value : o)))
                        }
                      />
                    </div>
                  ))}
                </RadioGroup>
                <p className="text-xs text-muted-foreground">{t("form.correctHint")}</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleAdd} disabled={saving}>
              {tc("add")}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
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
                <TableHead>{t("columns.difficulty")}</TableHead>
                <TableHead>{t("columns.marks")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="max-w-80 truncate text-foreground">{q.text}</TableCell>
                  <TableCell className="text-muted-foreground">{q.topic}</TableCell>
                  <TableCell className="text-muted-foreground">{tg(`grades.${q.gradeBand}`)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {q.batchId ? batches.find((b) => b.id === q.batchId)?.title ?? q.batchId : t("batchAnyLabel")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t(`typeLabel.${q.type}`)}</TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
