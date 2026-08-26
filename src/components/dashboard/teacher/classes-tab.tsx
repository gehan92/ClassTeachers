"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { createBatch } from "@/lib/dashboard/batches-actions";
import type { GradeBand } from "@/types/grade-band";

const GRADE_BANDS: GradeBand[] = ["1-5", "6-9", "10-11", "12-13", "campus"];

export type TeacherBatchRow = {
  id: string;
  title: string;
  mode: "online" | "physical";
  location: string | null;
  scheduleNote: string | null;
  gradeBand: GradeBand | null;
};

export type BatchRosterEntry = {
  name: string;
  joinedAt: string;
  phone: string | null;
};

export function ClassesTab({
  batches,
  rosterByBatch,
}: {
  batches: TeacherBatchRow[];
  rosterByBatch: Record<string, BatchRosterEntry[]>;
}) {
  const t = useTranslations("teacherDashboard.classes");
  const tc = useTranslations("teacherDashboard.common");
  const tg = useTranslations("search");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"online" | "physical">("physical");
  const [location, setLocation] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [gradeBand, setGradeBand] = useState<GradeBand>("12-13");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function resetForm() {
    setTitle("");
    setMode("physical");
    setLocation("");
    setScheduleNote("");
    setGradeBand("12-13");
  }

  async function handleAdd() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const result = await createBatch({
      ownerType: "teacher",
      title,
      mode,
      location,
      scheduleNote,
      gradeBand,
    });
    setCreating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    resetForm();
    setShowForm(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    refresh();
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
          <Button onClick={() => setShowForm((v) => !v)}>{t("addBatch")}</Button>
        </div>
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
      />

      {showForm && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-4 text-lg">{t("form.title")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="batch-title">{t("form.titleLabel")}</Label>
              <Input
                id="batch-title"
                placeholder={t("form.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-mode">{t("form.modeLabel")}</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as "online" | "physical")}>
                <SelectTrigger id="batch-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical">{t("form.modePhysical")}</SelectItem>
                  <SelectItem value="online">{t("form.modeOnline")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-grade">{t("form.gradeLabel")}</Label>
              <Select value={gradeBand} onValueChange={(value) => setGradeBand(value as GradeBand)}>
                <SelectTrigger id="batch-grade" className="w-full">
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
              <Label htmlFor="batch-location">{t("form.locationLabel")}</Label>
              <Input
                id="batch-location"
                placeholder={t("form.locationPlaceholder")}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-schedule">{t("form.scheduleLabel")}</Label>
              <Input
                id="batch-schedule"
                placeholder={t("form.schedulePlaceholder")}
                value={scheduleNote}
                onChange={(e) => setScheduleNote(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={handleAdd} disabled={creating}>
              {t("form.submit")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              {tc("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
          {t("emptyState")}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {batches.map((batch) => {
            const roster = rosterByBatch[batch.id] ?? [];
            return (
              <div key={batch.id} className="rounded-lg border border-border bg-white p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg text-foreground">{batch.title}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {batch.gradeBand ? `${tg(`grades.${batch.gradeBand}`)} · ` : ""}
                      {batch.mode === "online" ? t("form.modeOnline") : t("form.modePhysical")}
                      {batch.location ? ` · ${batch.location}` : ""}
                      {batch.scheduleNote ? ` · ${batch.scheduleNote}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                    {t("studentCount", { count: roster.length })}
                  </span>
                </div>

                {roster.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("columns.student")}</TableHead>
                        <TableHead>{t("columns.joined")}</TableHead>
                        <TableHead>{t("columns.contact")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roster.map((student, i) => (
                        <TableRow key={`${batch.id}-${i}`}>
                          <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                          <TableCell className="text-muted-foreground">{student.joinedAt}</TableCell>
                          <TableCell className="text-muted-foreground">{student.phone ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
