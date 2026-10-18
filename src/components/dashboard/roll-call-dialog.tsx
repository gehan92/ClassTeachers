"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createAttendanceSession } from "@/lib/dashboard/live-classes-actions";

const ALL_STUDENTS = "__all__";

/** datetime-local wants local time without a zone, e.g. 2026-10-18T09:30. */
function nowForInput(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * "Take roll call" — starts an attendance sheet for an in-person class that
 * was never scheduled as a live class. Shared by the teacher and institute
 * Attendance tabs; `onCreated` receives the new session id so the caller can
 * select it once the dashboard refreshes.
 */
export function RollCallDialog({
  batches,
  allowAllStudents = true,
  onCreated,
}: {
  batches: { id: string; title: string }[];
  /** False when every session must belong to a class (no "all students"). */
  allowAllStudents?: boolean;
  onCreated: (sessionId: string) => void;
}) {
  const t = useTranslations("dashboardCommon.rollCall");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [batchId, setBatchId] = useState<string>(allowAllStudents ? ALL_STUDENTS : (batches[0]?.id ?? ""));
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("60");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setTitle("");
    setWhen(nowForInput());
    setDuration("60");
    setBatchId(allowAllStudents ? ALL_STUDENTS : (batches[0]?.id ?? ""));
    setError(null);
    setOpen(true);
  }

  async function handleCreate() {
    if (!when) return;
    setSaving(true);
    setError(null);
    const batchTitle = batches.find((b) => b.id === batchId)?.title;
    const result = await createAttendanceSession({
      title: title.trim() || t("defaultTitle", { batch: batchTitle ?? t("allStudents") }),
      batchId: batchId === ALL_STUDENTS ? undefined : batchId,
      scheduledAt: new Date(when).toISOString(),
      durationMinutes: duration,
    });
    setSaving(false);
    if ("id" in result && result.id) {
      setOpen(false);
      onCreated(result.id);
      return;
    }
    setError(result.error ?? t("genericError"));
  }

  const noClassesAvailable = !allowAllStudents && batches.length === 0;

  return (
    <>
      <Button type="button" onClick={openDialog} disabled={noClassesAvailable}>
        <ClipboardCheck className="size-4" aria-hidden />
        {t("button")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="roll-call-batch">{t("classLabel")}</Label>
              <Select value={batchId} onValueChange={(v) => v && setBatchId(v)}>
                <SelectTrigger id="roll-call-batch" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowAllStudents && <SelectItem value={ALL_STUDENTS}>{t("allStudents")}</SelectItem>}
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="roll-call-title">{t("nameLabel")}</Label>
              <Input
                id="roll-call-title"
                value={title}
                maxLength={120}
                placeholder={t("namePlaceholder")}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="roll-call-when">{t("whenLabel")}</Label>
                <Input id="roll-call-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="roll-call-duration">{t("durationLabel")}</Label>
                <Input
                  id="roll-call-duration"
                  type="number"
                  min="5"
                  max="600"
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={handleCreate} disabled={saving || !when}>
              {saving ? t("starting") : t("start")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
