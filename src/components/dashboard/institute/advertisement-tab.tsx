"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { StatusBadge } from "@/components/features/status-badge";
import { AdSlot } from "@/components/features/ad-slot";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { StatCard } from "@/components/dashboard/stat-card";
import { AdPreviewCard } from "@/components/dashboard/ad-preview-card";
import { AdHistoryList, type AdHistoryRow } from "@/components/dashboard/ad-history-list";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { usePagination } from "@/lib/hooks/use-pagination";
import { hasRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createClassBatchAd,
  updateClassBatchAd,
  deleteClassBatchAd,
  setClassBatchAdActive,
  updateClassBatchRate,
  createInstitutePromotion,
  updateInstitutePromotion,
  deleteInstitutePromotion,
  createTeacherWiseAd,
} from "@/lib/dashboard/ads-actions";
import {
  createVacancyAd,
  updateVacancyAd,
  setVacancyAdStatus,
  deleteVacancyAd,
  respondToVacancyApplicationDecision,
} from "@/lib/dashboard/vacancy-ads-actions";

const textareaClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

/**
 * Mirrors the teacher dashboard's own local AdPreviewDialog (advertisement-
 * tab.tsx) — a "Preview" button opens this instead of the preview sitting
 * inline in the form all the time, matching the Post/Preview/Cancel button
 * row Gehan asked to keep consistent between the two dashboards.
 */
function AdPreviewDialog({
  open,
  onOpenChange,
  dialogTitle,
  dialogSubtitle,
  ...cardProps
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogTitle: string;
  dialogSubtitle: string;
} & Parameters<typeof AdPreviewCard>[0]) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogSubtitle}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <AdPreviewCard {...cardProps} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type InstituteAdRow = {
  id: string;
  title: string;
  content: string;
  status: "active" | "expired" | "removed";
  viewCount: number;
  createdAtIso: string;
  createdLabel: string;
};

export type InstituteAdBatchRow = {
  id: string;
  title: string;
  subjectName: string | null;
  hourlyRate: number | null;
  monthlyRate: number | null;
  /** Optional module/course identifier, e.g. "CS301". */
  courseCode: string | null;
  /** Set for a "Course-Wise Ad" (mockup 2.4) — a structured, multi-session
   * course rather than an ongoing "Class-Wise Ad". */
  totalSessions: number | null;
  /** Multiple ads per class since 0104 — every active one shows as its own card in search. */
  ads: InstituteAdRow[];
};

export type InstitutePromotionRow = { id: string; content: string };

/** An accepted teacher this institute can feature in a "Teacher-Wise Ad"
 * (mockup 2.4) — only ever teachers genuinely on the roster, not pending
 * invites/requests. */
export type InstituteTeacherOption = { id: string; name: string };

export type InstituteTeacherAdRow = {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  content: string;
  status: "active" | "expired" | "removed";
  viewCount: number;
  createdAtIso: string;
  createdLabel: string;
};

export type InstituteVacancyRow = {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  mode: "online" | "physical" | null;
  location: string | null;
  title: string;
  content: string;
  active: boolean;
  createdAtIso: string;
  createdLabel: string;
};

export type VacancyApplicationRow = {
  id: string;
  vacancyId: string;
  teacherName: string;
  message: string;
  status: "new" | "read" | "accepted" | "declined";
  createdLabel: string;
};

export function AdvertisementTab({
  promotions,
  batches,
  adHistory = [],
  promotionHistory = [],
  teacherOptions,
  teacherAds,
  subjectOptions,
  vacancies,
  vacancyApplications,
}: {
  promotions: InstitutePromotionRow[];
  batches: InstituteAdBatchRow[];
  adHistory?: AdHistoryRow[];
  promotionHistory?: AdHistoryRow[];
  teacherOptions: InstituteTeacherOption[];
  teacherAds: InstituteTeacherAdRow[];
  subjectOptions: { id: string; name: string }[];
  vacancies: InstituteVacancyRow[];
  vacancyApplications: VacancyApplicationRow[];
}) {
  const t = useTranslations("instituteDashboard.ads");
  const tc = useTranslations("instituteDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [deletedAdIds, setDeletedAdIds] = useState<Set<string>>(new Set());
  const [deletedPromotionIds, setDeletedPromotionIds] = useState<Set<string>>(new Set());
  const [deletedTeacherAdIds, setDeletedTeacherAdIds] = useState<Set<string>>(new Set());
  const [deletedVacancyIds, setDeletedVacancyIds] = useState<Set<string>>(new Set());

  const allAds = batches.flatMap((batch) => batch.ads).filter((ad) => !deletedAdIds.has(ad.id));
  const activeAds = allAds.filter((ad) => ad.status === "active");
  const totalViews = activeAds.reduce((sum, ad) => sum + ad.viewCount, 0);
  const visibleTeacherAds = teacherAds.filter((ad) => !deletedTeacherAdIds.has(ad.id));
  const visibleVacancies = vacancies.filter((v) => !deletedVacancyIds.has(v.id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:max-w-100">
        <StatCard label={t("glance.activeAds")} value={activeAds.length} />
        <StatCard label={t("glance.totalViews")} value={totalViews} />
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
      />

      <div>
        <h3 className="mb-1 text-lg">{t("classAds.heading")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t("classAds.subtitle")}</p>

        {batches.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
            {t("classAds.noBatches")}
          </div>
        ) : (
          <ClassAdsTable
            batches={batches.map((b) => ({ ...b, ads: b.ads.filter((ad) => !deletedAdIds.has(ad.id)) }))}
            onAdDeleted={(adId) => {
              setDeletedAdIds((prev) => new Set(prev).add(adId));
              refresh();
            }}
            onChanged={refresh}
          />
        )}
      </div>

      <div>
        <h3 className="mb-1 text-lg">{t("teacherAds.heading")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t("teacherAds.subtitle")}</p>
        <TeacherAdsTable
          teacherOptions={teacherOptions}
          ads={visibleTeacherAds}
          onDeleted={(adId) => {
            setDeletedTeacherAdIds((prev) => new Set(prev).add(adId));
            refresh();
          }}
          onChanged={refresh}
        />
      </div>

      <div>
        <h3 className="mb-1 text-lg">{t("vacancies.heading")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t("vacancies.subtitle")}</p>
        <VacanciesTable
          subjectOptions={subjectOptions}
          vacancies={visibleVacancies}
          applications={vacancyApplications}
          onDeleted={(id) => {
            setDeletedVacancyIds((prev) => new Set(prev).add(id));
            refresh();
          }}
          onChanged={refresh}
        />
      </div>

      <div>
        <h3 className="mb-1 text-lg">{t("panelTitle")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t("promotionSubtitle")}</p>
        <PromotionsSection
          promotions={promotions.filter((p) => !deletedPromotionIds.has(p.id))}
          onDeleted={(id) => {
            setDeletedPromotionIds((prev) => new Set(prev).add(id));
            refresh();
          }}
          onChanged={refresh}
        />
      </div>

      <AdSlot
        size="sm"
        eyebrow={t("spotlight.eyebrow")}
        text={t("spotlight.empty")}
        ctaLabel={t("spotlight.cta")}
        ctaHref="/advertise"
      />

      {(adHistory.length > 0 || promotionHistory.length > 0) && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-1 text-lg">{t("history.heading")}</h3>
          <p className="mb-4 text-sm text-muted-foreground">{t("history.subtitle")}</p>
          {adHistory.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                {t("history.classAdsHeading")}
              </p>
              <AdHistoryList
                items={adHistory}
                ownerType="class"
                restoreLabel={t("history.restore")}
                restoredLabel={t("history.restored")}
              />
            </div>
          )}
          {promotionHistory.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                {t("history.promotionsHeading")}
              </p>
              <AdHistoryList
                items={promotionHistory}
                ownerType="class"
                restoreLabel={t("history.restore")}
                restoredLabel={t("history.restored")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Striped, paginated table mirroring the teacher dashboard's Advertisement
 * tab (Gehan asked to keep the two designs consistent). A class here can
 * carry more than one ad (0104), unlike a teacher's single batch ad, so the
 * table flattens to one row per ad — plus one placeholder row per class
 * that has no ad yet at all, same "still shows up, nudges you to create
 * one" behavior the teacher table has. Newest-posted ad first; classes
 * with zero ads sink to the bottom since they have no date to sort by.
 */
function ClassAdsTable({
  batches,
  onAdDeleted,
  onChanged,
}: {
  batches: InstituteAdBatchRow[];
  onAdDeleted: (adId: string) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.classAds");
  const tc = useTranslations("instituteDashboard.common");
  const [createOpen, setCreateOpen] = useState(false);
  const [createBatchId, setCreateBatchId] = useState<string | null>(null);

  type Row = { batch: InstituteAdBatchRow; ad: InstituteAdRow };
  const rows = useMemo(() => {
    const withAds: Row[] = [];
    for (const batch of batches) {
      for (const ad of batch.ads) withAds.push({ batch, ad });
    }
    withAds.sort((a, b) => new Date(b.ad.createdAtIso).getTime() - new Date(a.ad.createdAtIso).getTime());
    return withAds;
  }, [batches]);

  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(rows.length);
  const paged = rows.slice(offset, offset + pageSize);

  return (
    <div className="flex flex-col gap-3">
      {createOpen ? (
        <ClassAdCreateForm
          key={createBatchId ?? "__top"}
          batches={batches}
          initialBatchId={createBatchId}
          onCreated={() => {
            setCreateOpen(false);
            onChanged();
          }}
          onCancel={() => setCreateOpen(false)}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-input bg-white p-5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCreateBatchId(null);
              setCreateOpen(true);
            }}
          >
            {t("createAd")}
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noAdYet")}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.className")}</TableHead>
                <TableHead>{t("table.date")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((row, i) => (
                <ClassAdRow
                  key={row.ad.id}
                  batch={row.batch}
                  ad={row.ad}
                  striped={i % 2 === 1}
                  onCreateClick={() => {
                    setCreateBatchId(row.batch.id);
                    setCreateOpen(true);
                  }}
                  onDeleted={() => onAdDeleted(row.ad.id)}
                  onSaved={onChanged}
                />
              ))}
            </TableBody>
          </Table>
          <div className="px-4 pb-4">
            <PaginationFooter
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              showingLabel={tc("pagination.showingCount", { shown: paged.length, total: rows.length })}
              previousLabel={tc("pagination.previous")}
              nextLabel={tc("pagination.next")}
              pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ClassAdRow({
  batch,
  ad,
  striped,
  onCreateClick,
  onDeleted,
  onSaved,
}: {
  batch: InstituteAdBatchRow;
  ad: InstituteAdRow | null;
  striped: boolean;
  onCreateClick: () => void;
  onDeleted?: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.classAds");
  const tc = useTranslations("instituteDashboard.common");
  const [editOpen, setEditOpen] = useState(false);
  const [active, setActive] = useState(ad?.status === "active");
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(checked: boolean) {
    if (!ad) return;
    setToggling(true);
    const result = await setClassBatchAdActive(ad.id, checked);
    setToggling(false);
    if (!result.error) setActive(checked);
  }

  async function handleDelete() {
    if (!ad) return;
    if (!window.confirm(t("confirmDelete"))) return;
    setDeleting(true);
    setError(null);
    const result = await deleteClassBatchAd(ad.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDeleted?.();
  }

  return (
    <>
      <TableRow className={striped ? "bg-muted/70" : undefined}>
        <TableCell className="whitespace-normal">
          <p className="font-medium text-foreground">
            {batch.courseCode && <span className="text-muted-foreground">{batch.courseCode} · </span>}
            {batch.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {batch.subjectName ? t("batchSubject", { subject: batch.subjectName }) : t("noSubjectYet")}
            {batch.totalSessions ? ` · ${t("sessionsCount", { count: batch.totalSessions })}` : ""}
          </p>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{ad ? ad.createdLabel : "—"}</TableCell>
        <TableCell>
          {ad ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{t("viewCount", { count: ad.viewCount })}</span>
              <StatusBadge variant={active ? "active" : "closed"}>{active ? t("active") : t("paused")}</StatusBadge>
              <Switch checked={active} onCheckedChange={handleToggle} disabled={toggling} />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{t("noAdYet")}</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {ad && active && (
              <Link
                href={`/ad/${ad.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                {tc("view")}
              </Link>
            )}
            {ad ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                {t("editAd")}
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={onCreateClick}>
                {t("createAd")}
              </Button>
            )}
            {ad && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {t("deleteAd")}
              </Button>
            )}
          </div>
          {error && <p className="mt-1 text-right text-xs font-medium text-destructive">{error}</p>}
        </TableCell>
      </TableRow>

      {ad && editOpen && (
        <TableRow className={striped ? "bg-muted/70" : undefined}>
          <TableCell colSpan={4} className="pt-0">
            <ClassAdEditForm
              batch={batch}
              ad={ad}
              onSaved={() => {
                setEditOpen(false);
                onSaved();
              }}
              onCancel={() => setEditOpen(false)}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ClassAdEditForm({
  batch,
  ad,
  onSaved,
  onCancel,
}: {
  batch: InstituteAdBatchRow;
  ad: InstituteAdRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.classAds");
  const tc = useTranslations("instituteDashboard.common");
  const [title, setTitle] = useState(ad.title);
  const [content, setContent] = useState(ad.content);
  const [hourlyRate, setHourlyRate] = useState(batch.hourlyRate != null ? String(batch.hourlyRate) : "");
  const [monthlyRate, setMonthlyRate] = useState(batch.monthlyRate != null ? String(batch.monthlyRate) : "");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim() || !hasRichText(content)) return;
    setSaving(true);
    setError(null);
    const [adResult, rateResult] = await Promise.all([
      updateClassBatchAd(ad.id, { title, content }),
      updateClassBatchRate({
        batchId: batch.id,
        hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : undefined,
        monthlyRate: monthlyRate.trim() ? Number(monthlyRate) : undefined,
      }),
    ]);
    setSaving(false);
    if (adResult.error || rateResult.error) {
      setError(adResult.error || rateResult.error || null);
      return;
    }
    onSaved();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="mb-3 font-medium text-foreground">{t("editAd")}</p>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {batch.courseCode && <span>{batch.courseCode} · </span>}
          {batch.title}
        </p>
        <div className="grid gap-1.5">
          <Label htmlFor={`ad-title-${ad.id}`}>{t("titleLabel")}</Label>
          <Input id={`ad-title-${ad.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`ad-content-${ad.id}`}>{t("contentLabel")}</Label>
          <RichTextEditor
            id={`ad-content-${ad.id}`}
            value={content}
            onChange={setContent}
            placeholder={t("contentPlaceholder")}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`ad-hourly-${ad.id}`}>{t("hourlyRateLabel")}</Label>
            <Input
              id={`ad-hourly-${ad.id}`}
              type="number"
              min="0"
              inputMode="decimal"
              placeholder={t("ratePlaceholderNone")}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`ad-monthly-${ad.id}`}>{t("monthlyRateLabel")}</Label>
            <Input
              id={`ad-monthly-${ad.id}`}
              type="number"
              min="0"
              inputMode="decimal"
              placeholder={t("ratePlaceholderNone")}
              value={monthlyRate}
              onChange={(e) => setMonthlyRate(e.target.value)}
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">{t("rateHelper")}</p>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {t("save")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            {tc("preview.button")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            {tc("cancel")}
          </Button>
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
        <AdPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          dialogTitle={tc("preview.dialogTitle")}
          dialogSubtitle={tc("preview.dialogSubtitle")}
          badgeLabel={t("previewBadge")}
          emptyLabel={t("previewEmpty")}
          title={title}
          content={content}
          richContent
          meta={[batch.courseCode, batch.subjectName].filter((v): v is string => Boolean(v))}
        />
      </div>
    </div>
  );
}

function ClassAdCreateForm({
  batches,
  initialBatchId,
  onCreated,
  onCancel,
}: {
  batches: InstituteAdBatchRow[];
  initialBatchId: string | null;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.classAds");
  const tc = useTranslations("instituteDashboard.common");
  const initialBatch = batches.find((b) => b.id === initialBatchId) ?? null;
  const [batchId, setBatchId] = useState(initialBatchId ?? batches[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hourlyRate, setHourlyRate] = useState(initialBatch?.hourlyRate != null ? String(initialBatch.hourlyRate) : "");
  const [monthlyRate, setMonthlyRate] = useState(initialBatch?.monthlyRate != null ? String(initialBatch.monthlyRate) : "");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!batchId || !title.trim() || !hasRichText(content)) return;
    setSaving(true);
    setError(null);
    const [adResult, rateResult] = await Promise.all([
      createClassBatchAd({ batchId, title, content }),
      updateClassBatchRate({
        batchId,
        hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : undefined,
        monthlyRate: monthlyRate.trim() ? Number(monthlyRate) : undefined,
      }),
    ]);
    setSaving(false);
    if (adResult.error || rateResult.error) {
      setError(adResult.error || rateResult.error || null);
      return;
    }
    onCreated();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="mb-3 font-medium text-foreground">{t("createAd")}</p>
      <div className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="new-ad-batch">{t("batchLabel")}</Label>
          <Select value={batchId} onValueChange={(value) => setBatchId(value ?? "")}>
            <SelectTrigger id="new-ad-batch" className="w-full">
              <SelectValue placeholder={t("batchPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {batches.map((batch) => (
                <SelectItem key={batch.id} value={batch.id}>
                  {batch.courseCode ? `${batch.courseCode} · ${batch.title}` : batch.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-ad-title">{t("titleLabel")}</Label>
          <Input
            id="new-ad-title"
            placeholder={t("titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-ad-content">{t("contentLabel")}</Label>
          <RichTextEditor id="new-ad-content" value={content} onChange={setContent} placeholder={t("contentPlaceholder")} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="new-ad-hourly">{t("hourlyRateLabel")}</Label>
            <Input
              id="new-ad-hourly"
              type="number"
              min="0"
              inputMode="decimal"
              placeholder={t("ratePlaceholderNone")}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-ad-monthly">{t("monthlyRateLabel")}</Label>
            <Input
              id="new-ad-monthly"
              type="number"
              min="0"
              inputMode="decimal"
              placeholder={t("ratePlaceholderNone")}
              value={monthlyRate}
              onChange={(e) => setMonthlyRate(e.target.value)}
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">{t("rateHelper")}</p>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={handleCreate} disabled={saving || !batchId}>
            {t("save")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            {tc("preview.button")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            {tc("cancel")}
          </Button>
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
        <AdPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          dialogTitle={tc("preview.dialogTitle")}
          dialogSubtitle={tc("preview.dialogSubtitle")}
          badgeLabel={t("previewBadge")}
          emptyLabel={t("previewEmpty")}
          title={title}
          content={content}
          richContent
        />
      </div>
    </div>
  );
}

function PromotionsSection({
  promotions,
  onDeleted,
  onChanged,
}: {
  promotions: InstitutePromotionRow[];
  onDeleted: (id: string) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads");
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {promotions.length === 0 && !creating && (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{t("noPromotions")}</div>
      )}

      {promotions.map((promotion) => (
        <PromotionCard key={promotion.id} promotion={promotion} onDeleted={() => onDeleted(promotion.id)} onSaved={onChanged} />
      ))}

      {creating ? (
        <PromotionCreateForm
          onCreated={() => {
            setCreating(false);
            onChanged();
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setCreating(true)}>
          {t("addPromotion")}
        </Button>
      )}
    </div>
  );
}

function PromotionCard({
  promotion,
  onDeleted,
  onSaved,
}: {
  promotion: InstitutePromotionRow;
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads");
  const tc = useTranslations("instituteDashboard.common");
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(promotion.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await updateInstitutePromotion(promotion.id, content);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    onSaved();
  }

  async function handleDelete() {
    if (!window.confirm(t("confirmDeletePromotion"))) return;
    setDeleting(true);
    setError(null);
    const result = await deleteInstitutePromotion(promotion.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDeleted();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      {!editing ? (
        <div>
          <p className="text-sm text-foreground/85">{promotion.content}</p>
          <div className="mt-3 flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              {t("editPromotion")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {t("deletePromotion")}
            </Button>
          </div>
          {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            rows={4}
            className={textareaClass}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <AdPreviewCard badgeLabel={t("previewBadge")} emptyLabel={t("previewEmpty")} content={content} />
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {t("save")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              {tc("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function PromotionCreateForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const t = useTranslations("instituteDashboard.ads");
  const tc = useTranslations("instituteDashboard.common");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createInstitutePromotion(content);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onCreated();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-input bg-white p-5">
      <div className="grid gap-1.5">
        <Label htmlFor="new-promotion-content">{t("promotionLabel")}</Label>
        <textarea
          id="new-promotion-content"
          rows={4}
          placeholder={t("promotionPlaceholder")}
          className={textareaClass}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <AdPreviewCard badgeLabel={t("previewBadge")} emptyLabel={t("previewEmpty")} content={content} />
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={handleCreate} disabled={saving}>
          {t("save")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          {tc("cancel")}
        </Button>
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>
    </div>
  );
}

/**
 * "Teacher-Wise Ad" (0140, mockup section 2.4) — an ad about one specific
 * staff member, under the institute's own name. Only ever offered for
 * teachers genuinely on the accepted roster (teacherOptions, resolved
 * server-side too in createTeacherWiseAd).
 */
function TeacherAdsTable({
  teacherOptions,
  ads,
  onDeleted,
  onChanged,
}: {
  teacherOptions: InstituteTeacherOption[];
  ads: InstituteTeacherAdRow[];
  onDeleted: (adId: string) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.teacherAds");
  const tc = useTranslations("instituteDashboard.common");
  const [createOpen, setCreateOpen] = useState(false);

  const sorted = useMemo(
    () => [...ads].sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()),
    [ads],
  );
  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(sorted.length);
  const paged = sorted.slice(offset, offset + pageSize);

  if (teacherOptions.length === 0 && ads.length === 0) {
    return <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{t("noTeachers")}</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {teacherOptions.length > 0 &&
        (createOpen ? (
          <TeacherAdCreateForm
            teacherOptions={teacherOptions}
            onCreated={() => {
              setCreateOpen(false);
              onChanged();
            }}
            onCancel={() => setCreateOpen(false)}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-input bg-white p-5">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              {t("createAd")}
            </Button>
          </div>
        ))}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noAdYet")}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.teacher")}</TableHead>
                <TableHead>{t("table.date")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((ad, i) => (
                <TeacherAdRow key={ad.id} ad={ad} striped={i % 2 === 1} onDeleted={() => onDeleted(ad.id)} onSaved={onChanged} />
              ))}
            </TableBody>
          </Table>
          <div className="px-4 pb-4">
            <PaginationFooter
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              showingLabel={tc("pagination.showingCount", { shown: paged.length, total: sorted.length })}
              previousLabel={tc("pagination.previous")}
              nextLabel={tc("pagination.next")}
              pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherAdRow({
  ad,
  striped,
  onDeleted,
  onSaved,
}: {
  ad: InstituteTeacherAdRow;
  striped: boolean;
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.teacherAds");
  const tc = useTranslations("instituteDashboard.common");
  const [editOpen, setEditOpen] = useState(false);
  const [active, setActive] = useState(ad.status === "active");
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(checked: boolean) {
    setToggling(true);
    const result = await setClassBatchAdActive(ad.id, checked);
    setToggling(false);
    if (!result.error) setActive(checked);
  }

  async function handleDelete() {
    if (!window.confirm(t("confirmDelete"))) return;
    setDeleting(true);
    setError(null);
    const result = await deleteClassBatchAd(ad.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDeleted();
  }

  return (
    <>
      <TableRow className={striped ? "bg-muted/70" : undefined}>
        <TableCell className="font-medium text-foreground">{ad.teacherName}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{ad.createdLabel}</TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{t("viewCount", { count: ad.viewCount })}</span>
            <StatusBadge variant={active ? "active" : "closed"}>{active ? t("active") : t("paused")}</StatusBadge>
            <Switch checked={active} onCheckedChange={handleToggle} disabled={toggling} />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {active && (
              <Link
                href={`/ad/${ad.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                {tc("view")}
              </Link>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              {t("editAd")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {t("deleteAd")}
            </Button>
          </div>
          {error && <p className="mt-1 text-right text-xs font-medium text-destructive">{error}</p>}
        </TableCell>
      </TableRow>

      {editOpen && (
        <TableRow className={striped ? "bg-muted/70" : undefined}>
          <TableCell colSpan={4} className="pt-0">
            <TeacherAdEditForm
              ad={ad}
              onSaved={() => {
                setEditOpen(false);
                onSaved();
              }}
              onCancel={() => setEditOpen(false)}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function TeacherAdEditForm({
  ad,
  onSaved,
  onCancel,
}: {
  ad: InstituteTeacherAdRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.teacherAds");
  const tc = useTranslations("instituteDashboard.common");
  const [title, setTitle] = useState(ad.title);
  const [content, setContent] = useState(ad.content);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim() || !hasRichText(content)) return;
    setSaving(true);
    setError(null);
    const result = await updateClassBatchAd(ad.id, { title, content });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="mb-3 font-medium text-foreground">{t("editAd")}</p>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{ad.teacherName}</p>
        <div className="grid gap-1.5">
          <Label htmlFor={`teacher-ad-edit-title-${ad.id}`}>{t("titleLabel")}</Label>
          <Input id={`teacher-ad-edit-title-${ad.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`teacher-ad-edit-content-${ad.id}`}>{t("contentLabel")}</Label>
          <RichTextEditor
            id={`teacher-ad-edit-content-${ad.id}`}
            value={content}
            onChange={setContent}
            placeholder={t("contentPlaceholder")}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {t("save")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            {tc("preview.button")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            {tc("cancel")}
          </Button>
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
        <AdPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          dialogTitle={tc("preview.dialogTitle")}
          dialogSubtitle={tc("preview.dialogSubtitle")}
          badgeLabel={t("previewBadge")}
          emptyLabel={t("previewEmpty")}
          title={title}
          content={content}
          richContent
          meta={[ad.teacherName]}
        />
      </div>
    </div>
  );
}

function TeacherAdCreateForm({
  teacherOptions,
  onCreated,
  onCancel,
}: {
  teacherOptions: InstituteTeacherOption[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.teacherAds");
  const tc = useTranslations("instituteDashboard.common");
  const [teacherId, setTeacherId] = useState(teacherOptions[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!teacherId || !title.trim() || !hasRichText(content)) return;
    setSaving(true);
    setError(null);
    const result = await createTeacherWiseAd({ teacherId, title, content });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onCreated();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="mb-3 font-medium text-foreground">{t("createAd")}</p>
      <div className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="teacher-ad-teacher">{t("heading")}</Label>
          <Select value={teacherId} onValueChange={(value) => setTeacherId(value ?? "")}>
            <SelectTrigger id="teacher-ad-teacher" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {teacherOptions.map((teacher) => (
                <SelectItem key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="teacher-ad-title">{t("titleLabel")}</Label>
          <Input
            id="teacher-ad-title"
            placeholder={t("titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="teacher-ad-content">{t("contentLabel")}</Label>
          <RichTextEditor id="teacher-ad-content" value={content} onChange={setContent} placeholder={t("contentPlaceholder")} />
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={handleCreate} disabled={saving}>
            {t("save")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            {tc("preview.button")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            {tc("cancel")}
          </Button>
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
        <AdPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          dialogTitle={tc("preview.dialogTitle")}
          dialogSubtitle={tc("preview.dialogSubtitle")}
          badgeLabel={t("previewBadge")}
          emptyLabel={t("previewEmpty")}
          title={title}
          content={content}
          richContent
          meta={[teacherOptions.find((t2) => t2.id === teacherId)?.name].filter((v): v is string => Boolean(v))}
        />
      </div>
    </div>
  );
}

const VACANCY_MODES = ["online", "physical"] as const;

/** "Vacancy Ad" (0141, mockup section 2.4) — institute posts an opening,
 * teachers browse+apply from their own dashboard (teacher/institute-tab.tsx's
 * VacancyBrowsePanel). */
function VacanciesTable({
  subjectOptions,
  vacancies,
  applications,
  onDeleted,
  onChanged,
}: {
  subjectOptions: { id: string; name: string }[];
  vacancies: InstituteVacancyRow[];
  applications: VacancyApplicationRow[];
  onDeleted: (id: string) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.vacancies");
  const tc = useTranslations("instituteDashboard.common");
  const [createOpen, setCreateOpen] = useState(false);

  // Already sorted newest-first server-side (vacancy_ads query orders by
  // created_at desc) — no re-sort needed, just paginate.
  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(vacancies.length);
  const paged = vacancies.slice(offset, offset + pageSize);

  return (
    <div className="flex flex-col gap-3">
      {createOpen ? (
        <VacancyCreateForm
          subjectOptions={subjectOptions}
          onCreated={() => {
            setCreateOpen(false);
            onChanged();
          }}
          onCancel={() => setCreateOpen(false)}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-input bg-white p-5">
          <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            {t("createAd")}
          </Button>
        </div>
      )}

      {vacancies.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noVacancies")}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.vacancy")}</TableHead>
                <TableHead>{t("table.date")}</TableHead>
                <TableHead>{t("table.applicants")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((vacancy, i) => (
                <VacancyRow
                  key={vacancy.id}
                  vacancy={vacancy}
                  applications={applications.filter((a) => a.vacancyId === vacancy.id)}
                  subjectOptions={subjectOptions}
                  striped={i % 2 === 1}
                  onDeleted={() => onDeleted(vacancy.id)}
                  onSaved={onChanged}
                />
              ))}
            </TableBody>
          </Table>
          <div className="px-4 pb-4">
            <PaginationFooter
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              showingLabel={tc("pagination.showingCount", { shown: paged.length, total: vacancies.length })}
              previousLabel={tc("pagination.previous")}
              nextLabel={tc("pagination.next")}
              pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function VacancyRow({
  vacancy,
  applications,
  subjectOptions,
  striped,
  onDeleted,
  onSaved,
}: {
  vacancy: InstituteVacancyRow;
  applications: VacancyApplicationRow[];
  subjectOptions: { id: string; name: string }[];
  striped: boolean;
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.vacancies");
  const [editOpen, setEditOpen] = useState(false);
  const [applicantsOpen, setApplicantsOpen] = useState(false);
  const [active, setActive] = useState(vacancy.active);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(checked: boolean) {
    setToggling(true);
    const result = await setVacancyAdStatus(vacancy.id, checked);
    setToggling(false);
    if (!result.error) setActive(checked);
  }

  async function handleDelete() {
    if (!window.confirm(t("confirmDelete"))) return;
    setDeleting(true);
    setError(null);
    const result = await deleteVacancyAd(vacancy.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDeleted();
  }

  return (
    <>
      <TableRow className={striped ? "bg-muted/70" : undefined}>
        <TableCell className="whitespace-normal">
          <p className="font-medium text-foreground">{vacancy.title}</p>
          <p className="text-xs text-muted-foreground">
            {[vacancy.subjectName, vacancy.mode === "online" ? t("modeOnline") : t("modePhysical"), vacancy.location]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{vacancy.createdLabel}</TableCell>
        <TableCell>
          <Button type="button" variant="ghost" size="sm" onClick={() => setApplicantsOpen(true)} disabled={applications.length === 0}>
            {t("applicantsHeading")} ({applications.length})
          </Button>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant={active ? "active" : "closed"}>{active ? t("active") : t("closed")}</StatusBadge>
            <Switch checked={active} onCheckedChange={handleToggle} disabled={toggling} />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              {t("editAd")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {t("deleteAd")}
            </Button>
          </div>
          {error && <p className="mt-1 text-right text-xs font-medium text-destructive">{error}</p>}
        </TableCell>
      </TableRow>

      {editOpen && (
        <TableRow className={striped ? "bg-muted/70" : undefined}>
          <TableCell colSpan={5} className="pt-0">
            <VacancyEditForm
              vacancy={vacancy}
              subjectOptions={subjectOptions}
              onSaved={() => {
                setEditOpen(false);
                onSaved();
              }}
              onCancel={() => setEditOpen(false)}
            />
          </TableCell>
        </TableRow>
      )}

      <Dialog open={applicantsOpen} onOpenChange={setApplicantsOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("applicantsHeading")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {applications.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noApplicants")}</p>
            ) : (
              applications.map((application) => <VacancyApplicationItem key={application.id} application={application} />)
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VacancyEditForm({
  vacancy,
  subjectOptions,
  onSaved,
  onCancel,
}: {
  vacancy: InstituteVacancyRow;
  subjectOptions: { id: string; name: string }[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.vacancies");
  const tc = useTranslations("instituteDashboard.common");
  const [subjectId, setSubjectId] = useState(vacancy.subjectId ?? "");
  const [mode, setMode] = useState<"online" | "physical">(vacancy.mode ?? "physical");
  const [location, setLocation] = useState(vacancy.location ?? "");
  const [title, setTitle] = useState(vacancy.title);
  const [content, setContent] = useState(vacancy.content);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim() || !hasRichText(content)) return;
    setSaving(true);
    setError(null);
    const result = await updateVacancyAd(vacancy.id, { subjectId, mode, location, title, content });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="mb-3 font-medium text-foreground">{t("editAd")}</p>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>{t("subjectLabel")}</Label>
            {subjectOptions.length > 0 ? (
              <Select value={subjectId} onValueChange={(value) => setSubjectId(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("subjectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">{t("subjectPlaceholder")}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>{t("modeLabel")}</Label>
            <Select value={mode} onValueChange={(value) => setMode((value as "online" | "physical") ?? "physical")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VACANCY_MODES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "online" ? t("modeOnline") : t("modePhysical")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("locationLabel")}</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>{t("titleLabel")}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("contentLabel")}</Label>
          <RichTextEditor value={content} onChange={setContent} placeholder={t("contentPlaceholder")} />
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {tc("save")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            {tc("preview.button")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            {tc("cancel")}
          </Button>
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
        <AdPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          dialogTitle={tc("preview.dialogTitle")}
          dialogSubtitle={tc("preview.dialogSubtitle")}
          badgeLabel={t("previewBadge")}
          emptyLabel={t("previewEmpty")}
          title={title}
          content={content}
          richContent
          meta={[subjectOptions.find((s) => s.id === subjectId)?.name, mode === "online" ? t("modeOnline") : t("modePhysical"), location].filter(
            (v): v is string => Boolean(v),
          )}
        />
      </div>
    </div>
  );
}

function VacancyCreateForm({
  subjectOptions,
  onCreated,
  onCancel,
}: {
  subjectOptions: { id: string; name: string }[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.vacancies");
  const tc = useTranslations("instituteDashboard.common");
  const [subjectId, setSubjectId] = useState("");
  const [mode, setMode] = useState<"online" | "physical">("physical");
  const [location, setLocation] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim() || !hasRichText(content)) return;
    setSaving(true);
    setError(null);
    const result = await createVacancyAd({ subjectId, mode, location, title, content });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onCreated();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="mb-3 font-medium text-foreground">{t("createAd")}</p>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="vacancy-subject">{t("subjectLabel")}</Label>
            {subjectOptions.length > 0 ? (
              <Select value={subjectId} onValueChange={(value) => setSubjectId(value ?? "")}>
                <SelectTrigger id="vacancy-subject" className="w-full">
                  <SelectValue placeholder={t("subjectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              // Subject is optional here (unlike the class/course ad forms,
              // where it's required and blocked instead) — with no known
              // subjects yet to offer, this field just stays skippable rather
              // than accepting free text into what createVacancyAd validates
              // as a real subject id.
              <p className="text-sm text-muted-foreground">{t("subjectPlaceholder")}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vacancy-mode">{t("modeLabel")}</Label>
            <Select value={mode} onValueChange={(value) => setMode((value as "online" | "physical") ?? "physical")}>
              <SelectTrigger id="vacancy-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VACANCY_MODES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "online" ? t("modeOnline") : t("modePhysical")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vacancy-location">{t("locationLabel")}</Label>
            <Input
              id="vacancy-location"
              placeholder={t("locationPlaceholder")}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="vacancy-title">{t("titleLabel")}</Label>
          <Input id="vacancy-title" placeholder={t("titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="vacancy-content">{t("contentLabel")}</Label>
          <RichTextEditor id="vacancy-content" value={content} onChange={setContent} placeholder={t("contentPlaceholder")} />
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={handleCreate} disabled={saving}>
            {t("save")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            {tc("preview.button")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            {tc("cancel")}
          </Button>
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
        <AdPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          dialogTitle={tc("preview.dialogTitle")}
          dialogSubtitle={tc("preview.dialogSubtitle")}
          badgeLabel={t("previewBadge")}
          emptyLabel={t("previewEmpty")}
          title={title}
          content={content}
          richContent
          meta={[subjectOptions.find((s) => s.id === subjectId)?.name, mode === "online" ? t("modeOnline") : t("modePhysical"), location].filter(
            (v): v is string => Boolean(v),
          )}
        />
      </div>
    </div>
  );
}

function VacancyApplicationItem({ application }: { application: VacancyApplicationRow }) {
  const t = useTranslations("instituteDashboard.ads.vacancies");
  const [deciding, setDeciding] = useState(false);
  const [status, setStatus] = useState(application.status);
  const [error, setError] = useState<string | null>(null);

  async function handleDecision(accepted: boolean) {
    setDeciding(true);
    setError(null);
    const result = await respondToVacancyApplicationDecision(application.id, accepted);
    setDeciding(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatus(accepted ? "accepted" : "declined");
  }

  const decided = status === "accepted" || status === "declined";

  return (
    <div className="rounded-md bg-background px-3 py-2">
      <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">{application.teacherName}</span>
        <span className="text-xs text-muted-foreground">{application.createdLabel}</span>
      </div>
      <p className="text-sm text-foreground/85">{application.message}</p>
      {decided ? (
        <p className={`mt-1 text-xs font-medium ${status === "accepted" ? "text-success" : "text-destructive"}`}>
          {t(`applicantStatus.${status}`)}
        </p>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => handleDecision(true)} disabled={deciding}>
            {t("accept")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleDecision(false)} disabled={deciding}>
            {t("decline")}
          </Button>
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
      )}
    </div>
  );
}
