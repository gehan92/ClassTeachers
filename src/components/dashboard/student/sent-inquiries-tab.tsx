"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { sendInquirerMessage } from "@/lib/inquiries-actions";

export type SentInquiryMessage = {
  id: string;
  senderRole: "owner" | "inquirer";
  body: string;
  createdLabel: string;
};

export type SentInquiryRow = {
  id: string;
  ownerType: "teacher" | "class";
  targetName: string;
  message: string;
  messages: SentInquiryMessage[];
  createdLabel: string;
};

export function SentInquiriesTab({ inquiries: initialInquiries }: { inquiries: SentInquiryRow[] }) {
  const t = useTranslations("sentInquiriesTab");
  const [inquiries, setInquiries] = useState(initialInquiries);

  function handleSent(id: string, message: SentInquiryMessage) {
    setInquiries((list) =>
      list.map((inquiry) => (inquiry.id === id ? { ...inquiry, messages: [...inquiry.messages, message] } : inquiry)),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        {inquiries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {inquiries.map((inquiry) => (
              <SentInquiryItem key={inquiry.id} inquiry={inquiry} onSent={handleSent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SentInquiryItem({
  inquiry,
  onSent,
}: {
  inquiry: SentInquiryRow;
  onSent: (id: string, message: SentInquiryMessage) => void;
}) {
  const t = useTranslations("sentInquiriesTab");
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    const result = await sendInquirerMessage(inquiry.id, text);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSent(inquiry.id, { id: `local-${Date.now()}`, senderRole: "inquirer", body: text, createdLabel: t("justNow") });
    setComposing(false);
    setText("");
  }

  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">{inquiry.targetName}</span>
        <span className="text-xs text-muted-foreground">{inquiry.createdLabel}</span>
      </div>
      <p className="text-sm text-foreground/80">{inquiry.message}</p>

      {inquiry.messages.length > 0 && (
        <div className="mt-1 flex flex-col gap-2">
          {inquiry.messages.map((msg) => (
            <div
              key={msg.id}
              className={
                msg.senderRole === "inquirer"
                  ? "rounded-md bg-secondary/60 px-3 py-2"
                  : "rounded-md border border-dashed border-border px-3 py-2"
              }
            >
              <p className="mb-0.5 text-xs font-semibold text-muted-foreground">
                {msg.senderRole === "inquirer" ? t("you") : inquiry.targetName}
              </p>
              <p className="text-sm text-foreground/85">{msg.body}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{msg.createdLabel}</p>
            </div>
          ))}
        </div>
      )}

      {composing && (
        <div className="mt-1 flex flex-col gap-2">
          <textarea
            className="min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={t("messagePlaceholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={handleSend} disabled={sending || !text.trim()}>
              {t("send")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setComposing(false)}>
              {t("cancel")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      )}

      {!composing && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setComposing(true)}>
            {inquiry.messages.length > 0 ? t("replyAgain") : t("reply")}
          </Button>
        </div>
      )}
    </div>
  );
}
