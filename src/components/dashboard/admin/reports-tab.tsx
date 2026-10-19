"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, ExternalLink, Flag, Megaphone, MessageSquareWarning, ShieldCheck, Star, UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TabLink } from "@/components/dashboard/tab-link";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { resolveContentReport } from "@/lib/dashboard/admin-insights-actions";
import { cn } from "@/lib/utils";
import { cardClass } from "./reports/report-kit";
import type { AdminContentReport, ContentReportTarget } from "@/types/dashboard-admin";

type StatusFilter = "open" | "resolved" | "dismissed" | "all";
const STATUS_FILTERS: StatusFilter[] = ["open", "resolved", "dismissed", "all"];

const TARGET_ICONS: Record<ContentReportTarget, typeof Flag> = {
  ad: Megaphone,
  teacher: UserRound,
  institute: Building2,
  review: Star,
  wanted_ad: MessageSquareWarning,
};

/** Can this kind of item be removed straight from the report? Profiles are handled by suspending the account. */
const REMOVABLE: ContentReportTarget[] = ["ad", "wanted_ad", "review"];

/**
 * Admin -> Reports: everything users flagged with the Report button, newest
 * first. Several reports on the same item collapse into one card, and
 * closing it closes them all and tells each reporter the outcome.
 */
export function ReportsTab({ initialReports }: { initialReports: AdminContentReport[] }) {
  const t = useTranslations("adminDashboard.contentReports");
  const { refresh } = useDashboardRefresh();
  const [reports, setReports] = useState(initialReports);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [target, setTarget] = useState<{ report: AdminContentReport; decision: "resolved" | "dismissed" } | null>(null);
  const [note, setNote] = useState("");
  const [removeContent, setRemoveContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map: Record<StatusFilter, number> = { open: 0, resolved: 0, dismissed: 0, all: 0 };
    for (const r of reports) {
      map[r.status] += 1;
      map.all += 1;
    }
    return map;
  }, [reports]);

  // One card per reported item while it's open; closed reports are listed individually.
  const visible = useMemo(() => {
    const list = reports.filter((r) => status === "all" || r.status === status);
    if (status !== "open") return list;
    const seen = new Set<string>();
    return list.filter((r) => {
      const key = `${r.targetType}:${r.targetId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [reports, status]);

  function open(report: AdminContentReport, decision: "resolved" | "dismissed") {
    setTarget({ report, decision });
    setNote("");
    setRemoveContent(false);
    setError(null);
  }

  async function confirm() {
    if (!target) return;
    setSaving(true);
    setError(null);
    const result = await resolveContentReport({
      id: target.report.id,
      decision: target.decision,
      note,
      removeContent: target.decision === "resolved" && removeContent,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const { targetType, targetId } = target.report;
    setReports((prev) =>
      prev.map((r) =>
        r.targetType === targetType && r.targetId === targetId && r.status === "open"
          ? { ...r, status: target.decision, resolutionNote: note }
          : r,
      ),
    );
    setTarget(null);
    refresh();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div role="tablist" aria-label={t("filterLabel")} className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              status === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`status.${s}`)} <span className="ml-1 tabular-nums opacity-70">{counts[s]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className={cn(cardClass, "flex flex-col items-center gap-2 px-6 py-14 text-center")}>
          <ShieldCheck className="size-8 text-success" />
          <p className="text-sm font-semibold text-foreground">{status === "open" ? t("emptyOpen") : t("empty")}</p>
          <p className="max-w-sm text-xs text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((report) => {
            const Icon = TARGET_ICONS[report.targetType];
            const isOpen = report.status === "open";
            return (
              <li key={report.id} className={cn(cardClass, "flex flex-col gap-3 p-4 sm:flex-row sm:items-start")}>
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    isOpen ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">{t(`targets.${report.targetType}`)}</span>
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">{t(`reasons.${report.reason}`)}</span>
                    {isOpen && report.sameTargetCount > 1 && (
                      <span className="rounded-full bg-cta/15 px-2 py-0.5 text-[11px] font-semibold text-accent-deep">
                        {t("sameTarget", { count: report.sameTargetCount })}
                      </span>
                    )}
                    {!isOpen && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", report.status === "resolved" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                        {t(`status.${report.status}`)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{report.targetLabel}</p>
                  {report.details && <p className="mt-1 text-sm whitespace-pre-line text-foreground/80">“{report.details}”</p>}
                  <p className="mt-1.5 text-xs text-muted-foreground">{t("byLine", { name: report.reporterName, date: report.createdAt })}</p>
                  {!isOpen && report.resolutionNote && (
                    <p className="mt-1 text-xs text-muted-foreground">{t("noteLine", { note: report.resolutionNote })}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                  {report.targetHref && (
                    <Link href={report.targetHref} target="_blank" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                      <ExternalLink className="size-3.5" />
                      {t("actions.view")}
                    </Link>
                  )}
                  {(report.targetType === "teacher" || report.targetType === "institute") && isOpen && (
                    <TabLink tab="users" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                      {t("actions.manageUser")}
                    </TabLink>
                  )}
                  {isOpen && (
                    <>
                      <Button size="sm" onClick={() => open(report, "resolved")}>
                        {t("actions.resolve")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => open(report, "dismissed")}>
                        {t("actions.dismiss")}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.decision === "dismissed" ? t("dialog.dismissTitle") : t("dialog.resolveTitle")}</DialogTitle>
            <DialogDescription>
              {target?.decision === "dismissed" ? t("dialog.dismissBody") : t("dialog.resolveBody")}
            </DialogDescription>
          </DialogHeader>
          {target?.decision === "resolved" && REMOVABLE.includes(target.report.targetType) && (
            <label className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox checked={removeContent} onCheckedChange={(v) => setRemoveContent(Boolean(v))} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-foreground">{t("dialog.removeLabel", { kind: t(`targets.${target.report.targetType}`) })}</span>
                <span className="block text-xs text-muted-foreground">{t("dialog.removeHint")}</span>
              </span>
            </label>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="report-note">{removeContent ? t("dialog.reasonLabel") : t("dialog.noteLabel")}</Label>
            <Textarea id="report-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder={t("dialog.notePlaceholder")} />
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTarget(null)} disabled={saving}>
              {t("dialog.cancel")}
            </Button>
            <Button type="button" variant={removeContent ? "destructive" : "default"} onClick={confirm} disabled={saving}>
              {target?.decision === "dismissed" ? t("dialog.confirmDismiss") : removeContent ? t("dialog.confirmRemove") : t("dialog.confirmResolve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
