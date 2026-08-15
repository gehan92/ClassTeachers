"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LockPill } from "@/components/features/lock-pill";
import { teacherNotes } from "@/lib/mock-data";
import type { TeacherNote } from "@/types/dashboard-teacher";

export function NotesTab() {
  const t = useTranslations("teacherDashboard.notes");
  const tc = useTranslations("teacherDashboard.common");

  const [notes, setNotes] = useState<TeacherNote[]>(teacherNotes);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [added, setAdded] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  function handleAdd() {
    if (!newTitle.trim() || !newSubject.trim()) return;
    setNotes((list) => [...list, { title: newTitle.trim(), subject: newSubject.trim(), pages: 4, views: 0 }]);
    setNewTitle("");
    setNewSubject("");
    setAdding(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  function handleCancelAdd() {
    setNewTitle("");
    setNewSubject("");
    setAdding(false);
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditTitle(notes[index].title);
  }

  function saveEdit(index: number) {
    setNotes((list) => list.map((note, i) => (i === index ? { ...note, title: editTitle.trim() || note.title } : note)));
    setEditingIndex(null);
  }

  function cancelEdit() {
    setEditingIndex(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl">{t("heading")}</h1>
        <div className="flex items-center gap-3">
          <Button type="button" onClick={() => setAdding((v) => !v)}>
            {t("uploadNote")}
          </Button>
          {added && <span className="text-sm font-medium text-success">{tc("added")}</span>}
        </div>
      </div>

      {adding && (
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              placeholder={t("titlePlaceholder")}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Input
              placeholder={t("subjectPlaceholder")}
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
            />
          </div>
          <div className="mt-4 flex gap-2.5">
            <Button type="button" onClick={handleAdd}>
              {tc("add")}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancelAdd}>
              {tc("cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.title")}</TableHead>
              <TableHead>{t("columns.subject")}</TableHead>
              <TableHead>{t("columns.pages")}</TableHead>
              <TableHead>{t("columns.views")}</TableHead>
              <TableHead>{t("columns.protection")}</TableHead>
              <TableHead>{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.map((note, index) => (
              <TableRow key={`${note.title}-${index}`}>
                <TableCell className="max-w-72 whitespace-normal font-medium text-foreground">
                  {editingIndex === index ? (
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  ) : (
                    note.title
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{note.subject}</TableCell>
                <TableCell className="text-muted-foreground">{note.pages}</TableCell>
                <TableCell className="text-muted-foreground">{note.views}</TableCell>
                <TableCell>
                  <LockPill>{t("watermarked")}</LockPill>
                </TableCell>
                <TableCell>
                  {editingIndex === index ? (
                    <div className="flex gap-1.5">
                      <Button type="button" variant="ghost" size="sm" onClick={() => saveEdit(index)}>
                        {tc("save")}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                        {tc("cancel")}
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(index)}>
                      {t("edit")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
