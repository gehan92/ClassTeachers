"use client";

import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/features/status-badge";
import type { ConnectionInquiry, ConnectionJoinRequest } from "@/types/dashboard-admin";

/**
 * Read-only — this is oversight for spam/misuse monitoring (pattern #5 from
 * Gehan's platform-comparison request), not a moderation queue. No
 * accept/decline/delete here; those actions already live on the
 * teacher/institute's own dashboard.
 */
export function ConnectionsTab({
  inquiries,
  requests,
}: {
  inquiries: ConnectionInquiry[];
  requests: ConnectionJoinRequest[];
}) {
  const t = useTranslations("adminDashboard.connections");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("inquiriesHeading")}</h3>
        {inquiries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noInquiries")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {inquiries.map((inquiry) => (
              <div key={inquiry.id} className="flex flex-col gap-1.5 py-3.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("inquiryLine", { sender: inquiry.senderName, target: inquiry.targetLabel })}
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusBadge variant={inquiry.status === "new" ? "pending" : "closed"}>
                      {t(`inquiryStatus.${inquiry.status}`)}
                    </StatusBadge>
                    <span className="text-xs text-muted-foreground">{inquiry.createdAt}</span>
                  </div>
                </div>
                <p className="text-sm text-foreground/80">{inquiry.message}</p>
                <p className="text-xs text-muted-foreground">
                  {t("contactLabel")}: {inquiry.senderContact}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("requestsHeading")}</h3>
        {requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noRequests")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-sm font-medium text-foreground">
                  {t("requestLine", { student: request.studentName, target: request.targetLabel })}
                </span>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    variant={
                      request.status === "accepted" ? "active" : request.status === "declined" ? "flagged" : "pending"
                    }
                  >
                    {t(`requestStatus.${request.status}`)}
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">{request.createdAt}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
