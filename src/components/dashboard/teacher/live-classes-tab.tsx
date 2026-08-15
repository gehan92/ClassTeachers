"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/features/status-badge";
import { teacherLiveClasses } from "@/lib/mock-data";
import type { TeacherLiveClass } from "@/types/dashboard-teacher";

export function LiveClassesTab() {
  const t = useTranslations("teacherDashboard.live");
  const tc = useTranslations("teacherDashboard.common");

  const [classes, setClasses] = useState<TeacherLiveClass[]>(teacherLiveClasses);
  const [joinLinks, setJoinLinks] = useState<Record<string, string>>(() =>
    Object.fromEntries(teacherLiveClasses.map((c) => [c.title, c.joinLink ?? ""])),
  );

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDay, setNewDay] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newMode, setNewMode] = useState<TeacherLiveClass["mode"]>("online");
  const [added, setAdded] = useState(false);

  function handleAdd() {
    if (!newTitle.trim() || !newDay.trim() || !newTime.trim()) return;
    setClasses((list) => [...list, { title: newTitle.trim(), day: newDay.trim(), time: newTime.trim(), mode: newMode }]);
    setNewTitle("");
    setNewDay("");
    setNewTime("");
    setNewMode("online");
    setAdding(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  function handleCancel() {
    setNewTitle("");
    setNewDay("");
    setNewTime("");
    setAdding(false);
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
            <Input placeholder={t("dayPlaceholder")} value={newDay} onChange={(e) => setNewDay(e.target.value)} />
            <Input placeholder={t("timePlaceholder")} value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            <Select value={newMode} onValueChange={(value) => setNewMode(value as TeacherLiveClass["mode"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">{t("online")}</SelectItem>
                <SelectItem value="physical">{t("physical")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 flex gap-2.5">
            <Button type="button" onClick={handleAdd}>
              {tc("add")}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              {tc("cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
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
            {classes.map((c, index) => (
              <TableRow key={`${c.title}-${index}`}>
                <TableCell className="font-medium text-foreground">{c.title}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.day} · {c.time}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.mode === "online" ? t("online") : t("physicalAt", { location: c.location ?? "" })}
                </TableCell>
                <TableCell className="min-w-56">
                  {c.mode === "online" ? (
                    <Input
                      value={joinLinks[c.title] ?? ""}
                      onChange={(e) => setJoinLinks((links) => ({ ...links, [c.title]: e.target.value }))}
                    />
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
      </div>
    </div>
  );
}
