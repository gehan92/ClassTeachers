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
  isCampusLecturer = false,
}: {
  batchId: string;
  teacherId: string;
  hourlyRate?: number;
  monthlyRate?: number;
  loggedIn: boolean;
  isStudent: boolean;
  existingStatus: "pending" | "accepted" | "declined" | null;
  isCampusLecturer?: boolean;
}) {
  const t = useTranslations("adPage.join");
  const tp = useTranslations("priceBox");
  const [interval, setInterval] = useState<"hr" | "mo">(hourlyRate !== undefined ? "hr" : "mo");
  const amount = interval === "hr" ? hourlyRate : monthlyRate;

  return (
    <div className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
      {(hourlyRate !== undefined || monthlyRate !== undefined) && (
        <div>
          {hourlyRate !== undefined && monthlyRate !== undefined && (
            <div className="mb-3 flex overflow-hidden rounded-md border border-input">
              <button
                type="button"
                onClick={() => setInterval("hr")}
                className={cn(
                  "flex-1 py-2 text-center text-xs font-semibold transition-colors",
                  interval === "hr" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                {tp("hourly")}
              </button>
              <button
                type="button"
                onClick={() => setInterval("mo")}
                className={cn(
                  "flex-1 py-2 text-center text-xs font-semibold transition-colors",
                  interval === "mo" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                {tp("monthly")}
              </button>
            </div>
          )}
          <div className="font-mono text-3xl font-semibold text-primary">
            Rs. {amount?.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/{interval}</span>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4">
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
          <StudentRequestForm batchId={batchId} isCampusLecturer={isCampusLecturer} />
        ) : loggedIn ? (
          <p className="text-sm text-muted-foreground">{isCampusLecturer ? t("notStudentCampus") : t("notStudent")}</p>
        ) : (
          <AnonymousRequestForm teacherId={teacherId} isCampusLecturer={isCampusLecturer} />
        )}
      </div>
    </div>
  );
}

function StudentRequestForm({ batchId, isCampusLecturer }: { batchId: string; isCampusLecturer: boolean }) {
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
    <div className="flex flex-col gap-2.5">
      <p className="text-sm font-semibold text-foreground">
        {isCampusLecturer ? t("requestToEnroll") : t("requestToJoin")}
      </p>
      <textarea
        className={cn(fieldClass, "min-h-18 resize-none py-1.75")}
        placeholder={t("notePlaceholder")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <span className="text-xs font-medium text-destructive">{error}</span>}
      <Button type="button" onClick={handleSend} disabled={sending}>
        {t("send")}
      </Button>
    </div>
  );
}

function AnonymousRequestForm({ teacherId, isCampusLecturer }: { teacherId: string; isCampusLecturer: boolean }) {
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
    <div className="flex flex-col gap-2.5">
      <p className="text-sm font-semibold text-foreground">
        {isCampusLecturer ? t("requestToEnroll") : t("requestToJoin")}
      </p>
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
