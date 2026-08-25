"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/features/status-badge";
import { VideoCallPanel } from "@/components/dashboard/inline-file-viewer";
import { createLiveClass, deleteLiveClass, setAttendanceStatus } from "@/lib/dashboard/live-classes-actions";
import { cn } from "@/lib/utils";

export type TeacherLiveClassBatchOption = { id: string; title: string; studentCount: number };

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
}: {
  classes: TeacherLiveClassRow[];
  hostName: string;
  batches: TeacherLiveClassBatchOption[];
  totalStudentsCount: number;
}) {
  const t = useTranslations("teacherDashboard.live");
  const ta = useTranslations("teacherDashboard.attendance");
  const tc = useTranslations("teacherDashboard.common");
  const router = useRouter();

  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [viewingRosterId, setViewingRosterId] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newMode, setNewMode] = useState<"online" | "physical">("online");
  const [newLocation, setNewLocation] = useState("");
  const [newBatchId, setNewBatchId] = useState<string>(NO_BATCH);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rosterOverrides, setRosterOverrides] = useState<Record<string, NonNullable<LiveClassRosterEntry["status"]>>>({});
  const [savingRosterKey, setSavingRosterKey] = useState<string | null>(null);

  function resetForm() {
    setNewTitle("");
    setNewScheduledAt("");
    setNewMode("online");
    setNewLocation("");
    setNewBatchId(NO_BATCH);
    setAdding(false);
  }

  async function handleAdd() {
    if (!newTitle.trim() || !newScheduledAt) return;
    setSaving(true);
    setError(null);
    const result = await createLiveClass({
      ownerType: "teacher",
      title: newTitle,
      mode: newMode,
      location: newLocation,
      // Converted here, in the browser, so "local" means the teacher's
      // actual timezone — the server has no idea what timezone a bare
      // datetime-local string was picked in.
      scheduledAt: new Date(newScheduledAt).toISOString(),
      durationMinutes: "60",
      batchId: newBatchId !== NO_BATCH ? newBatchId : undefined,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    resetForm();
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    router.refresh();
  }

  async function handleDelete(liveClassId: string) {
    setDeletingId(liveClassId);
    const result = await deleteLiveClass(liveClassId);
    setDeletingId(null);
    if (!result.error) {
      router.refresh();
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

  const activeCall = classes.find((c) => c.id === activeCallId) ?? null;
  if (activeCall && activeCall.joinLink) {
    return (
      <VideoCallPanel
        title={activeCall.title}
        subtitle={activeCall.scheduledLabel}
        roomUrl={activeCall.joinLink}
        closeLabel={tc("close")}
        onClose={() => setActiveCallId(null)}
        displayName={hostName}
        isHost
      />
    );
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
          {added && <span className="text-sm font-medium text-success">{tc("added")}</span>}
        </div>
      </div>

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
            <Select value={newBatchId} onValueChange={(value) => setNewBatchId(value ?? NO_BATCH)}>
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
                      <Button type="button" size="sm" variant="outline" onClick={() => setActiveCallId(c.id)}>
                        {t("startClass")}
                      </Button>
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
