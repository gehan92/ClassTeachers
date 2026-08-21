"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/features/status-badge";
import { createLiveClass, updateLiveClassLink } from "@/lib/dashboard/live-classes-actions";

export type TeacherLiveClassRow = {
  id: string;
  title: string;
  scheduledAtIso: string;
  scheduledLabel: string;
  mode: "online" | "physical";
  location: string | null;
  joinLink: string | null;
};

export function LiveClassesTab({ classes }: { classes: TeacherLiveClassRow[] }) {
  const t = useTranslations("teacherDashboard.live");
  const tc = useTranslations("teacherDashboard.common");
  const router = useRouter();

  const [joinLinks, setJoinLinks] = useState<Record<string, string>>(() =>
    Object.fromEntries(classes.map((c) => [c.id, c.joinLink ?? ""])),
  );
  const [savingLinkId, setSavingLinkId] = useState<string | null>(null);
  const [linkSavedId, setLinkSavedId] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newMode, setNewMode] = useState<"online" | "physical">("online");
  const [newLocation, setNewLocation] = useState("");
  const [newJoinLink, setNewJoinLink] = useState("");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setNewTitle("");
    setNewScheduledAt("");
    setNewMode("online");
    setNewLocation("");
    setNewJoinLink("");
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
      scheduledAt: newScheduledAt,
      durationMinutes: "60",
      joinLink: newJoinLink,
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

  async function handleSaveLink(classId: string) {
    setSavingLinkId(classId);
    const result = await updateLiveClassLink({ liveClassId: classId, joinLink: joinLinks[classId] ?? "" });
    setSavingLinkId(null);
    if (!result.error) {
      setLinkSavedId(classId);
      setTimeout(() => setLinkSavedId((current) => (current === classId ? null : current)), 2000);
    }
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
              <Input
                placeholder={t("joinLinkPlaceholder")}
                value={newJoinLink}
                onChange={(e) => setNewJoinLink(e.target.value)}
                className="sm:col-span-2"
              />
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
                  <TableCell className="min-w-56">
                    {c.mode === "online" ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={joinLinks[c.id] ?? ""}
                          onChange={(e) => setJoinLinks((links) => ({ ...links, [c.id]: e.target.value }))}
                          onBlur={() => handleSaveLink(c.id)}
                          disabled={savingLinkId === c.id}
                        />
                        {linkSavedId === c.id && <span className="text-xs font-medium text-success">{tc("saved")}</span>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant="active">{t("scheduled")}</StatusBadge>
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
