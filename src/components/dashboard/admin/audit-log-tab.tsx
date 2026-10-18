"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { usePagination } from "@/lib/hooks/use-pagination";
import type { AuditLogEntry } from "@/types/dashboard-admin";

const KNOWN_ACTIONS = [
  "listing_approval_decision",
  "institution_verified_change",
  "user_suspension_change",
  "user_role_changed",
  "site_ad_created",
  "site_ad_removed",
  "review_removed",
  "review_kept",
  "platform_setting_updated",
  "referral_reward_granted",
  "content_removed",
  "content_hidden",
] as const;
type KnownAction = (typeof KNOWN_ACTIONS)[number];

/** Read-only: audit_log (0018) has no UPDATE/DELETE policy at all, so this
 * trail can't be edited from anywhere — including this screen. */
export function AuditLogTab({ entries }: { entries: AuditLogEntry[] }) {
  const t = useTranslations("adminDashboard.auditLog");
  const tc = useTranslations("adminDashboard.common");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("all");

  const actionLabels: Record<KnownAction, string> = {
    listing_approval_decision: t("actions.listing_approval_decision"),
    institution_verified_change: t("actions.institution_verified_change"),
    user_suspension_change: t("actions.user_suspension_change"),
    user_role_changed: t("actions.user_role_changed"),
    site_ad_created: t("actions.site_ad_created"),
    site_ad_removed: t("actions.site_ad_removed"),
    review_removed: t("actions.review_removed"),
    review_kept: t("actions.review_kept"),
    platform_setting_updated: t("actions.platform_setting_updated"),
    referral_reward_granted: t("actions.referral_reward_granted"),
    content_removed: t("actions.content_removed"),
    content_hidden: t("actions.content_hidden"),
  };
  const labelFor = (a: string) => (a in actionLabels ? actionLabels[a as KnownAction] : a);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((e) => {
      const matchesAction = action === "all" || e.action === action;
      const matchesSearch =
        query.length === 0 ||
        e.actorName.toLowerCase().includes(query) ||
        e.targetLabel.toLowerCase().includes(query) ||
        e.details.toLowerCase().includes(query);
      return matchesAction && matchesSearch;
    });
  }, [entries, search, action]);

  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(filtered.length);
  const paged = filtered.slice(offset, offset + pageSize);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("searchPlaceholder")}
          className="sm:max-w-xs"
        />
        <Select
          value={action}
          onValueChange={(value) => {
            setAction(value ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allActions")}</SelectItem>
            {KNOWN_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {actionLabels[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.when")}</TableHead>
                    <TableHead>{t("columns.admin")}</TableHead>
                    <TableHead>{t("columns.action")}</TableHead>
                    <TableHead>{t("columns.target")}</TableHead>
                    <TableHead>{t("columns.details")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{e.createdAt}</TableCell>
                      <TableCell className="font-medium text-foreground">{e.actorName}</TableCell>
                      <TableCell className="text-foreground">{labelFor(e.action)}</TableCell>
                      <TableCell className="text-muted-foreground">{e.targetLabel}</TableCell>
                      <TableCell className="max-w-md whitespace-normal break-words text-xs text-muted-foreground">
                        {e.details || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        {t("noMatches")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {filtered.length > 0 && (
              <PaginationFooter
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                showingLabel={tc("pagination.showingCount", { shown: paged.length, total: filtered.length })}
                previousLabel={tc("pagination.previous")}
                nextLabel={tc("pagination.next")}
                pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
