"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { createBatch } from "@/lib/dashboard/batches-actions";

export type InstituteBatchRow = {
  id: string;
  title: string;
  mode: "online" | "physical";
  location: string | null;
  scheduleNote: string | null;
  teacherLabel: string | null;
  studentCount: number;
};

export type InstituteRosterTeacherOption = {
  id: string;
  name: string;
};

export function BatchesTab({
  batches,
  teacherOptions,
}: {
  batches: InstituteBatchRow[];
  teacherOptions: InstituteRosterTeacherOption[];
}) {
  const t = useTranslations("instituteDashboard.batches");
  const tc = useTranslations("instituteDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [mode, setMode] = useState<"online" | "physical">("physical");
  const [schedule, setSchedule] = useState("");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function resetForm() {
    setTitle("");
    setTeacherId("");
    setMode("physical");
    setSchedule("");
  }

  async function handleAdd() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const result = await createBatch({
      ownerType: "class",
      title,
      mode,
      location: "",
      scheduleNote: schedule,
      taughtByTeacherId: teacherId || undefined,
      gradeBand: "",
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
          <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {added && <span className="text-sm font-medium text-success">{t("added")}</span>}
          <Button onClick={() => setShowForm(true)}>{t("addBatch")}</Button>
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
            <div className="grid gap-1.5">
              <Label htmlFor="batch-title">{t("form.titleLabel")}</Label>
              <Input
                id="batch-title"
                placeholder={t("form.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-teacher">{t("form.teacherLabel")}</Label>
              {teacherOptions.length > 0 ? (
                <Select value={teacherId} onValueChange={(value) => setTeacherId(value ?? "")}>
                  <SelectTrigger id="batch-teacher" className="w-full">
                    <SelectValue placeholder={t("form.teacherPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">{t("form.teacherSelectEmpty")}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-schedule">{t("form.scheduleLabel")}</Label>
              <Input
                id="batch-schedule"
                placeholder={t("form.schedulePlaceholder")}
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
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
              {t("cancel")}
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
        <div className="flex flex-col gap-4">
          {batches.map((batch) => (
            <div key={batch.id} className="rounded-lg border border-border bg-white p-4.5">
              <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-display text-base text-primary">{batch.title}</div>
                  {batch.teacherLabel && (
                    <div className="mt-0.5 text-[13px] text-muted-foreground">{batch.teacherLabel}</div>
                  )}
                </div>
                <span className="rounded-full bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  {t("studentCount", { count: batch.studentCount })}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground/80">
                  {batch.mode === "online" ? t("form.modeOnline") : t("form.modePhysical")}
                </span>
                {batch.location && (
                  <span className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground/80">
                    {batch.location}
                  </span>
                )}
                {batch.scheduleNote && (
                  <span className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground/80">
                    {batch.scheduleNote}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
