"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/features/status-badge";
import { useLiveCall } from "@/components/dashboard/live-call-context";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { createLiveClass, deleteLiveClass, setAttendanceStatus, sendLiveClassReminder } from "@/lib/dashboard/live-classes-actions";
import { cn } from "@/lib/utils";

export type TeacherLiveClassBatchOption = { id: string; title: string; studentCount: number };
export type TeacherLiveClassStudentOption = { id: string; name: string; batchId: string | null };

export type LiveClassRosterEntry = {
  studentId: string;
  studentName: string;
  status: "present" | "absent" | "late" | null;
};

export type TeacherLiveClassRow = {
  id: string;
  title: string;
  scheduledAtIso: string;
  scheduledLabel: string;
  mode: "online" | "physical";
  location: string | null;
  joinLink: string | null;
  batchId: string | null;
  batchTitle: string | null;
  roster: LiveClassRosterEntry[];
};

const NO_BATCH = "all";
const ATTENDANCE_STATUSES: NonNullable<LiveClassRosterEntry["status"]>[] = ["present", "late", "absent"];

function statusVariant(status: NonNullable<LiveClassRosterEntry["status"]>) {
  if (status === "present") return "active" as const;
  if (status === "late") return "pending" as const;
  return "flagged" as const;
}

export function LiveClassesTab({
  classes,
  hostName,
  batches,
  totalStudentsCount,
  studentPool,
}: {
  classes: TeacherLiveClassRow[];
  hostName: string;
  batches: TeacherLiveClassBatchOption[];
  totalStudentsCount: number;
  studentPool: TeacherLiveClassStudentOption[];
}) {
  const t = useTranslations("teacherDashboard.live");
  const ta = useTranslations("teacherDashboard.attendance");
  const tc = useTranslations("teacherDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const { activeCall, startCall, restoreCall } = useLiveCall();

  const [viewingRosterId, setViewingRosterId] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newMode, setNewMode] = useState<"online" | "physical">("online");
  const [newLocation, setNewLocation] = useState("");
  const [newBatchId, setNewBatchId] = useState<string>(NO_BATCH);
  const [excludedStudentIds, setExcludedStudentIds] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rosterOverrides, setRosterOverrides] = useState<Record<string, NonNullable<LiveClassRosterEntry["status"]>>>({});
  const [savingRosterKey, setSavingRosterKey] = useState<string | null>(null);
  const [remindedKeys, setRemindedKeys] = useState<Set<string>>(new Set());
  const [remindingKey, setRemindingKey] = useState<string | null>(null);

  const poolForNewBatch = studentPool.filter((s) => newBatchId === NO_BATCH || s.batchId === newBatchId);

  function resetForm() {
    setNewTitle("");
    setNewScheduledAt("");
    setNewMode("online");
    setNewLocation("");
    setNewBatchId(NO_BATCH);
    setExcludedStudentIds(new Set());
    setAdding(false);
  }

  function handleBatchChange(value: string | null) {
    setNewBatchId(value ?? NO_BATCH);
    // Different pool of students — a leftover exclusion set from the
    // previous batch wouldn't map to the right people here.
    setExcludedStudentIds(new Set());
  }

  function toggleStudent(studentId: string) {
    setExcludedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function handleAdd() {
    if (!newTitle.trim() || !newScheduledAt) return;
    setSaving(true);
    setError(null);
    // Nothing excluded = every current member of the pool gets in, same as
    // before this feature existed — only send an explicit list when the
    // teacher actually narrowed it down (see the comment on
    // live_class_participants, 0055, for why "everyone" stays unsent).
    const participantStudentIds =
      excludedStudentIds.size > 0
        ? poolForNewBatch.filter((s) => !excludedStudentIds.has(s.id)).map((s) => s.id)
        : undefined;
    const result = await createLiveClass({
      title: newTitle,
      mode: newMode,
      location: newLocation,
      // Converted here, in the browser, so "local" means the teacher's
      // actual timezone — the server has no idea what timezone a bare
      // datetime-local string was picked in.
      scheduledAt: new Date(newScheduledAt).toISOString(),
      durationMinutes: "60",
      batchId: newBatchId !== NO_BATCH ? newBatchId : undefined,
      participantStudentIds,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    resetForm();
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    refresh();
  }

  async function handleDelete(liveClassId: string) {
    setDeletingId(liveClassId);
    const result = await deleteLiveClass(liveClassId);
    setDeletingId(null);
    if (!result.error) {
      refresh();
    }
  }

  async function handleRosterStatus(liveClassId: string, studentId: string, status: NonNullable<LiveClassRosterEntry["status"]>) {
    const key = `${liveClassId}:${studentId}`;
    setSavingRosterKey(key);
    const result = await setAttendanceStatus({ liveClassId, studentId, status });
    setSavingRosterKey(null);
    if (!result.error) {
      setRosterOverrides((prev) => ({ ...prev, [key]: status }));
    }
  }

  async function handleRemind(liveClassId: string, studentId: string) {
    const key = `${liveClassId}:${studentId}`;
    setRemindingKey(key);
    const result = await sendLiveClassReminder({ liveClassId, studentId });
    setRemindingKey(null);
    if (!result.error) {
      setRemindedKeys((prev) => new Set(prev).add(key));
    }
  }

  function handleStartCall(c: TeacherLiveClassRow) {
    if (!c.joinLink) return;
    startCall({
      liveClassId: c.id,
      title: c.title,
      subtitle: c.scheduledLabel,
      roomUrl: c.joinLink,
      displayName: hostName,
      isHost: true,
    });
  }

  const viewingRoster = classes.find((c) => c.id === viewingRosterId) ?? null;
  if (viewingRoster) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">{viewingRoster.title}</div>
            <div className="text-xs text-muted-foreground">
              {viewingRoster.batchTitle ?? t("allStudentsOption")} · {viewingRoster.scheduledLabel}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setViewingRosterId(null)}>
            {tc("close")}
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-white p-5">
          {viewingRoster.roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("rosterEmpty")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {viewingRoster.roster.map((row) => {
                const key = `${viewingRoster.id}:${row.studentId}`;
                const status = rosterOverrides[key] ?? row.status;
                return (
                  <div
                    key={row.studentId}
                    className="flex flex-wrap items-center justify-between gap-2.5 rounded-md border border-border p-3"
                  >
                    <span className="font-medium text-foreground">{row.studentName}</span>
                    <div className="flex items-center gap-2">
                      {status !== "present" &&
                        (remindedKeys.has(key) ? (
                          <span className="text-xs font-medium text-success">{t("reminded")}</span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={remindingKey === key}
                            onClick={() => handleRemind(viewingRoster.id, row.studentId)}
                          >
                            {t("remind")}
                          </Button>
                        ))}
                      {status && <StatusBadge variant={statusVariant(status)}>{ta(`status.${status}`)}</StatusBadge>}
                      <div className="flex gap-1">
                        {ATTENDANCE_STATUSES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={savingRosterKey === key}
                            onClick={() => handleRosterStatus(viewingRoster.id, row.studentId, s)}
                            className={cn(
                              "rounded-sm border px-2 py-0.75 text-[11px] font-medium transition-colors",
                              status === s
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-white text-muted-foreground hover:bg-secondary",
                            )}
                          >
                            {ta(`status.${s}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl">{t("heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" onClick={() => setAdding((v) => !v)}>
            {t("scheduleClass")}
          </Button>
          {added && <span className="animate-in fade-in-0 text-sm font-medium text-success duration-200">{tc("added")}</span>}
        </div>
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
      />

      {adding && (
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              placeholder={t("classTitlePlaceholder")}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="sm:col-span-2"
            />
            <Input type="datetime-local" value={newScheduledAt} onChange={(e) => setNewScheduledAt(e.target.value)} />
            <Select value={newMode} onValueChange={(value) => setNewMode(value as "online" | "physical")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">{t("online")}</SelectItem>
                <SelectItem value="physical">{t("physical")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newBatchId} onValueChange={handleBatchChange}>
              <SelectTrigger className="w-full sm:col-span-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BATCH}>
                  {t("allStudentsOption")} ({totalStudentsCount})
                </SelectItem>
                {batches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.title} ({batch.studentCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {poolForNewBatch.length > 0 && (
              <div className="rounded-md border border-border p-3 sm:col-span-2">
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={excludedStudentIds.size === 0}
                    onChange={(e) => setExcludedStudentIds(e.target.checked ? new Set() : new Set(poolForNewBatch.map((s) => s.id)))}
                  />
                  {t("selectAll")}
                </label>
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {poolForNewBatch.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={!excludedStudentIds.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {newMode === "physical" ? (
              <Input
                placeholder={t("locationPlaceholder")}
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="sm:col-span-2"
              />
            ) : (
              <p className="self-center text-xs text-muted-foreground sm:col-span-2">{t("videoRoomAutoNote")}</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button type="button" onClick={handleAdd} disabled={saving}>
              {tc("add")}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
              {tc("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.class")}</TableHead>
                <TableHead>{t("columns.dayTime")}</TableHead>
                <TableHead>{t("columns.mode")}</TableHead>
                <TableHead>{t("columns.joinLink")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-foreground">
                    {c.title}
                    <div className="text-xs font-normal text-muted-foreground">{c.batchTitle ?? t("allStudentsOption")}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.scheduledLabel}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.mode === "online" ? t("online") : t("physicalAt", { location: c.location ?? "" })}
                  </TableCell>
                  <TableCell className="min-w-32">
                    {c.mode === "online" && c.joinLink ? (
                      activeCall?.liveClassId === c.id ? (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-success text-success-foreground hover:bg-success/90"
                          onClick={restoreCall}
                        >
                          {t("returnToCallAction")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!!activeCall}
                          title={activeCall ? t("inOtherCallHint") : undefined}
                          onClick={() => handleStartCall(c)}
                        >
                          {t("startClass")}
                        </Button>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant="active">{t("scheduled")}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setViewingRosterId(c.id)}>
                        {t("studentsAction", { count: c.roster.length })}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === c.id}
                        onClick={() => handleDelete(c.id)}
                      >
                        {t("delete")}
                      </Button>
                    </div>
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
