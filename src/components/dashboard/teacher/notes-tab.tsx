"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LockPill } from "@/components/features/lock-pill";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { uploadNote, updateNote, deleteNote, toggleNotePublic } from "@/lib/dashboard/notes-actions";
import type { TeacherBatchRow } from "./classes-tab";

export type TeacherNoteRow = {
  id: string;
  title: string;
  batchId: string | null;
  batchTitle: string | null;
  pageCount: number | null;
  isPublic: boolean;
};

const GENERAL_BATCH = "general";
const MAX_PUBLIC_NOTES = 3;

export function NotesTab({ notes, batches }: { notes: TeacherNoteRow[]; batches: TeacherBatchRow[] }) {
  const t = useTranslations("teacherDashboard.notes");
  const tc = useTranslations("teacherDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const locale = useLocale();
  const fileInputId = useId();

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [batchId, setBatchId] = useState<string>(GENERAL_BATCH);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBatchId, setEditBatchId] = useState<string>(GENERAL_BATCH);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const publicCount = notes.filter((n) => n.isPublic).length;
  const viewingNote = notes.find((n) => n.id === viewingNoteId) ?? null;

  // Grouped by class/batch so a teacher running several classes isn't
  // hunting through one flat list — same organizing principle as the
  // Assignments tab. Batches with notes appear in the same order as
  // `batches` (the teacher's own class list), unassigned ones trail behind.
  const groupedNotes = useMemo(() => {
    const byBatch = new Map<string, TeacherNoteRow[]>();
    for (const n of notes) {
      const key = n.batchId ?? GENERAL_BATCH;
      (byBatch.get(key) ?? byBatch.set(key, []).get(key)!).push(n);
    }
    const groups: { key: string; title: string; rows: TeacherNoteRow[] }[] = [];
    for (const batch of batches) {
      const rows = byBatch.get(batch.id);
      if (rows) groups.push({ key: batch.id, title: batch.title, rows });
    }
    const general = byBatch.get(GENERAL_BATCH);
    if (general) groups.push({ key: GENERAL_BATCH, title: t("form.batchGeneral"), rows: general });
    return groups;
  }, [notes, batches, t]);

  function resetForm() {
    setTitle("");
    setBatchId(GENERAL_BATCH);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!title.trim() || !file) {
      setError(t("form.missingFields"));
      return;
    }
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("ownerType", "teacher");
    formData.set("title", title.trim());
    if (batchId !== GENERAL_BATCH) formData.set("batchId", batchId);
    formData.set("file", file);

    const result = await uploadNote(formData);
    setUploading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    resetForm();
    setAdding(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    refresh();
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    const result = await deleteNote(noteId);
    setDeletingId(null);
    if (!result.error) {
      refresh();
    }
  }

  async function handleTogglePublic(noteId: string, next: boolean) {
    setTogglingId(noteId);
    setToggleError(null);
    const result = await toggleNotePublic(noteId, next);
    setTogglingId(null);
    if (result.error) {
      setToggleError(result.error);
      return;
    }
    refresh();
  }

  function startEdit(note: TeacherNoteRow) {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditBatchId(note.batchId ?? GENERAL_BATCH);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingNoteId(null);
    setEditError(null);
  }

  async function handleSaveEdit(noteId: string) {
    if (!editTitle.trim()) {
      setEditError(t("form.missingFields"));
      return;
    }
    setEditSaving(true);
    setEditError(null);
    const result = await updateNote(noteId, {
      title: editTitle.trim(),
      batchId: editBatchId === GENERAL_BATCH ? undefined : editBatchId,
    });
    setEditSaving(false);
    if (result.error) {
      setEditError(result.error);
      return;
    }
    setEditingNoteId(null);
    refresh();
  }

  if (viewingNote) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">{viewingNote.title}</div>
            <div className="text-xs text-muted-foreground">
              {viewingNote.batchTitle ?? t("form.batchGeneral")}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setViewingNoteId(null)}>
            {t("closeViewer")}
          </Button>
        </div>
        <div className="mx-auto h-[85vh] max-w-5xl overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
          <iframe
            src={`/${locale}/notes/${viewingNote.id}/file#toolbar=0&navpanes=0&view=FitH`}
            title={viewingNote.title}
            className="size-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl">{t("heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("freePreviewCount", { count: publicCount, max: MAX_PUBLIC_NOTES })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" onClick={() => setAdding((v) => !v)}>
            {t("uploadNote")}
          </Button>
          {added && <span className="text-sm font-medium text-success">{tc("added")}</span>}
        </div>
      </div>
      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
      />
      {toggleError && <p className="text-sm font-medium text-destructive">{toggleError}</p>}

      {adding && (
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="note-title">{t("form.titleLabel")}</Label>
              <Input
                id="note-title"
                placeholder={t("titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="note-batch">{t("form.batchLabel")}</Label>
              <Select value={batchId} onValueChange={(value) => setBatchId(value ?? GENERAL_BATCH)}>
                <SelectTrigger id="note-batch" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENERAL_BATCH}>{t("form.batchGeneral")}</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={fileInputId}>{t("form.fileLabel")}</Label>
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="text-sm text-foreground file:mr-3 file:rounded-sm file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-secondary-foreground"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button type="button" onClick={handleUpload} disabled={uploading}>
              {tc("add")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                setAdding(false);
              }}
            >
              {tc("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5">
          <p className="py-6 text-center text-sm text-muted-foreground">{t("emptyState")}</p>
        </div>
      ) : (
        groupedNotes.map((group) => (
          <div key={group.key} className="rounded-lg border border-border bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">{group.title}</h3>
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.title")}</TableHead>
                <TableHead>{t("columns.batch")}</TableHead>
                <TableHead>{t("columns.pages")}</TableHead>
                <TableHead>{t("columns.protection")}</TableHead>
                <TableHead>{t("columns.freePreview")}</TableHead>
                <TableHead>{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.rows.map((note) => {
                const isEditing = editingNoteId === note.id;
                return (
                  <TableRow key={note.id}>
                    <TableCell className="max-w-72 whitespace-normal font-medium text-foreground">
                      {isEditing ? (
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-white" />
                      ) : (
                        note.title
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {isEditing ? (
                        <Select value={editBatchId} onValueChange={(value) => setEditBatchId(value ?? GENERAL_BATCH)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={GENERAL_BATCH}>{t("form.batchGeneral")}</SelectItem>
                            {batches.map((batch) => (
                              <SelectItem key={batch.id} value={batch.id}>
                                {batch.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        (note.batchTitle ?? t("form.batchGeneral"))
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{note.pageCount ?? "—"}</TableCell>
                    <TableCell>
                      <LockPill>{t("watermarked")}</LockPill>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={note.isPublic}
                        disabled={togglingId === note.id || (!note.isPublic && publicCount >= MAX_PUBLIC_NOTES)}
                        onCheckedChange={(checked) => handleTogglePublic(note.id, checked)}
                        aria-label={t("columns.freePreview")}
                      />
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" size="sm" disabled={editSaving} onClick={() => handleSaveEdit(note.id)}>
                            {tc("save")}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={cancelEdit}>
                            {tc("cancel")}
                          </Button>
                          {editError && <span className="text-sm font-medium text-destructive">{editError}</span>}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setViewingNoteId(note.id)}>
                            {t("view")}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(note)}>
                            {t("edit")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={deletingId === note.id}
                            onClick={() => handleDelete(note.id)}
                          >
                            {t("delete")}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
          </div>
        ))
      )}
    </div>
  );
}
