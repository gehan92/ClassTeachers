"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/features/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { grantReferralReward } from "@/lib/dashboard/admin-actions";
import type { AdminReferral } from "@/types/dashboard-admin";

const statusVariant = { pending: "pending", granted: "active", declined: "closed" } as const;

export function ReferralsTab({ initialReferrals }: { initialReferrals: AdminReferral[] }) {
  const t = useTranslations("adminDashboard.referrals");
  const tc = useTranslations("adminDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [referrals, setReferrals] = useState(initialReferrals);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGrant(id: string) {
    setPendingId(id);
    setError(null);
    const result = await grantReferralReward(id);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setReferrals((prev) => prev.map((r) => (r.id === id ? { ...r, rewardStatus: "granted" } : r)));
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.referrer")}</TableHead>
              <TableHead>{t("columns.referred")}</TableHead>
              <TableHead>{t("columns.date")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead className="text-right">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrals.map((referral) => (
              <TableRow key={referral.id}>
                <TableCell className="font-medium text-foreground">{referral.referrerName}</TableCell>
                <TableCell className="text-muted-foreground">{referral.referredName}</TableCell>
                <TableCell className="text-muted-foreground">{referral.createdAt}</TableCell>
                <TableCell>
                  <StatusBadge variant={statusVariant[referral.rewardStatus]}>
                    {t(`status.${referral.rewardStatus}`)}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  {referral.rewardStatus === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => handleGrant(referral.id)} disabled={pendingId === referral.id}>
                      {t("actions.grant")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {referrals.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
