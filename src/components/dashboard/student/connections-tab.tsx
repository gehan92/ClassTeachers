"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/features/status-badge";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { cancelJoinRequest } from "@/lib/dashboard/batches-actions";
import { JoinAfterQnaPanel } from "@/components/features/join-after-qna-panel";
import type { QnaMessageRow } from "@/components/features/qna-thread";

export type ConnectionRow = {
  enrollmentId: string;
  ownerId: string;
  ownerType: "teacher" | "class";
  ownerName: string;
  batchId: string | null;
  batchTitle: string | null;
  isCampusLecturer: boolean;
  status: "pending" | "qna_open" | "declined";
  declineReason: string | null;
  requestedAtLabel: string;
  qnaThread?: { inquiryId: string; messages: QnaMessageRow[] };
};

export type MyInstituteRow = {
  instituteId: string;
  name: string;
};

/**
 * Replaces the old Join Requests tab (Gehan: one unified view instead of
 * hunting across tabs, 0146-0148) — pending/Q&A-open/declined requests plus
 * every institute this student has paid to unlock (institute_access, 0147),
 * all in one place. Accepted-and-joined connections already show up in My
 * Classes, so they're excluded here same as before.
 */
export function ConnectionsTab({
  connections,
  myInstitutes,
}: {
  connections: ConnectionRow[];
  myInstitutes: MyInstituteRow[];
}) {
  const t = useTranslations("studentDashboard.connections");
  const tc = useTranslations("studentDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const visible = connections.filter((c) => !handledIds.has(c.enrollmentId) && !joinedIds.has(c.enrollmentId));

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

      {myInstitutes.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg">{t("myInstitutesHeading")}</h2>
          <div className="flex flex-col gap-3">
            {myInstitutes.map((inst) => (
              <Link
                key={inst.instituteId}
                href={`/class/${inst.instituteId}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-4 transition-colors hover:border-primary"
              >
                <span className="font-medium text-foreground">{inst.name}</span>
                <span className="text-sm font-medium text-primary">{t("viewClasses")}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3 text-lg">{t("requestsHeading")}</h2>
      {visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{t("empty")}</div>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((item) => (
            <div key={item.enrollmentId} className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
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
                    ) : item.status === "qna_open" ? (
                      <StatusBadge variant="active">{t("statusQnaOpen")}</StatusBadge>
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
              {item.status === "qna_open" && (
                <JoinAfterQnaPanel
                  enrollmentId={item.enrollmentId}
                  ownerType={item.ownerType}
                  qnaThread={item.qnaThread}
                  onJoined={() => {
                    setJoinedIds((prev) => new Set(prev).add(item.enrollmentId));
                    refresh();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
