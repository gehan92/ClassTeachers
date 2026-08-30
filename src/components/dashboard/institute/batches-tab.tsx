"use client";

import { useMemo, useState } from "react";
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
import { GRADE_BAND_SELECT_VALUES, OPEN_GRADE_VALUE } from "@/lib/grade-band-options";
import type { GradeBand } from "@/types/grade-band";

export type InstituteBatchRosterEntry = {
  studentId: string;
  name: string;
  joinedAt: string;
  phone: string | null;
  /** Share of this student's attendance_records marked "present" or "late"
   * across this batch's live classes — null when there's no attendance
   * history yet (rather than showing a misleading 0%). */
  attendancePercent: number | null;
  /** Average of scorePercent across this student's graded exam_submissions
   * for exams scoped to this batch — same rollup Analytics already does,
   * just narrowed to one batch. Null when nothing's been graded yet. */
  avgMarks: number | null;
};

export type InstituteBatchRow = {
  id: string;
  title: string;
  mode: "online" | "physical";
  location: string | null;
  scheduleNote: string | null;
  teacherLabel: string | null;
  /** taught_by_teacher_id — preselects the teacher dropdown when editing;
   * null for batches still on the old free-text label (pre-0091). */
  teacherId: string | null;
  subjectName: string | null;
  gradeBand: GradeBand | null;
  studentCount: number;
  /** advertisements.batch_id cascade-deletes with the batch (0039) — same
   * guard the teacher dashboard's Classes tab already uses, so Delete is
   * disabled with an explanation instead of failing after the click. */
  hasActiveAd: boolean;
};

export type InstituteRosterTeacherOption = {
  id: string;
  name: string;
};

const PAGE_SIZE = 10;
const ALL_GRADES_FILTER = "all";
const ALL_MODES_FILTER = "all";

export function BatchesTab({
  batches,
  teacherOptions,
  rosterByBatch,
}: {
  batches: InstituteBatchRow[];
  teacherOptions: InstituteRosterTeacherOption[];
  rosterByBatch: Record<string, InstituteBatchRosterEntry[]>;
}) {
  const t = useTranslations("instituteDashboard.batches");
  const tc = useTranslations("instituteDashboard.common");
  const tg = useTranslations("search");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeBand, setGradeBand] = useState<GradeBand | typeof OPEN_GRADE_VALUE>(OPEN_GRADE_VALUE);
  const [mode, setMode] = useState<"online" | "physical">("physical");
  const [schedule, setSchedule] = useState("");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editGradeBand, setEditGradeBand] = useState<GradeBand | typeof OPEN_GRADE_VALUE>(OPEN_GRADE_VALUE);
  const [editMode, setEditMode] = useState<"online" | "physical">("physical");
  const [editLocation, setEditLocation] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ batchId: string; message: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [filterQuery, setFilterQuery] = useState("");
  const [filterGrade, setFilterGrade] = useState(ALL_GRADES_FILTER);
  const [filterMode, setFilterMode] = useState(ALL_MODES_FILTER);
  const [page, setPage] = useState(1);

  function resetForm() {
    setTitle("");
    setTeacherId("");
    setSubject("");
    setGradeBand(OPEN_GRADE_VALUE);
    setMode("physical");
    setSchedule("");
  }

  async function handleAdd() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const result = await createBatch({
      ownerType: "class",
      title,
      mode,
      location: "",
      scheduleNote: schedule,
      taughtByTeacherId: teacherId || undefined,
      gradeBand: gradeBand === OPEN_GRADE_VALUE ? "" : gradeBand,
      subjectName: subject.trim() || undefined,
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

  function startEdit(batch: InstituteBatchRow) {
    setEditingBatchId(batch.id);
    setEditTitle(batch.title);
    setEditTeacherId(batch.teacherId ?? "");
    setEditSubject(batch.subjectName ?? "");
    setEditGradeBand(batch.gradeBand ?? OPEN_GRADE_VALUE);
    setEditMode(batch.mode);
    setEditLocation(batch.location ?? "");
    setEditSchedule(batch.scheduleNote ?? "");
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
      ownerType: "class",
      title: editTitle,
      mode: editMode,
      location: editLocation,
      scheduleNote: editSchedule,
      taughtByTeacherId: editTeacherId || undefined,
      gradeBand: editGradeBand === OPEN_GRADE_VALUE ? "" : editGradeBand,
      subjectName: editSubject.trim() || undefined,
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
    const result = await deleteBatch(batchId, "class");
    setDeletingId(null);
    if (result.error) {
      setDeleteError({ batchId, message: result.error });
      return;
    }
    setConfirmDeleteId(null);
    refresh();
  }

  function toggleExpanded(batchId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }

  const batchPendingDelete = batches.find((b) => b.id === confirmDeleteId) ?? null;

  const distinctGrades = useMemo(() => {
    const set = new Set<GradeBand>();
    for (const b of batches) if (b.gradeBand) set.add(b.gradeBand);
    return Array.from(set);
  }, [batches]);

  const filtersActive =
    filterQuery.trim() !== "" || filterGrade !== ALL_GRADES_FILTER || filterMode !== ALL_MODES_FILTER;

  const filteredBatches = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return batches.filter((b) => {
      if (
        q &&
        !b.title.toLowerCase().includes(q) &&
        !(b.subjectName ?? "").toLowerCase().includes(q) &&
        !(b.teacherLabel ?? "").toLowerCase().includes(q)
      )
        return false;
      if (filterGrade === "open" && b.gradeBand !== null) return false;
      if (filterGrade !== ALL_GRADES_FILTER && filterGrade !== "open" && b.gradeBand !== filterGrade) return false;
      if (filterMode !== ALL_MODES_FILTER && b.mode !== filterMode) return false;
      return true;
    });
  }, [batches, filterQuery, filterGrade, filterMode]);

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedBatches = filteredBatches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function clearFilters() {
    setFilterQuery("");
    setFilterGrade(ALL_GRADES_FILTER);
    setFilterMode(ALL_MODES_FILTER);
    setPage(1);
  }

  function formatPercent(v: number | null) {
    return v === null ? "—" : `${v}%`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {added && <span className="animate-in fade-in-0 text-sm font-medium text-success duration-200">{t("added")}</span>}
          <Button onClick={() => setShowForm(true)}>{t("addBatch")}</Button>
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
          <h3 className="mb-4 text-lg">{t("form.title")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="batch-title">{t("form.titleLabel")}</Label>
              <Input
                id="batch-title"
                placeholder={t("form.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-teacher">{t("form.teacherLabel")}</Label>
              {teacherOptions.length > 0 ? (
                <Select value={teacherId} onValueChange={(value) => setTeacherId(value ?? "")}>
                  <SelectTrigger id="batch-teacher" className="w-full">
                    <SelectValue placeholder={t("form.teacherPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">{t("form.teacherSelectEmpty")}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-schedule">{t("form.scheduleLabel")}</Label>
              <Input
                id="batch-schedule"
                placeholder={t("form.schedulePlaceholder")}
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-subject">{t("form.subjectLabel")}</Label>
              <Input
                id="batch-subject"
                placeholder={t("form.subjectPlaceholder")}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-grade">{t("form.gradeLabel")}</Label>
              <Select value={gradeBand} onValueChange={(value) => setGradeBand((value as GradeBand | typeof OPEN_GRADE_VALUE) ?? OPEN_GRADE_VALUE)}>
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
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={handleAdd} disabled={creating}>
              {t("form.submit")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              {t("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
          {t("emptyState")}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-3.5">
            <div className="grid min-w-48 flex-1 gap-1.5">
              <Label htmlFor="class-filter-search">{t("filters.searchLabel")}</Label>
              <Input
                id="class-filter-search"
                placeholder={t("filters.searchPlaceholder")}
                value={filterQuery}
                onChange={(e) => {
                  setFilterQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="grid w-40 gap-1.5">
              <Label>{t("filters.gradeLabel")}</Label>
              <Select
                value={filterGrade}
                onValueChange={(v) => {
                  setFilterGrade(v ?? ALL_GRADES_FILTER);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_GRADES_FILTER}>{t("filters.allGrades")}</SelectItem>
                  <SelectItem value="open">{tg("grades.open")}</SelectItem>
                  {distinctGrades.map((band) => (
                    <SelectItem key={band} value={band}>
                      {tg(`grades.${band}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-36 gap-1.5">
              <Label>{t("filters.modeLabel")}</Label>
              <Select
                value={filterMode}
                onValueChange={(v) => {
                  setFilterMode(v ?? ALL_MODES_FILTER);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_MODES_FILTER}>{t("filters.allModes")}</SelectItem>
                  <SelectItem value="physical">{t("form.modePhysical")}</SelectItem>
                  <SelectItem value="online">{t("form.modeOnline")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filtersActive && (
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                {t("filters.clearFilters")}
              </Button>
            )}
          </div>

          {filteredBatches.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("filters.noResults")}</p>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {pagedBatches.map((batch, i) => {
                  const isEditing = editingBatchId === batch.id;
                  const isExpanded = expandedIds.has(batch.id);
                  const roster = rosterByBatch[batch.id] ?? [];
                  return (
                    <div
                      key={batch.id}
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                      className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both rounded-lg border border-border bg-white p-4.5 duration-300"
                    >
                      {isEditing ? (
                        <div className="rounded-md border border-border bg-muted/30 p-4">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="grid gap-1.5 sm:col-span-2">
                              <Label htmlFor={`edit-title-${batch.id}`}>{t("form.titleLabel")}</Label>
                              <Input id={`edit-title-${batch.id}`} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                            </div>
                            <div className="grid gap-1.5">
                              <Label>{t("form.teacherLabel")}</Label>
                              {teacherOptions.length > 0 ? (
                                <Select value={editTeacherId} onValueChange={(value) => setEditTeacherId(value ?? "")}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder={t("form.teacherPlaceholder")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {teacherOptions.map((option) => (
                                      <SelectItem key={option.id} value={option.id}>
                                        {option.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <p className="text-sm text-muted-foreground">{t("form.teacherSelectEmpty")}</p>
                              )}
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor={`edit-subject-${batch.id}`}>{t("form.subjectLabel")}</Label>
                              <Input
                                id={`edit-subject-${batch.id}`}
                                placeholder={t("form.subjectPlaceholder")}
                                value={editSubject}
                                onChange={(e) => setEditSubject(e.target.value)}
                              />
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
                              <Label htmlFor={`edit-location-${batch.id}`}>{t("form.locationLabel")}</Label>
                              <Input
                                id={`edit-location-${batch.id}`}
                                placeholder={t("form.locationPlaceholder")}
                                value={editLocation}
                                onChange={(e) => setEditLocation(e.target.value)}
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor={`edit-schedule-${batch.id}`}>{t("form.scheduleLabel")}</Label>
                              <Input
                                id={`edit-schedule-${batch.id}`}
                                value={editSchedule}
                                onChange={(e) => setEditSchedule(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2.5">
                            <Button size="sm" onClick={() => handleSaveEdit(batch.id)} disabled={editSaving}>
                              {tc("save")}
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>
                              {t("cancel")}
                            </Button>
                            {editError && <span className="text-sm font-medium text-destructive">{editError}</span>}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="font-display text-base text-primary">{batch.title}</div>
                              {batch.teacherLabel && (
                                <div className="mt-0.5 text-[13px] text-muted-foreground">{batch.teacherLabel}</div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                                {t("studentCount", { count: batch.studentCount })}
                              </span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(batch)}>
                                {t("edit")}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={batch.hasActiveAd}
                                title={batch.hasActiveAd ? t("deleteBlockedByAd") : undefined}
                                onClick={() => {
                                  setDeleteError(null);
                                  setConfirmDeleteId(batch.id);
                                }}
                              >
                                {t("delete")}
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {batch.subjectName && (
                              <span className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground/80">
                                {batch.subjectName}
                              </span>
                            )}
                            <span className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground/80">
                              {batch.gradeBand ? tg(`grades.${batch.gradeBand}`) : tg("grades.open")}
                            </span>
                            <span className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground/80">
                              {batch.mode === "online" ? t("form.modeOnline") : t("form.modePhysical")}
                            </span>
                            {batch.location && (
                              <span className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground/80">
                                {batch.location}
                              </span>
                            )}
                            {batch.scheduleNote && (
                              <span className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground/80">
                                {batch.scheduleNote}
                              </span>
                            )}
                          </div>
                        </>
                      )}

                      {!isEditing && (
                        <div className="mt-3 border-t border-border pt-3">
                          <Button type="button" variant="outline" size="sm" onClick={() => toggleExpanded(batch.id)}>
                            {isExpanded ? t("hideStudents") : t("viewStudents")}
                          </Button>
                          {isExpanded && (
                            <div className="mt-3">
                              {roster.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{t("columns.student")}</TableHead>
                                      <TableHead>{t("columns.joined")}</TableHead>
                                      <TableHead>{t("columns.contact")}</TableHead>
                                      <TableHead>{t("columns.attendance")}</TableHead>
                                      <TableHead>{t("columns.avgMarks")}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {roster.map((student) => (
                                      <TableRow key={student.studentId}>
                                        <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{student.joinedAt}</TableCell>
                                        <TableCell className="text-muted-foreground">{student.phone ?? "—"}</TableCell>
                                        <TableCell className="text-muted-foreground">{formatPercent(student.attendancePercent)}</TableCell>
                                        <TableCell className="text-muted-foreground">{formatPercent(student.avgMarks)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {t("pagination.showingCount", { shown: pagedBatches.length, total: filteredBatches.length })}
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {t("pagination.previous")}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t("pagination.pageInfo", { page: currentPage, totalPages })}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      {t("pagination.next")}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
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
              {batchPendingDelete ? t("deleteDialog.title", { title: batchPendingDelete.title }) : t("deleteDialog.titleFallback")}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDialog.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && deleteError.batchId === confirmDeleteId && (
            <p className="mt-3 text-sm font-medium text-destructive">{deleteError.message}</p>
          )}
          <AlertDialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={deletingId !== null}>
              {t("cancel")}
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
