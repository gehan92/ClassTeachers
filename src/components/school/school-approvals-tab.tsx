"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Hourglass, Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/features/status-badge";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useRoleName } from "@/components/school/school-labels";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { cancelSchoolApproval, decideSchoolApproval } from "@/lib/school/actions";
import { SCHOOL_AREAS, type SchoolArea } from "@/lib/school/catalog";
import { cn } from "@/lib/utils";
import type { SchoolApprovalRow, SchoolRoleRow } from "@/types/school";

type Filter = "waiting" | "mine" | "decided";

/**
 * Changes that wait for a decision. A role permission marked "needs
 * approval" files the change here instead of making it; whoever can approve
 * that area (always the Principal) approves or rejects it, with a note.
 */
export function SchoolApprovalsTab({
  approvals,
  approvableAreas,
  roles,
}: {
  approvals: SchoolApprovalRow[];
  /** null = can approve everything (the Principal). */
  approvableAreas: string[] | null;
  roles: SchoolRoleRow[];
}) {
  const t = useTranslations("school.approvals");
  const ts = useTranslations("school");
  const tc = useTranslations("school.common");
  const roleName = useRoleName();
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [filter, setFilter] = useState<Filter>("waiting");
  const [deciding, setDeciding] = useState<{ row: SchoolApprovalRow; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState<Record<string, SchoolApprovalRow["status"]>>({});

  const rows = approvals.map((a) => (closed[a.id] ? { ...a, status: closed[a.id] } : a));
  const canDecide = (row: SchoolApprovalRow) =>
    !row.isMine && row.status === "pending" && (approvableAreas === null || approvableAreas.includes(row.area));
  const waiting = rows.filter((r) => r.status === "pending" && !r.isMine);
  const mine = rows.filter((r) => r.isMine);
  const decided = rows.filter((r) => r.status !== "pending");
  const visible = filter === "waiting" ? waiting : filter === "mine" ? mine : decided;

  // Which role changes go through this queue — so an empty queue still
  // explains itself.
  const rules = useMemo(
    () =>
      roles
        .map((role) => ({
          role,
          items: role.permissions
            .filter((p) => p.needsApproval)
            .map((p) => `${ts(`areas.${p.area}.label`)} · ${ts(`actions.${p.action}`)}`),
        }))
        .filter((r) => r.items.length > 0),
    [roles, ts],
  );

  async function decide() {
    if (!deciding) return;
    setBusyId(deciding.row.id);
    setError(null);
    const result = await decideSchoolApproval({ id: deciding.row.id, decision: deciding.decision, note: note.trim() || undefined });
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setClosed((prev) => ({ ...prev, [deciding.row.id]: deciding.decision }));
    setDeciding(null);
    setNote("");
    refresh();
  }

  async function cancel(row: SchoolApprovalRow) {
    setBusyId(row.id);
    setError(null);
    const result = await cancelSchoolApproval(row.id);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setClosed((prev) => ({ ...prev, [row.id]: "cancelled" }));
    refresh();
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "waiting", label: t("filters.waiting"), count: waiting.length },
    { key: "mine", label: t("filters.mine"), count: mine.length },
    { key: "decided", label: t("filters.decided"), count: decided.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updating")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reload")}
      />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("filtersLabel")}>
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            <span className={cn("font-mono text-[11px] tabular-nums", filter === f.key ? "opacity-80" : "opacity-70")}>{f.count}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </span>
          <h2 className="mt-3 font-display text-lg text-primary">{t(`empty.${filter}.title`)}</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{t(`empty.${filter}.body`)}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((row) => (
            <li key={row.id} className="rounded-xl border border-border bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-primary/[0.07] px-2 py-0.5 text-xs font-medium text-primary">
                      {row.area in SCHOOL_AREAS ? ts(`areas.${row.area as SchoolArea}.label`) : row.area}
                      {" · "}
                      {ts.has(`actions.${row.action}`) ? ts(`actions.${row.action}`) : row.action}
                    </span>
                    <StatusBadge variant={row.status === "pending" ? "pending" : row.status === "approved" ? "active" : "closed"}>
                      {t(`status.${row.status}`)}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm font-medium break-words text-foreground">{row.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.isMine ? t("youAsked", { date: row.createdAt }) : t("askedBy", { name: row.requesterName, date: row.createdAt })}
                  </p>
                  {row.status !== "pending" && row.decidedAt && row.status !== "cancelled" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(row.status === "approved" ? "approvedBy" : "rejectedBy", { name: row.deciderName ?? "—", date: row.decidedAt })}
                    </p>
                  )}
                  {row.decisionNote && (
                    <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-sm text-foreground/85">{row.decisionNote}</p>
                  )}
                </div>
                {canDecide(row) && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => setDeciding({ row, decision: "rejected" })}
                    >
                      <X className="size-4" />
                      {t("reject")}
                    </Button>
                    <Button type="button" size="sm" disabled={busyId === row.id} onClick={() => setDeciding({ row, decision: "approved" })}>
                      <Check className="size-4" />
                      {t("approve")}
                    </Button>
                  </div>
                )}
                {row.isMine && row.status === "pending" && (
                  <Button type="button" variant="ghost" size="sm" disabled={busyId === row.id} onClick={() => cancel(row)}>
                    {t("withdraw")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {approvableAreas === null && (
        <section className="rounded-xl border border-border bg-secondary/40 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Hourglass className="size-4 text-accent-deep" />
            {t("rulesTitle")}
          </h2>
          {rules.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("rulesNone")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {rules.map(({ role, items }) => (
                <li key={role.id}>
                  <span className="font-medium text-foreground">{roleName(role)}:</span>{" "}
                  <span className="text-muted-foreground">{items.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">{t("rulesHint")}</p>
        </section>
      )}

      <Dialog
        open={deciding !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeciding(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deciding?.decision === "approved" ? t("approveTitle") : t("rejectTitle")}</DialogTitle>
            <DialogDescription className="break-words">{deciding?.row.summary}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-note">
              {t("noteLabel")} <span className="font-normal text-muted-foreground">{t("noteOptional")}</span>
            </Label>
            <Textarea id="approval-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} />
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeciding(null)} disabled={busyId !== null}>
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              variant={deciding?.decision === "rejected" ? "destructive" : "default"}
              onClick={decide}
              disabled={busyId !== null}
            >
              {busyId ? tc("saving") : deciding?.decision === "approved" ? t("approve") : t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
