"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { replyToInquiry, sendInquirerMessage } from "@/lib/inquiries-actions";

export type QnaMessageRow = { id: string; senderRole: "owner" | "inquirer"; body: string; createdLabel: string };

/**
 * The free Q&A thread the platform-fee funnel opens once an owner accepts a
 * request (status='qna_open', see respondToJoinRequest/open_qna_thread) —
 * reuses the existing inquiries/inquiry_messages system as-is (0037/0088)
 * rather than building new thread storage, just scoped to the one inquiry
 * open_qna_thread() created for this enrollment. `role` is which side the
 * current viewer is on, not the message's own sender_role.
 */
export function QnaThread({
  inquiryId,
  role,
  initialMessages,
}: {
  inquiryId: string;
  role: "owner" | "student";
  initialMessages: QnaMessageRow[];
}) {
  const t = useTranslations("qnaThread");
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mySenderRole: QnaMessageRow["senderRole"] = role === "owner" ? "owner" : "inquirer";

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    const result = role === "owner" ? await replyToInquiry(inquiryId, text) : await sendInquirerMessage(inquiryId, text);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessages((list) => [...list, { id: `local-${Date.now()}`, senderRole: mySenderRole, body: text, createdLabel: t("justNow") }]);
    setText("");
  }

  return (
    <div className="flex flex-col gap-2.5">
      {messages.length > 0 && (
        <div className="flex flex-col gap-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={
                msg.senderRole === mySenderRole
                  ? "ml-auto max-w-[85%] rounded-md bg-secondary/60 px-3 py-2"
                  : "mr-auto max-w-[85%] rounded-md border border-dashed border-border px-3 py-2"
              }
            >
              <p className="text-sm text-foreground/85">{msg.body}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{msg.createdLabel}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <textarea
          className="min-h-16 w-full min-w-0 resize-none rounded-md border border-input bg-transparent px-2.5 py-1.75 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder={t("placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={handleSend} disabled={sending || !text.trim()}>
            {t("send")}
          </Button>
          {error && <span className="text-xs font-medium text-destructive">{error}</span>}
        </div>
      </div>
    </div>
  );
}
