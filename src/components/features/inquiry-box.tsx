"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { submitInquiry } from "@/lib/inquiries-actions";

const fieldClass =
  "w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1.75 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const boxClass =
  "flex h-fit flex-col gap-2.5 rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]";

/**
 * The plain-inquiry counterpart to JoinRequestBox, for an ad shape with no
 * batch to enroll in -- a one-off lesson (0138) or a teacher-wise ad (0140,
 * institute-owned but about a specific staff member, so the inquiry goes to
 * the institute rather than the featured teacher). Just submitInquiry (the
 * one anon-writable action in this codebase, works whether or not the
 * visitor is signed in), shown unconditionally rather than branching on
 * login state the way JoinRequestBox does. `tNamespace` lets each call site
 * supply its own heading/placeholder copy while sharing the same form.
 */
export function InquiryBox({
  ownerType,
  ownerId,
  tNamespace = "adPage.lessonInquiry",
}: {
  ownerType: "teacher" | "class";
  ownerId: string;
  tNamespace?: string;
}) {
  const t = useTranslations(tNamespace);
  const [form, setForm] = useState({ name: "", contact: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    const result = await submitInquiry({ ownerType, ownerId, ...form });
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className={boxClass}>
        <p className="text-sm font-medium text-success">{t("sent")}</p>
      </div>
    );
  }

  return (
    <div className={boxClass}>
      <p className="text-sm font-semibold text-foreground">{t("heading")}</p>
      <input
        className={fieldClass}
        placeholder={t("namePlaceholder")}
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      />
      <input
        className={fieldClass}
        placeholder={t("contactPlaceholder")}
        value={form.contact}
        onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
      />
      <textarea
        className={cn(fieldClass, "min-h-18 resize-none py-1.75")}
        placeholder={t("messagePlaceholder")}
        value={form.message}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
      />
      {error && <span className="text-xs font-medium text-destructive">{error}</span>}
      <Button
        type="button"
        onClick={handleSend}
        disabled={sending || !form.name.trim() || !form.contact.trim() || !form.message.trim()}
      >
        {t("send")}
      </Button>
    </div>
  );
}
