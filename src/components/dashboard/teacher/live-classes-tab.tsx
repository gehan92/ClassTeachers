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
import { createLiveClass, deleteLiveClass } from "@/lib/dashboard/live-classes-actions";

export type TeacherLiveClassRow = {
  id: string;
  title: string;
  scheduledAtIso: string;
  scheduledLabel: string;
  mode: "online" | "physical";
  location: string | null;
  joinLink: string | null;
};

export function LiveClassesTab({ classes, hostName }: { classes: TeacherLiveClassRow[]; hostName: string }) {
  const t = useTranslations("teacherDashboard.live");
  const tc = useTranslations("teacherDashboard.common");
  const router = useRouter();

  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newMode, setNewMode] = useState<"online" | "physical">("online");
  const [newLocation, setNewLocation] = useState("");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function resetForm() {
    setNewTitle("");
    setNewScheduledAt("");
    setNewMode("online");
    setNewLocation("");
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
                  <TableCell className="font-medium text-foreground">{c.title}</TableCell>
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === c.id}
                      onClick={() => handleDelete(c.id)}
                    >
                      {t("delete")}
                    </Button>
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
