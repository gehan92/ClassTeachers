"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import {
  createActivity,
  deleteActivity,
  enrollStudent,
  removeParticipant,
  toggleCertificateIssued,
} from "@/lib/dashboard/extracurriculars-actions";

export type ExtracurricularParticipantRow = { id: string; studentId: string; studentName: string; certificateIssued: boolean };
export type ExtracurricularActivityRow = {
  id: string;
  name: string;
  description: string | null;
  scheduleNote: string | null;
  participants: ExtracurricularParticipantRow[];
};
export type ExtracurricularStudentOption = { id: string; name: string };

export function ExtracurricularsTab({
  activities,
  studentOptions,
}: {
  activities: ExtracurricularActivityRow[];
  studentOptions: ExtracurricularStudentOption[];
}) {
  const t = useTranslations("instituteDashboard.extracurriculars");
  const { refresh } = useDashboardRefresh();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const result = await createActivity({ name, description, scheduleNote });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setName("");
    setDescription("");
    setScheduleNote("");
    setAdding(false);
    refresh();
  }

  async function handleDeleteActivity(activityId: string) {
    if (!window.confirm(t("confirmDeleteActivity"))) return;
    await deleteActivity(activityId);
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setAdding((v) => !v)}>{t("addActivity")}</Button>
      </div>

      {adding && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-4 text-lg">{t("form.title")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="activity-name">{t("form.name")}</Label>
              <Input id="activity-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="activity-schedule">{t("form.schedule")}</Label>
              <Input id="activity-schedule" value={scheduleNote} onChange={(e) => setScheduleNote(e.target.value)} placeholder={t("form.schedulePlaceholder")} />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="activity-description">{t("form.description")}</Label>
              <Input id="activity-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          {error && <p className="mt-2 text-sm font-medium text-destructive">{error}</p>}
          <div className="mt-4 flex gap-3">
            <Button onClick={handleCreate} disabled={saving || !name.trim()}>
              {t("form.submit")}
            </Button>
            <Button variant="outline" onClick={() => setAdding(false)} disabled={saving}>
              {t("form.cancel")}
            </Button>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{t("empty")}</div>
      ) : (
        <div className="flex flex-col gap-4">
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              studentOptions={studentOptions}
              onDelete={() => handleDeleteActivity(activity.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  activity,
  studentOptions,
  onDelete,
}: {
  activity: ExtracurricularActivityRow;
  studentOptions: ExtracurricularStudentOption[];
  onDelete: () => void;
}) {
  const t = useTranslations("instituteDashboard.extracurriculars");
  const { refresh } = useDashboardRefresh();
  const enrolledIds = new Set(activity.participants.map((p) => p.studentId));
  const availableStudents = studentOptions.filter((s) => !enrolledIds.has(s.id));
  const [enrolling, setEnrolling] = useState(false);
  const [studentId, setStudentId] = useState(availableStudents[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleEnroll() {
    if (!studentId) return;
    setError(null);
    const result = await enrollStudent(activity.id, studentId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEnrolling(false);
    refresh();
  }

  async function handleRemove(participantId: string) {
    await removeParticipant(participantId);
    refresh();
  }

  async function handleToggleCertificate(participantId: string, issued: boolean) {
    await toggleCertificateIssued(participantId, issued);
    refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-medium text-foreground">{activity.name}</h4>
          {activity.scheduleNote && <p className="text-sm text-muted-foreground">{activity.scheduleNote}</p>}
          {activity.description && <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t("memberCount", { count: activity.participants.length })}</span>
          <button type="button" className="text-sm font-medium text-lock hover:underline" onClick={onDelete}>
            {t("deleteActivity")}
          </button>
        </div>
      </div>

      {activity.participants.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {activity.participants.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2.5 rounded-md border border-border p-2.5">
              <span className="text-sm font-medium text-foreground">{p.studentName}</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {t("certificateIssued")}
                  <Switch checked={p.certificateIssued} onCheckedChange={(checked) => handleToggleCertificate(p.id, checked)} />
                </label>
                <button type="button" className="text-xs font-medium text-lock hover:underline" onClick={() => handleRemove(p.id)}>
                  {t("remove")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {enrolling ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>{t("enrollStudent")}</Label>
            <Select value={studentId} onValueChange={(value) => setStudentId(value ?? "")}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableStudents.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="sm" onClick={handleEnroll} disabled={!studentId}>
            {t("addStudent")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEnrolling(false)}>
            {t("form.cancel")}
          </Button>
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setEnrolling(true)} disabled={availableStudents.length === 0}>
          {t("enrollStudent")}
        </Button>
      )}
    </div>
  );
}
