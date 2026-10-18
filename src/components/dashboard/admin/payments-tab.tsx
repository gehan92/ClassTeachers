"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/features/status-badge";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { usePagination } from "@/lib/hooks/use-pagination";
import type { AdminPayment, AdminPaymentStatus } from "@/types/dashboard-admin";

type StatusFilter = "all" | AdminPaymentStatus;

const STATUS_VARIANT: Record<AdminPaymentStatus, "active" | "pending" | "flagged" | "closed"> = {
  completed: "active",
  pending: "pending",
  failed: "flagged",
  cancelled: "closed",
};

/**
 * Read-only view of every PayHere platform-fee transaction. Deliberately no
 * "mark as paid" button: completion only happens through PayHere's signed
 * webhook (mark_payment_completed, locked down in 0151), so an admin click
 * can never grant access without real money having moved.
 */
export function PaymentsTab({ payments }: { payments: AdminPayment[] }) {
  const t = useTranslations("adminDashboard.payments");
  const tc = useTranslations("adminDashboard.common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const money = (amount: number, currency = "LKR") =>
    `${currency === "LKR" ? "Rs." : currency} ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount)}`;

  const summary = useMemo(() => {
    const completed = payments.filter((p) => p.status === "completed");
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return {
      collected: completed.reduce((sum, p) => sum + p.amount, 0),
      thisMonth: completed
        .filter((p) => new Date(p.createdAtIso) >= monthStart)
        .reduce((sum, p) => sum + p.amount, 0),
      pending: payments.filter((p) => p.status === "pending").length,
      failed: payments.filter((p) => p.status === "failed" || p.status === "cancelled").length,
    };
  }, [payments]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesStatus = status === "all" || p.status === status;
      const matchesSearch =
        query.length === 0 ||
        p.studentName.toLowerCase().includes(query) ||
        p.targetLabel.toLowerCase().includes(query) ||
        p.orderId.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [payments, search, status]);

  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(filtered.length);
  const paged = filtered.slice(offset, offset + pageSize);

  const purposeLabel: Record<AdminPayment["purpose"], string> = {
    teacher_connection: t("purpose.teacher_connection"),
    institute_unlock: t("purpose.institute_unlock"),
    class_join: t("purpose.class_join"),
  };
  const statusLabel: Record<AdminPaymentStatus, string> = {
    completed: t("status.completed"),
    pending: t("status.pending"),
    failed: t("status.failed"),
    cancelled: t("status.cancelled"),
  };

  const cards = [
    { label: t("summary.collected"), value: money(summary.collected) },
    { label: t("summary.thisMonth"), value: money(summary.thisMonth) },
    { label: t("summary.pending"), value: String(summary.pending) },
    { label: t("summary.failed"), value: String(summary.failed) },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-white p-4">
            <div className="text-xs font-medium text-muted-foreground">{card.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{card.value}</div>
          </div>
        ))}
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
          value={status}
          onValueChange={(value) => {
            setStatus((value ?? "all") as StatusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("status.all")}</SelectItem>
            <SelectItem value="completed">{t("status.completed")}</SelectItem>
            <SelectItem value="pending">{t("status.pending")}</SelectItem>
            <SelectItem value="failed">{t("status.failed")}</SelectItem>
            <SelectItem value="cancelled">{t("status.cancelled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        {payments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.date")}</TableHead>
                    <TableHead>{t("columns.student")}</TableHead>
                    <TableHead>{t("columns.for")}</TableHead>
                    <TableHead className="text-right">{t("columns.amount")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>{t("columns.orderId")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {p.createdAt}
                        {p.paidAt && p.paidAt !== p.createdAt && (
                          <div className="text-xs">{t("paidOn", { date: p.paidAt })}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{p.studentName}</TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        <div className="text-foreground">{p.targetLabel}</div>
                        <div className="text-xs">{purposeLabel[p.purpose]}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-foreground">
                        {money(p.amount, p.currency)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={STATUS_VARIANT[p.status]}>{statusLabel[p.status]}</StatusBadge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.orderId}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
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
        <p className="mt-4 text-xs text-muted-foreground">{t("safetyNote")}</p>
      </div>
    </div>
  );
}
