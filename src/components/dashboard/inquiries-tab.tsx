"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/features/status-badge";
import { markInquiryRead, deleteInquiry, replyToInquiry } from "@/lib/inquiries-actions";

export type InquiryRow = {
  id: string;
  senderName: string;
  senderContact: string;
  message: string;
  status: "new" | "read";
  reply: string | null;
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

  function handleReplied(id: string, reply: string) {
    setInquiries((list) =>
      list.map((inquiry) => (inquiry.id === id ? { ...inquiry, reply, status: "read" } : inquiry)),
    );
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
              <InquiryItem
                key={inquiry.id}
                inquiry={inquiry}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
                onReplied={handleReplied}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InquiryItem({
  inquiry,
  onMarkRead,
  onDelete,
  onReplied,
}: {
  inquiry: InquiryRow;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onReplied: (id: string, reply: string) => void;
}) {
  const t = useTranslations("inquiriesTab");
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  async function handleSendReply() {
    if (!replyText.trim()) return;
    setSending(true);
    setReplyError(null);
    const result = await replyToInquiry(inquiry.id, replyText);
    setSending(false);
    if (result.error) {
      setReplyError(result.error);
      return;
    }
    onReplied(inquiry.id, replyText);
    setReplying(false);
    setReplyText("");
  }

  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
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

      {inquiry.reply ? (
        <div className="mt-1 rounded-md bg-secondary/60 px-3 py-2">
          <p className="mb-0.5 text-xs font-semibold text-muted-foreground">{t("yourReply")}</p>
          <p className="text-sm text-foreground/85">{inquiry.reply}</p>
        </div>
      ) : (
        replying && (
          <div className="mt-1 flex flex-col gap-2">
            <textarea
              className="min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder={t("replyPlaceholder")}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={handleSendReply} disabled={sending || !replyText.trim()}>
                {t("sendReply")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(false)}>
                {t("cancelReply")}
              </Button>
              {replyError && <span className="text-sm font-medium text-destructive">{replyError}</span>}
            </div>
          </div>
        )
      )}

      <div className="flex justify-end gap-2">
        {!inquiry.reply && !replying && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setReplying(true)}>
            {t("reply")}
          </Button>
        )}
        {inquiry.status === "new" && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onMarkRead(inquiry.id)}>
            {t("markRead")}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(inquiry.id)}>
          {t("delete")}
        </Button>
      </div>
    </div>
  );
}
