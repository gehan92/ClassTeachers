"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { requestToJoin } from "@/lib/dashboard/batches-actions";
import { submitInquiry } from "@/lib/inquiries-actions";

const fieldClass =
  "w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1.75 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function JoinRequestBox({
  batchId,
  teacherId,
  hourlyRate,
  monthlyRate,
  loggedIn,
  isStudent,
  existingStatus,
}: {
  batchId: string;
  teacherId: string;
  hourlyRate?: number;
  monthlyRate?: number;
  loggedIn: boolean;
  isStudent: boolean;
  existingStatus: "pending" | "accepted" | "declined" | null;
}) {
  const t = useTranslations("adPage.join");

  return (
    <div className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
      {(hourlyRate !== undefined || monthlyRate !== undefined) && (
        <div>
          {hourlyRate !== undefined && (
            <div className="font-mono text-2xl font-semibold text-primary">
              Rs. {hourlyRate.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/hr</span>
            </div>
          )}
          {monthlyRate !== undefined && (
            <div className="font-mono text-sm text-muted-foreground">
              Rs. {monthlyRate.toLocaleString()} /mo
            </div>
          )}
        </div>
      )}

      {existingStatus === "accepted" ? (
        <div>
          <p className="mb-3 text-sm font-medium text-success">{t("accepted")}</p>
          <Link
            href={`/teacher/${teacherId}`}
            className="flex w-full items-center justify-center rounded-md bg-cta px-5 py-2.75 text-sm font-semibold text-cta-foreground transition-all hover:-translate-y-px hover:bg-cta-hover"
          >
            {t("viewProfile")}
          </Link>
        </div>
      ) : existingStatus === "pending" ? (
        <p className="text-sm font-medium text-muted-foreground">{t("pending")}</p>
      ) : existingStatus === "declined" ? (
        <p className="text-sm font-medium text-destructive">{t("declined")}</p>
      ) : loggedIn && isStudent ? (
        <StudentRequestForm batchId={batchId} />
      ) : loggedIn ? (
        <p className="text-sm text-muted-foreground">{t("notStudent")}</p>
      ) : (
        <AnonymousRequestForm teacherId={teacherId} />
      )}
    </div>
  );
}

function StudentRequestForm({ batchId }: { batchId: string }) {
  const t = useTranslations("adPage.join");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    const result = await requestToJoin(batchId);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return <p className="text-sm font-medium text-success">{t("requestSent")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className={cn(fieldClass, "min-h-18 resize-none py-1.75")}
        placeholder={t("notePlaceholder")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <span className="text-xs font-medium text-destructive">{error}</span>}
      <Button type="button" onClick={handleSend} disabled={sending}>
        {t("requestToJoin")}
      </Button>
    </div>
  );
}

function AnonymousRequestForm({ teacherId }: { teacherId: string }) {
  const t = useTranslations("adPage.join");
  const [form, setForm] = useState({ name: "", contact: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    const result = await submitInquiry({ ownerType: "teacher", ownerId: teacherId, ...form });
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return <p className="text-sm font-medium text-success">{t("requestSent")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">{t("requestToJoin")}</p>
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
        placeholder={t("notePlaceholder")}
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
      <p className="text-xs text-muted-foreground">{t("anonymousHint")}</p>
    </div>
  );
}
