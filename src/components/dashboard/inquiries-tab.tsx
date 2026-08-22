"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/features/status-badge";
import { markInquiryRead, deleteInquiry } from "@/lib/inquiries-actions";

export type InquiryRow = {
  id: string;
  senderName: string;
  senderContact: string;
  message: string;
  status: "new" | "read";
  createdLabel: string;
};

export function InquiriesTab({ inquiries: initialInquiries }: { inquiries: InquiryRow[] }) {
  const t = useTranslations("inquiriesTab");
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkRead(id: string) {
    setInquiries((list) => list.map((inquiry) => (inquiry.id === id ? { ...inquiry, status: "read" } : inquiry)));
    const result = await markInquiryRead(id);
    if (result.error) {
      setError(result.error);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    const result = await deleteInquiry(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setInquiries((list) => list.filter((inquiry) => inquiry.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <div className="rounded-lg border border-border bg-white p-5">
        {inquiries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {inquiries.map((inquiry) => (
              <div key={inquiry.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{inquiry.senderName}</span>
                    {inquiry.status === "new" && <StatusBadge variant="pending">{t("newBadge")}</StatusBadge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{inquiry.createdLabel}</span>
                </div>
                <p className="text-sm text-foreground/80">{inquiry.message}</p>
                <p className="text-sm text-muted-foreground">
                  {t("contactLabel")}: {inquiry.senderContact}
                </p>
                <div className="flex justify-end gap-2">
                  {inquiry.status === "new" && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleMarkRead(inquiry.id)}>
                      {t("markRead")}
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(inquiry.id)}>
                    {t("delete")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
