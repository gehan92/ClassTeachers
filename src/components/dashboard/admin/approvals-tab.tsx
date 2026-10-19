"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { School } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolveApproval } from "@/lib/dashboard/admin-actions";
import { cn } from "@/lib/utils";
import { avatarGradientClass } from "@/lib/avatar-color";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { StatusBadge } from "@/components/features/status-badge";
import { SchoolApprovalsSection } from "@/components/dashboard/admin/school-approvals-section";
import type { AdminSchool, ApprovalDecision, ApprovalEntityType, PendingApproval } from "@/types/dashboard-admin";

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ApprovalsTab({
  initialApprovals,
  schools = [],
  decisions,
  avgDecisionDays,
}: {
  initialApprovals: PendingApproval[];
  /** School Mode schools (0166), pending first. Empty hides the section. */
  schools?: AdminSchool[];
  /** Most recent approve/reject decisions, newest first (from the audit log). */
  decisions: ApprovalDecision[];
  avgDecisionDays: number | null;
}) {
  const t = useTranslations("adminDashboard.approvals");
  const tc = useTranslations("adminDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [approvals, setApprovals] = useState(initialApprovals);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingApproval | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const entityTypeLabels: Record<ApprovalEntityType, string> = {
    teacher: t("entityTypes.teacher"),
    institute: t("entityTypes.institute"),
    campus_lecturer: t("entityTypes.campusLecturer"),
  };

  async function handleResolve(approval: PendingApproval, decision: "approved" | "rejected", reason?: string) {
    setPendingId(approval.id);
    setError(null);
    const kind = approval.entityType === "institute" ? "class" : "teacher";
    const result = await resolveApproval({ kind, id: approval.id, decision, reason });
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRejecting(null);
    setRejectReason("");
    setApprovals((prev) => prev.filter((a) => a.id !== approval.id));
    // The Overview tab's pending-approvals count is a separately pre-built
    // panel — it won't reflect this until the server data is refetched.
    refresh();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {error && <p className="mb-4 text-sm font-medium text-destructive">{error}</p>}

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
        className="mb-4"
      />

      <SchoolApprovalsSection schools={schools} onChanged={refresh} />

      {schools.length > 0 && <h2 className="mb-3 font-display text-lg text-primary">{t("listingsTitle")}</h2>}
      <div className="rounded-lg border border-border bg-white p-5">
        {approvals.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("noApprovalsPending")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.type")}</TableHead>
                <TableHead>{t("columns.submitted")}</TableHead>
                <TableHead className="text-right">{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((approval) => (
                <TableRow key={approval.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar>
                        <AvatarFallback
                          className={approval.entityType === "institute" ? "bg-muted text-muted-foreground" : avatarGradientClass(approval.name)}
                        >
                          {approval.entityType === "institute" ? (
                            <School className="size-4" />
                          ) : (
                            initialsFor(approval.name)
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{approval.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{entityTypeLabels[approval.entityType]}</TableCell>
                  <TableCell className="text-muted-foreground">{approval.submittedAt}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleResolve(approval, "approved")}
                        disabled={pendingId === approval.id}
                      >
                        {t("actions.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn("text-lock hover:text-lock")}
                        onClick={() => {
                          setError(null);
                          setRejectReason("");
                          setRejecting(approval);
                        }}
                        disabled={pendingId === approval.id}
                      >
                        {t("actions.reject")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="mt-8 mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-primary">{t("history.title")}</h2>
        {avgDecisionDays !== null && (
          <span className="text-xs text-muted-foreground">{t("history.avgDays", { days: avgDecisionDays })}</span>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-white p-5">
        {decisions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("history.empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("history.columns.name")}</TableHead>
                <TableHead>{t("history.columns.decision")}</TableHead>
                <TableHead>{t("history.columns.reason")}</TableHead>
                <TableHead>{t("history.columns.by")}</TableHead>
                <TableHead>{t("history.columns.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisions.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-foreground">{d.name}</TableCell>
                  <TableCell>
                    <StatusBadge variant={d.decision === "approved" ? "active" : "flagged"}>
                      {d.decision === "approved" ? t("history.approved") : t("history.rejected")}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm whitespace-normal text-muted-foreground">{d.reason || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.adminName}</TableCell>
                  <TableCell className="text-muted-foreground">{d.decidedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rejecting ? t("rejectDialog.title", { name: rejecting.name }) : ""}</DialogTitle>
            <DialogDescription>{t("rejectDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="reject-reason">{t("rejectDialog.reasonLabel")}</Label>
            <Textarea
              id="reject-reason"
              rows={4}
              maxLength={500}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("rejectDialog.reasonPlaceholder")}
            />
            <p className="text-right text-xs text-muted-foreground">{rejectReason.length}/500</p>
          </div>
          {error && rejecting && <p className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
              {t("rejectDialog.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!rejecting || pendingId === rejecting.id || rejectReason.trim().length < 5}
              onClick={() => rejecting && handleResolve(rejecting, "rejected", rejectReason)}
            >
              {t("rejectDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
