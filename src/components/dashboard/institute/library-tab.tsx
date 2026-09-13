"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { uploadLibraryResource, deleteLibraryResource, incrementLibraryResourceView } from "@/lib/dashboard/library-actions";

export type LibraryResourceRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  fileUrl: string;
  filePath: string;
  viewCount: number;
};

export function LibraryTab({ resources }: { resources: LibraryResourceRow[] }) {
  const t = useTranslations("instituteDashboard.library");
  const tc = useTranslations("instituteDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!title.trim() || !file) {
      setError(t("form.missingFields"));
      return;
    }
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("title", title.trim());
    if (description.trim()) formData.set("description", description.trim());
    if (category.trim()) formData.set("category", category.trim());
    formData.set("file", file);

    const result = await uploadLibraryResource(formData);
    setUploading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTitle("");
    setDescription("");
    setCategory("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAdding(false);
    refresh();
  }

  async function handleDelete(resource: LibraryResourceRow) {
    if (!window.confirm(t("confirmDelete"))) return;
    setDeletingId(resource.id);
    await deleteLibraryResource(resource.id, resource.filePath);
    setDeletingId(null);
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setAdding((v) => !v)}>{t("addResource")}</Button>
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
          <h3 className="mb-4 text-lg">{t("form.title")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="library-title">{t("form.resourceTitle")}</Label>
              <Input id="library-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="library-category">{t("form.category")}</Label>
              <Input id="library-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("form.categoryPlaceholder")} />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="library-description">{t("form.description")}</Label>
              <Input id="library-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="library-file">{t("form.file")}</Label>
              <input
                id="library-file"
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="text-sm text-muted-foreground file:mr-3 file:rounded-sm file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
          </div>
          {error && <p className="mt-2 text-sm font-medium text-destructive">{error}</p>}
          <div className="mt-4 flex gap-3">
            <Button onClick={handleUpload} disabled={uploading}>
              {t("form.submit")}
            </Button>
            <Button variant="outline" onClick={() => setAdding(false)} disabled={uploading}>
              {t("form.cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.title")}</TableHead>
                <TableHead>{t("table.category")}</TableHead>
                <TableHead>{t("table.views")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{r.title}</p>
                    {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.category ?? "—"}</TableCell>
                  <TableCell>{r.viewCount}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-3">
                      <a
                        href={r.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary hover:underline"
                        onClick={() => incrementLibraryResourceView(r.id)}
                      >
                        {t("open")}
                      </a>
                      <button
                        type="button"
                        className="text-sm font-medium text-lock hover:underline disabled:pointer-events-none disabled:opacity-60"
                        onClick={() => handleDelete(r)}
                        disabled={deletingId === r.id}
                      >
                        {t("delete")}
                      </button>
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
