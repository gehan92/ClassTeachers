"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AdSlot } from "@/components/features/ad-slot";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import {
  createClassBatchAd,
  updateClassBatchAd,
  deleteClassBatchAd,
  setClassBatchAdActive,
  updateClassBatchRate,
  createInstitutePromotion,
  updateInstitutePromotion,
  deleteInstitutePromotion,
} from "@/lib/dashboard/ads-actions";

const textareaClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

export type InstituteAdRow = { id: string; title: string; content: string; status: "active" | "expired" | "removed" };

export type InstituteAdBatchRow = {
  id: string;
  title: string;
  subjectName: string | null;
  hourlyRate: number | null;
  monthlyRate: number | null;
  /** Multiple ads per class since 0104 — every active one shows as its own card in search. */
  ads: InstituteAdRow[];
};

export type InstitutePromotionRow = { id: string; content: string };

export function AdvertisementTab({
  promotions,
  batches,
}: {
  promotions: InstitutePromotionRow[];
  batches: InstituteAdBatchRow[];
}) {
  const t = useTranslations("instituteDashboard.ads");
  const tc = useTranslations("instituteDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [deletedAdIds, setDeletedAdIds] = useState<Set<string>>(new Set());
  const [deletedPromotionIds, setDeletedPromotionIds] = useState<Set<string>>(new Set());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
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
        <h4 className="text-base font-medium text-foreground">{batch.title}</h4>
        <p className="text-sm text-muted-foreground">
          {batch.subjectName ? t("batchSubject", { subject: batch.subjectName }) : t("noSubjectYet")}
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
        <span className={`text-xs font-medium ${active ? "text-success" : "text-muted-foreground"}`}>
          {active ? t("active") : t("paused")}
        </span>
        <Switch checked={active} onCheckedChange={handleToggle} disabled={toggling} />
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
