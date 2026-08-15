"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { School } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/features/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pendingApprovals } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { avatarGradientClass } from "@/lib/avatar-color";
import type { ApprovalEntityType } from "@/types/dashboard-admin";

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ApprovalsTab() {
  const t = useTranslations("adminDashboard.approvals");
  const [approvals, setApprovals] = useState(pendingApprovals);

  const entityTypeLabels: Record<ApprovalEntityType, string> = {
    teacher: t("entityTypes.teacher"),
    institute: t("entityTypes.institute"),
    campus_lecturer: t("entityTypes.campusLecturer"),
  };

  function resolveApproval(id: string) {
    setApprovals((prev) => prev.filter((approval) => approval.id !== id));
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

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
                <TableHead>{t("columns.documents")}</TableHead>
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
                    <div className="flex flex-wrap gap-1.5">
                      {approval.documents.map((doc) => (
                        <StatusBadge key={doc.label} variant={doc.verified ? "active" : "pending"}>
                          {doc.verified ? `${doc.label} ✓` : doc.label}
                        </StatusBadge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => resolveApproval(approval.id)}>
                        {t("actions.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn("text-lock hover:text-lock")}
                        onClick={() => resolveApproval(approval.id)}
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
