"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/features/status-badge";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { cancelJoinRequest } from "@/lib/dashboard/batches-actions";

export type JoinRequestRow = {
  enrollmentId: string;
  ownerId: string;
  ownerType: "teacher" | "class";
  ownerName: string;
  batchId: string | null;
  batchTitle: string | null;
  isCampusLecturer: boolean;
  status: "pending" | "declined";
  declineReason: string | null;
  requestedAtLabel: string;
};

/**
 * Split out of My Classes' old inline "Pending requests" block into its own
 * tab (Gehan wanted requests managed separately from classes already
 * joined) — now also carries declined requests (with the owner's optional
 * reason, see 0115) so a decline isn't just a silent disappearance, and lets
 * a student withdraw a request that's still pending. A declined row stays
 * visible here as a record only; re-requesting happens the normal way, by
 * finding the class again under My Classes' browse list.
 */
export function JoinRequestsTab({ requests }: { requests: JoinRequestRow[] }) {
  const t = useTranslations("studentDashboard.requests");
  const tc = useTranslations("studentDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const visible = requests.filter((r) => !handledIds.has(r.enrollmentId));

  async function handleCancel(enrollmentId: string) {
    setCancellingId(enrollmentId);
    const result = await cancelJoinRequest(enrollmentId);
    setCancellingId(null);
    if (result.error) return;
    setHandledIds((prev) => new Set(prev).add(enrollmentId));
    refresh();
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
        className="mb-5"
      />

      {visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{t("empty")}</div>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((item) => (
            <div
              key={item.enrollmentId}
              className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{item.ownerName}</span>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {item.isCampusLecturer
                      ? t("typeCampusLecturer")
                      : item.ownerType === "teacher"
                        ? t("typeTeacher")
                        : t("typeClass")}
                  </span>
                  {item.status === "declined" ? (
                    <StatusBadge variant="flagged">{t("statusDeclined")}</StatusBadge>
                  ) : (
                    <StatusBadge variant="pending">{t("statusPending")}</StatusBadge>
                  )}
                </div>
                {item.batchTitle && <div className="text-sm text-muted-foreground">{item.batchTitle}</div>}
                <div className="text-xs text-muted-foreground">{item.requestedAtLabel}</div>
                {item.status === "declined" && item.declineReason && (
                  <div className="mt-2 rounded-md bg-secondary/60 px-3 py-2 text-sm text-foreground/85">
                    <span className="font-medium">{t("declineReasonLabel")}: </span>
                    {item.declineReason}
                  </div>
                )}
              </div>
              {item.status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCancel(item.enrollmentId)}
                  disabled={cancellingId === item.enrollmentId}
                >
                  {cancellingId === item.enrollmentId ? t("cancelling") : t("cancelRequest")}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
