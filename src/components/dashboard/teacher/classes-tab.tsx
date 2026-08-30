"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { createBatch, updateBatch, deleteBatch } from "@/lib/dashboard/batches-actions";
import type { GradeBand } from "@/types/grade-band";
import { GRADE_BAND_SELECT_VALUES, OPEN_GRADE_VALUE } from "@/lib/grade-band-options";

export type TeacherBatchRow = {
  id: string;
  title: string;
  mode: "online" | "physical";
  classSizeType: "group" | "individual";
  location: string | null;
  scheduleNote: string | null;
  gradeBand: GradeBand | null;
  /** Campus lecturer only (0076) — a module/course code distinct from the generic subject list, e.g. "CS301". Null for regular teacher batches. */
  courseCode: string | null;
  /** Deleting a batch cascades to delete its search-results ad (0039) —
   * used to disable/explain the Delete action up front rather than let the
   * teacher hit the server-side block after clicking. */
  hasActiveAd: boolean;
};

/**
 * What notes/exams/live-classes/question-bank/assignments actually need
 * from a batch to offer it as a content target — id + a display label.
 * Lets the teacher dashboard (Institute Blueprint step 3b) mix the
 * teacher's own TeacherBatchRow entries with lightweight entries for their
 * assigned institute batches (labeled "{Institute} — {Batch}") in the same
 * selector, without those institute batches needing to fake values for
 * fields (mode/location/gradeBand/...) that only the Classes tab's own
 * batch-management UI actually uses.
 */
export type TeacherBatchOption = { id: string; title: string };

export type BatchRosterEntry = {
  name: string;
  joinedAt: string;
  phone: string | null;
};

/**
 * A class an institute has assigned this teacher to teach — deliberately a
 * much lighter shape than TeacherBatchRow. The institute owns the batch
 * (title, schedule, mode); a linked teacher manages its content, not the
 * batch record itself, so there's no edit/delete here, just enough to
 * orient them: which institute, which class, how it runs, who's in it.
 */
export type InstituteTaughtBatchRow = {
  id: string;
  title: string;
  instituteName: string;
  mode: "online" | "physical";
  location: string | null;
  scheduleNote: string | null;
  studentCount: number;
};

export function ClassesTab({
  batches,
  rosterByBatch,
  isCampusLecturer = false,
  instituteBatches = [],
}: {
  batches: TeacherBatchRow[];
  rosterByBatch: Record<string, BatchRosterEntry[]>;
  /** Swaps just the page heading to "Courses" — /roles already promises "course-style" language for this role. The rest of the tab (batch editor, roster) keeps its existing wording rather than a full terminology rewrite. */
  isCampusLecturer?: boolean;
  instituteBatches?: InstituteTaughtBatchRow[];
}) {
  const t = useTranslations("teacherDashboard.classes");
  const tc = useTranslations("teacherDashboard.common");
  const tg = useTranslations("search");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"online" | "physical">("physical");
  const [classSizeType, setClassSizeType] = useState<"group" | "individual">("group");
  const [location, setLocation] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [gradeBand, setGradeBand] = useState<GradeBand | typeof OPEN_GRADE_VALUE>("12-13");
  const [courseCode, setCourseCode] = useState("");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMode, setEditMode] = useState<"online" | "physical">("physical");
  const [editClassSizeType, setEditClassSizeType] = useState<"group" | "individual">("group");
  const [editLocation, setEditLocation] = useState("");
  const [editScheduleNote, setEditScheduleNote] = useState("");
  const [editGradeBand, setEditGradeBand] = useState<GradeBand | typeof OPEN_GRADE_VALUE>("12-13");
  const [editCourseCode, setEditCourseCode] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ batchId: string; message: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setMode("physical");
    setClassSizeType("group");
    setLocation("");
    setScheduleNote("");
    setGradeBand("12-13");
    setCourseCode("");
  }

  async function handleAdd() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const result = await createBatch({
      ownerType: "teacher",
      title,
      mode,
      classSizeType,
      location,
      scheduleNote,
      gradeBand: gradeBand === OPEN_GRADE_VALUE ? "" : gradeBand,
      courseCode: isCampusLecturer ? courseCode : undefined,
    });
    setCreating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    resetForm();
    setShowForm(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    refresh();
  }

  function startEdit(batch: TeacherBatchRow) {
    setEditingBatchId(batch.id);
    setEditTitle(batch.title);
    setEditMode(batch.mode);
    setEditClassSizeType(batch.classSizeType);
    setEditLocation(batch.location ?? "");
    setEditScheduleNote(batch.scheduleNote ?? "");
    setEditGradeBand(batch.gradeBand ?? OPEN_GRADE_VALUE);
    setEditCourseCode(batch.courseCode ?? "");
    setEditError(null);
  }

  function cancelEdit() {
    setEditingBatchId(null);
    setEditError(null);
  }

  async function handleSaveEdit(batchId: string) {
    if (!editTitle.trim()) return;
    setEditSaving(true);
    setEditError(null);
    const result = await updateBatch(batchId, {
      ownerType: "teacher",
      title: editTitle,
      mode: editMode,
      classSizeType: editClassSizeType,
      location: editLocation,
      scheduleNote: editScheduleNote,
      gradeBand: editGradeBand === OPEN_GRADE_VALUE ? "" : editGradeBand,
      courseCode: isCampusLecturer ? editCourseCode : undefined,
    });
    setEditSaving(false);
    if (result.error) {
      setEditError(result.error);
      return;
    }
    setEditingBatchId(null);
    refresh();
  }

  async function handleConfirmDelete() {
    const batchId = confirmDeleteId;
    if (!batchId) return;
    setDeletingId(batchId);
    setDeleteError(null);
    const result = await deleteBatch(batchId, "teacher");
    setDeletingId(null);
    if (result.error) {
      setDeleteError({ batchId, message: result.error });
      return;
    }
    setConfirmDeleteId(null);
    refresh();
  }

  const batchPendingDelete = batches.find((b) => b.id === confirmDeleteId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{isCampusLecturer ? t("headingCampus") : t("heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {added && <span className="animate-in fade-in-0 text-sm font-medium text-success duration-200">{tc("added")}</span>}
          <Button onClick={() => setShowForm((v) => !v)}>
            {isCampusLecturer ? t("addBatchCampus") : t("addBatch")}
          </Button>
        </div>
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
      />

      {showForm && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-4 text-lg">{isCampusLecturer ? t("form.titleCampus") : t("form.title")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={isCampusLecturer ? "grid gap-1.5" : "grid gap-1.5 sm:col-span-2"}>
              <Label htmlFor="batch-title">{isCampusLecturer ? t("form.titleLabelCampus") : t("form.titleLabel")}</Label>
              <Input
                id="batch-title"
                placeholder={isCampusLecturer ? t("form.titlePlaceholderCampus") : t("form.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            {isCampusLecturer && (
              <div className="grid gap-1.5">
                <Label htmlFor="batch-course-code">{t("form.courseCodeLabel")}</Label>
                <Input
                  id="batch-course-code"
                  placeholder={t("form.courseCodePlaceholder")}
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="batch-mode">{t("form.modeLabel")}</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as "online" | "physical")}>
                <SelectTrigger id="batch-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical">{t("form.modePhysical")}</SelectItem>
                  <SelectItem value="online">{t("form.modeOnline")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-grade">{t("form.gradeLabel")}</Label>
              <Select
                value={gradeBand}
                onValueChange={(value) => setGradeBand((value as GradeBand | typeof OPEN_GRADE_VALUE) ?? OPEN_GRADE_VALUE)}
              >
                <SelectTrigger id="batch-grade" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_BAND_SELECT_VALUES.map((band) => (
                    <SelectItem key={band} value={band}>
                      {band === OPEN_GRADE_VALUE ? tg("grades.open") : tg(`grades.${band}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-size-type">{isCampusLecturer ? t("form.classSizeLabelCampus") : t("form.classSizeLabel")}</Label>
              <Select
                value={classSizeType}
                onValueChange={(value) => setClassSizeType(value as "group" | "individual")}
              >
                <SelectTrigger id="batch-size-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">{t("form.classSizeGroup")}</SelectItem>
                  <SelectItem value="individual">{t("form.classSizeIndividual")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-location">{t("form.locationLabel")}</Label>
              <Input
                id="batch-location"
                placeholder={t("form.locationPlaceholder")}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-schedule">{t("form.scheduleLabel")}</Label>
              <Input
                id="batch-schedule"
                placeholder={t("form.schedulePlaceholder")}
                value={scheduleNote}
                onChange={(e) => setScheduleNote(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={handleAdd} disabled={creating}>
              {isCampusLecturer ? t("form.submitCampus") : t("form.submit")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              {tc("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
          {isCampusLecturer ? t("emptyStateCampus") : t("emptyState")}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {batches.map((batch) => {
            const roster = rosterByBatch[batch.id] ?? [];
            const isEditing = editingBatchId === batch.id;
            return (
              <div key={batch.id} className="rounded-lg border border-border bg-white p-5">
                {isEditing ? (
                  <div className="mb-4 rounded-md border border-border bg-muted/30 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className={isCampusLecturer ? "grid gap-1.5" : "grid gap-1.5 sm:col-span-2"}>
                        <Label htmlFor={`edit-title-${batch.id}`}>
                          {isCampusLecturer ? t("form.titleLabelCampus") : t("form.titleLabel")}
                        </Label>
                        <Input
                          id={`edit-title-${batch.id}`}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                      </div>
                      {isCampusLecturer && (
                        <div className="grid gap-1.5">
                          <Label htmlFor={`edit-course-code-${batch.id}`}>{t("form.courseCodeLabel")}</Label>
                          <Input
                            id={`edit-course-code-${batch.id}`}
                            placeholder={t("form.courseCodePlaceholder")}
                            value={editCourseCode}
                            onChange={(e) => setEditCourseCode(e.target.value)}
                          />
                        </div>
                      )}
                      <div className="grid gap-1.5">
                        <Label>{t("form.modeLabel")}</Label>
                        <Select value={editMode} onValueChange={(value) => setEditMode(value as "online" | "physical")}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="physical">{t("form.modePhysical")}</SelectItem>
                            <SelectItem value="online">{t("form.modeOnline")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{isCampusLecturer ? t("form.classSizeLabelCampus") : t("form.classSizeLabel")}</Label>
                        <Select
                          value={editClassSizeType}
                          onValueChange={(value) => setEditClassSizeType(value as "group" | "individual")}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="group">{t("form.classSizeGroup")}</SelectItem>
                            <SelectItem value="individual">{t("form.classSizeIndividual")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{t("form.gradeLabel")}</Label>
                        <Select
                          value={editGradeBand}
                          onValueChange={(value) => setEditGradeBand((value as GradeBand | typeof OPEN_GRADE_VALUE) ?? OPEN_GRADE_VALUE)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GRADE_BAND_SELECT_VALUES.map((band) => (
                              <SelectItem key={band} value={band}>
                                {band === OPEN_GRADE_VALUE ? tg("grades.open") : tg(`grades.${band}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`edit-location-${batch.id}`}>{t("form.locationLabel")}</Label>
                        <Input
                          id={`edit-location-${batch.id}`}
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`edit-schedule-${batch.id}`}>{t("form.scheduleLabel")}</Label>
                        <Input
                          id={`edit-schedule-${batch.id}`}
                          value={editScheduleNote}
                          onChange={(e) => setEditScheduleNote(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                      <Button size="sm" onClick={() => handleSaveEdit(batch.id)} disabled={editSaving}>
                        {tc("save")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        {tc("cancel")}
                      </Button>
                      {editError && <span className="text-sm font-medium text-destructive">{editError}</span>}
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg text-foreground">
                        {batch.courseCode && <span className="text-muted-foreground">{batch.courseCode} · </span>}
                        {batch.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {batch.gradeBand ? `${tg(`grades.${batch.gradeBand}`)} · ` : `${tg("grades.open")} · `}
                        {batch.mode === "online" ? t("form.modeOnline") : t("form.modePhysical")}
                        {" · "}
                        {batch.classSizeType === "individual" ? t("form.classSizeIndividual") : t("form.classSizeGroup")}
                        {batch.location ? ` · ${batch.location}` : ""}
                        {batch.scheduleNote ? ` · ${batch.scheduleNote}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                        {t("studentCount", { count: roster.length })}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(batch)}>
                        {t("edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={batch.hasActiveAd}
                        title={
                          batch.hasActiveAd
                            ? isCampusLecturer
                              ? t("deleteBlockedByAdCampus")
                              : t("deleteBlockedByAd")
                            : undefined
                        }
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmDeleteId(batch.id);
                        }}
                      >
                        {t("delete")}
                      </Button>
                    </div>
                  </div>
                )}

                {roster.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("columns.student")}</TableHead>
                        <TableHead>{t("columns.joined")}</TableHead>
                        <TableHead>{t("columns.contact")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roster.map((student, i) => (
                        <TableRow key={`${batch.id}-${i}`}>
                          <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                          <TableCell className="text-muted-foreground">{student.joinedAt}</TableCell>
                          <TableCell className="text-muted-foreground">{student.phone ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {instituteBatches.length > 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg text-foreground">{t("institutes.heading")}</h2>
            <p className="text-sm text-muted-foreground">{t("institutes.subtitle")}</p>
          </div>
          <div className="flex flex-col gap-5">
            {instituteBatches.map((batch) => {
              const roster = rosterByBatch[batch.id] ?? [];
              return (
                <div key={batch.id} className="rounded-lg border border-border bg-white p-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg text-foreground">{batch.title}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {batch.instituteName}
                        {" · "}
                        {batch.mode === "online" ? t("form.modeOnline") : t("form.modePhysical")}
                        {batch.location ? ` · ${batch.location}` : ""}
                        {batch.scheduleNote ? ` · ${batch.scheduleNote}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                      {t("studentCount", { count: batch.studentCount })}
                    </span>
                  </div>

                  {roster.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("columns.student")}</TableHead>
                          <TableHead>{t("columns.joined")}</TableHead>
                          <TableHead>{t("columns.contact")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roster.map((student, i) => (
                          <TableRow key={`${batch.id}-${i}`}>
                            <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                            <TableCell className="text-muted-foreground">{student.joinedAt}</TableCell>
                            <TableCell className="text-muted-foreground">{student.phone ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDeleteId(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {batchPendingDelete
                ? t("deleteDialog.title", { title: batchPendingDelete.title })
                : isCampusLecturer
                  ? t("deleteDialog.titleFallbackCampus")
                  : t("deleteDialog.titleFallback")}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDialog.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && deleteError.batchId === confirmDeleteId && (
            <p className="mt-3 text-sm font-medium text-destructive">{deleteError.message}</p>
          )}
          <AlertDialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={deletingId !== null}>
              {tc("cancel")}
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={handleConfirmDelete} disabled={deletingId !== null}>
              {t("delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
