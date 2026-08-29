"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/features/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ReferralRow = {
  id: string;
  name: string;
  status: "pending" | "granted" | "declined";
  dateLabel: string;
};

const statusVariant = { pending: "pending", granted: "active", declined: "closed" } as const;

/**
 * Identical for teacher and institute dashboards (both are the only
 * account types that can ever hold a platform_subscriptions row, 0017/
 * 0089), so this is one shared component rather than a copy per dashboard
 * — see verified-tier's settings-tab panels for the pattern this
 * deliberately does NOT repeat, since there's no role-specific copy or
 * fields here to justify separate components.
 */
export function ReferEarnPanel({ referralCode, referrals }: { referralCode: string; referrals: ReferralRow[] }) {
  const t = useTranslations("referEarnPanel");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  // Reads the current origin client-side (not at render time) so server and
  // client render the same markup on first paint — same reasoning as
  // ShareButtons (share-buttons.tsx).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from window.location, not derived render state
    setOrigin(window.location.origin);
  }, []);

  const referralLink = origin ? `${origin}/signup?ref=${referralCode}` : "";

  async function handleCopy() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h3 className="mb-1 text-lg">{t("heading")}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{t("subtitle")}</p>

      <div className="flex flex-wrap items-center gap-2.5">
        <code className="flex-1 truncate rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground">
          {referralLink || "…"}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} disabled={!referralLink}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? t("copied") : t("copyLink")}
        </Button>
      </div>

      {referrals.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tableName")}</TableHead>
                <TableHead>{t("tableDate")}</TableHead>
                <TableHead>{t("tableStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium whitespace-normal text-foreground">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.dateLabel}</TableCell>
                  <TableCell>
                    <StatusBadge variant={statusVariant[row.status]}>{t(`status.${row.status}`)}</StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
