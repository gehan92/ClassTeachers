"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LockPill } from "@/components/features/lock-pill";
import { uploadNote, deleteNote, toggleNotePublic } from "@/lib/dashboard/notes-actions";
import type { TeacherBatchRow } from "./classes-tab";

export type TeacherNoteRow = {
  id: string;
  title: string;
  batchTitle: string | null;
  pageCount: number | null;
  isPublic: boolean;
};

const GENERAL_BATCH = "general";
const MAX_PUBLIC_NOTES = 3;

export function NotesTab({ notes, batches }: { notes: TeacherNoteRow[]; batches: TeacherBatchRow[] }) {
  const t = useTranslations("teacherDashboard.notes");
  const tc = useTranslations("teacherDashboard.common");
  const router = useRouter();
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
  const publicCount = notes.filter((n) => n.isPublic).length;

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
    router.refresh();
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    const result = await deleteNote(noteId);
    setDeletingId(null);
    if (!result.error) {
      router.refresh();
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
    router.refresh();
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

      <div className="rounded-lg border border-border bg-white p-5">
        {notes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("emptyState")}</p>
        ) : (
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
              {notes.map((note) => (
                <TableRow key={note.id}>
                  <TableCell className="max-w-72 whitespace-normal font-medium text-foreground">
                    {note.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{note.batchTitle ?? t("form.batchGeneral")}</TableCell>
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === note.id}
                      onClick={() => handleDelete(note.id)}
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
