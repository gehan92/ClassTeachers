"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AdSlot } from "@/components/features/ad-slot";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { StatCard } from "@/components/dashboard/stat-card";
import { AdPreviewCard } from "@/components/dashboard/ad-preview-card";
import { AdHistoryList, type AdHistoryRow } from "@/components/dashboard/ad-history-list";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
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

export type InstituteAdRow = {
  id: string;
  title: string;
  content: string;
  status: "active" | "expired" | "removed";
  viewCount: number;
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
          <div className="flex flex-col gap-5">
            {batches.map((batch) => (
              <ClassBatchAdsSection
                key={batch.id}
                batch={{ ...batch, ads: batch.ads.filter((ad) => !deletedAdIds.has(ad.id)) }}
                onAdDeleted={(adId) => {
                  setDeletedAdIds((prev) => new Set(prev).add(adId));
                  refresh();
                }}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-lg">{t("teacherAds.heading")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t("teacherAds.subtitle")}</p>
        <div className="flex flex-col gap-4">
          <TeacherAdCreateForm teacherOptions={teacherOptions} onCreated={refresh} />
          {visibleTeacherAds.map((ad) => (
            <TeacherAdCard
              key={ad.id}
              ad={ad}
              onDeleted={() => {
                setDeletedTeacherAdIds((prev) => new Set(prev).add(ad.id));
                refresh();
              }}
              onSaved={refresh}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-lg">{t("vacancies.heading")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t("vacancies.subtitle")}</p>
        <div className="flex flex-col gap-4">
          <VacancyCreateForm subjectOptions={subjectOptions} onCreated={refresh} />
          {visibleVacancies.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("vacancies.noVacancies")}</p>
          )}
          {visibleVacancies.map((vacancy) => (
            <VacancyCard
              key={vacancy.id}
              vacancy={vacancy}
              applications={vacancyApplications.filter((a) => a.vacancyId === vacancy.id)}
              subjectOptions={subjectOptions}
              onDeleted={() => {
                setDeletedVacancyIds((prev) => new Set(prev).add(vacancy.id));
                refresh();
              }}
              onSaved={refresh}
            />
          ))}
        </div>
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

function ClassBatchAdsSection({
  batch,
  onAdDeleted,
  onChanged,
}: {
  batch: InstituteAdBatchRow;
  onAdDeleted: (adId: string) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.classAds");
  const [creating, setCreating] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="mb-3">
        <h4 className="text-base font-medium text-foreground">
          {batch.courseCode && <span className="text-muted-foreground">{batch.courseCode} · </span>}
          {batch.title}
        </h4>
        <p className="text-sm text-muted-foreground">
          {batch.subjectName ? t("batchSubject", { subject: batch.subjectName }) : t("noSubjectYet")}
          {batch.totalSessions ? ` · ${t("sessionsCount", { count: batch.totalSessions })}` : ""}
        </p>
      </div>

      <ClassBatchRateForm batch={batch} onSaved={onChanged} />

      {batch.ads.length === 0 && !creating && <p className="mb-3 text-sm text-muted-foreground">{t("noAdYet")}</p>}

      {batch.ads.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          {batch.ads.map((ad) => (
            <ClassBatchAdCard key={ad.id} ad={ad} onDeleted={() => onAdDeleted(ad.id)} onSaved={onChanged} />
          ))}
        </div>
      )}

      {creating ? (
        <ClassBatchAdCreateForm
          batchId={batch.id}
          onCreated={() => {
            setCreating(false);
            onChanged();
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
          {batch.ads.length === 0 ? t("createAd") : t("addAnotherAd")}
        </Button>
      )}
    </div>
  );
}

function ClassBatchRateForm({ batch, onSaved }: { batch: InstituteAdBatchRow; onSaved: () => void }) {
  const t = useTranslations("instituteDashboard.ads.classAds");
  const [hourlyRate, setHourlyRate] = useState(batch.hourlyRate != null ? String(batch.hourlyRate) : "");
  const [monthlyRate, setMonthlyRate] = useState(batch.monthlyRate != null ? String(batch.monthlyRate) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateClassBatchRate({
      batchId: batch.id,
      hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : undefined,
      monthlyRate: monthlyRate.trim() ? Number(monthlyRate) : undefined,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  }

  return (
    <div className="mb-4 rounded-md border border-border bg-background p-3.5">
      <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {t("rateHeading")}
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={`rate-hourly-${batch.id}`}>{t("hourlyRateLabel")}</Label>
          <Input
            id={`rate-hourly-${batch.id}`}
            type="number"
            min="0"
            inputMode="decimal"
            placeholder={t("ratePlaceholderNone")}
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`rate-monthly-${batch.id}`}>{t("monthlyRateLabel")}</Label>
          <Input
            id={`rate-monthly-${batch.id}`}
            type="number"
            min="0"
            inputMode="decimal"
            placeholder={t("ratePlaceholderNone")}
            value={monthlyRate}
            onChange={(e) => setMonthlyRate(e.target.value)}
          />
        </div>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {t("saveRate")}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("rateHelper")}</p>
      {saved && <p className="animate-in fade-in-0 mt-1 text-xs font-medium text-success duration-200">{t("rateSaved")}</p>}
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

function ClassBatchAdCard({ ad, onDeleted, onSaved }: { ad: InstituteAdRow; onDeleted: () => void; onSaved: () => void }) {
  const t = useTranslations("instituteDashboard.ads.classAds");
  const tc = useTranslations("instituteDashboard.common");

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(ad.title);
  const [content, setContent] = useState(ad.content);
  const [active, setActive] = useState(ad.status === "active");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await updateClassBatchAd(ad.id, { title, content });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    onSaved();
  }

  async function handleToggle(checked: boolean) {
    setToggling(true);
    const result = await setClassBatchAdActive(ad.id, checked);
    setToggling(false);
    if (!result.error) {
      setActive(checked);
    }
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
    <div className="rounded-md border border-border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">{t("viewCount", { count: ad.viewCount })}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${active ? "text-success" : "text-muted-foreground"}`}>
            {active ? t("active") : t("paused")}
          </span>
          <Switch checked={active} onCheckedChange={handleToggle} disabled={toggling} />
        </div>
      </div>

      {!editing ? (
        <div>
          <p className="text-sm font-medium text-foreground">{ad.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{ad.content}</p>
          <div className="mt-3 flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
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
          {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`ad-title-${ad.id}`}>{t("titleLabel")}</Label>
            <Input id={`ad-title-${ad.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`ad-content-${ad.id}`}>{t("contentLabel")}</Label>
            <textarea
              id={`ad-content-${ad.id}`}
              className={textareaClass}
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <AdPreviewCard badgeLabel={t("previewBadge")} emptyLabel={t("previewEmpty")} title={title} content={content} />
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

function ClassBatchAdCreateForm({
  batchId,
  onCreated,
  onCancel,
}: {
  batchId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.classAds");
  const tc = useTranslations("instituteDashboard.common");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createClassBatchAd({ batchId, title, content });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onCreated();
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed border-input p-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`new-ad-title-${batchId}`}>{t("titleLabel")}</Label>
        <Input
          id={`new-ad-title-${batchId}`}
          placeholder={t("titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`new-ad-content-${batchId}`}>{t("contentLabel")}</Label>
        <textarea
          id={`new-ad-content-${batchId}`}
          className={textareaClass}
          rows={4}
          placeholder={t("contentPlaceholder")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <AdPreviewCard badgeLabel={t("previewBadge")} emptyLabel={t("previewEmpty")} title={title} content={content} />
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
function TeacherAdCreateForm({ teacherOptions, onCreated }: { teacherOptions: InstituteTeacherOption[]; onCreated: () => void }) {
  const t = useTranslations("instituteDashboard.ads.teacherAds");
  const tc = useTranslations("instituteDashboard.common");
  const [open, setOpen] = useState(false);
  const [teacherId, setTeacherId] = useState(teacherOptions[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!teacherId || !title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createTeacherWiseAd({ teacherId, title, content });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setTitle("");
    setContent("");
    onCreated();
  }

  if (teacherOptions.length === 0) {
    return <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{t("noTeachers")}</div>;
  }

  if (!open) {
    return (
      <div className="rounded-lg border border-dashed border-input bg-white p-5">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          {t("createAd")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5">
      <div className="grid gap-1.5 sm:max-w-72">
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
        <textarea
          id="teacher-ad-content"
          rows={4}
          className={textareaClass}
          placeholder={t("contentPlaceholder")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <AdPreviewCard badgeLabel={t("previewBadge")} emptyLabel={t("previewEmpty")} title={title} content={content} />
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={handleCreate} disabled={saving}>
          {t("save")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          {tc("cancel")}
        </Button>
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>
    </div>
  );
}

function TeacherAdCard({
  ad,
  onDeleted,
  onSaved,
}: {
  ad: InstituteTeacherAdRow;
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.teacherAds");
  const tc = useTranslations("instituteDashboard.common");

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(ad.title);
  const [content, setContent] = useState(ad.content);
  const [active, setActive] = useState(ad.status === "active");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await updateClassBatchAd(ad.id, { title, content });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    onSaved();
  }

  async function handleToggle(checked: boolean) {
    setToggling(true);
    const result = await setClassBatchAdActive(ad.id, checked);
    setToggling(false);
    if (!result.error) {
      setActive(checked);
    }
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
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <h4 className="text-base font-medium text-foreground">{ad.teacherName}</h4>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{t("viewCount", { count: ad.viewCount })}</span>
          <span className={`text-xs font-medium ${active ? "text-success" : "text-muted-foreground"}`}>
            {active ? t("active") : t("paused")}
          </span>
          <Switch checked={active} onCheckedChange={handleToggle} disabled={toggling} />
        </div>
      </div>

      {!editing ? (
        <div>
          <p className="text-sm font-medium text-foreground">{ad.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{ad.content}</p>
          <div className="mt-3 flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
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
          {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`teacher-ad-edit-title-${ad.id}`}>{t("titleLabel")}</Label>
            <Input id={`teacher-ad-edit-title-${ad.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`teacher-ad-edit-content-${ad.id}`}>{t("contentLabel")}</Label>
            <textarea
              id={`teacher-ad-edit-content-${ad.id}`}
              className={textareaClass}
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <AdPreviewCard badgeLabel={t("previewBadge")} emptyLabel={t("previewEmpty")} title={title} content={content} />
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

const VACANCY_MODES = ["online", "physical"] as const;

/** "Vacancy Ad" (0141, mockup section 2.4) — institute posts an opening,
 * teachers browse+apply from their own dashboard (teacher/institute-tab.tsx's
 * VacancyBrowsePanel). */
function VacancyCreateForm({
  subjectOptions,
  onCreated,
}: {
  subjectOptions: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.vacancies");
  const tc = useTranslations("instituteDashboard.common");
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [mode, setMode] = useState<"online" | "physical">("physical");
  const [location, setLocation] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createVacancyAd({ subjectId, mode, location, title, content });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setSubjectId("");
    setLocation("");
    setTitle("");
    setContent("");
    onCreated();
  }

  if (!open) {
    return (
      <div className="rounded-lg border border-dashed border-input bg-white p-5">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          {t("createAd")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5">
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
        <textarea
          id="vacancy-content"
          rows={4}
          className={textareaClass}
          placeholder={t("contentPlaceholder")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <AdPreviewCard badgeLabel={t("previewBadge")} emptyLabel={t("previewEmpty")} title={title} content={content} />
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={handleCreate} disabled={saving}>
          {t("save")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          {tc("cancel")}
        </Button>
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>
    </div>
  );
}

function VacancyCard({
  vacancy,
  applications,
  subjectOptions,
  onDeleted,
  onSaved,
}: {
  vacancy: InstituteVacancyRow;
  applications: VacancyApplicationRow[];
  subjectOptions: { id: string; name: string }[];
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("instituteDashboard.ads.vacancies");
  const tc = useTranslations("instituteDashboard.common");

  const [editing, setEditing] = useState(false);
  const [subjectId, setSubjectId] = useState(vacancy.subjectId ?? "");
  const [mode, setMode] = useState<"online" | "physical">(vacancy.mode ?? "physical");
  const [location, setLocation] = useState(vacancy.location ?? "");
  const [title, setTitle] = useState(vacancy.title);
  const [content, setContent] = useState(vacancy.content);
  const [active, setActive] = useState(vacancy.active);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await updateVacancyAd(vacancy.id, { subjectId, mode, location, title, content });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    onSaved();
  }

  async function handleToggle(checked: boolean) {
    setToggling(true);
    const result = await setVacancyAdStatus(vacancy.id, checked);
    setToggling(false);
    if (!result.error) {
      setActive(checked);
    }
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
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-medium text-foreground">{vacancy.title}</h4>
          <p className="text-sm text-muted-foreground">
            {[vacancy.subjectName, vacancy.mode === "online" ? t("modeOnline") : t("modePhysical"), vacancy.location]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${active ? "text-success" : "text-muted-foreground"}`}>
            {active ? t("active") : t("closed")}
          </span>
          <Switch checked={active} onCheckedChange={handleToggle} disabled={toggling} />
        </div>
      </div>

      {!editing ? (
        <div>
          <p className="text-sm text-foreground/85">{vacancy.content}</p>
          <div className="mt-3 flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
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
          {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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
            <textarea className={textareaClass} rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {tc("save")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              {tc("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}

      {applications.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{t("applicantsHeading")}</p>
          <div className="flex flex-col gap-2">
            {applications.map((application) => (
              <VacancyApplicationItem key={application.id} application={application} />
            ))}
          </div>
        </div>
      )}
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
