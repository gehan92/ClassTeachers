"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { School } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolveApproval } from "@/lib/dashboard/admin-actions";
import { cn } from "@/lib/utils";
import { avatarGradientClass } from "@/lib/avatar-color";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import type { ApprovalEntityType, PendingApproval } from "@/types/dashboard-admin";

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ApprovalsTab({ initialApprovals }: { initialApprovals: PendingApproval[] }) {
  const t = useTranslations("adminDashboard.approvals");
  const tc = useTranslations("adminDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [approvals, setApprovals] = useState(initialApprovals);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entityTypeLabels: Record<ApprovalEntityType, string> = {
    teacher: t("entityTypes.teacher"),
    institute: t("entityTypes.institute"),
    campus_lecturer: t("entityTypes.campusLecturer"),
  };

  async function handleResolve(approval: PendingApproval, decision: "approved" | "rejected") {
    setPendingId(approval.id);
    setError(null);
    const kind = approval.entityType === "institute" ? "class" : "teacher";
    const result = await resolveApproval({ kind, id: approval.id, decision });
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
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
                        onClick={() => handleResolve(approval, "rejected")}
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
    </div>
  );
}
