"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { submitInquiry } from "@/lib/inquiries-actions";

const fieldClass =
  "w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1.75 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PriceBox({
  hourlyRate,
  monthlyRate,
  joinHref,
  helperText,
  ownerType,
  ownerId,
}: {
  hourlyRate?: number;
  monthlyRate?: number;
  joinHref: string;
  helperText?: string;
  /** Enables the "Message" button as a real inquiry form. Omit to leave it inert (no target to send to). */
  ownerType?: "teacher" | "class";
  ownerId?: string;
}) {
  const t = useTranslations("priceBox");
  const [interval, setInterval] = useState<"hr" | "mo">(hourlyRate ? "hr" : "mo");
  const amount = interval === "hr" ? hourlyRate : monthlyRate;
  const showPrice = hourlyRate !== undefined || monthlyRate !== undefined;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!ownerType || !ownerId) return;
    setSending(true);
    setError(null);
    const result = await submitInquiry({ ownerType, ownerId, ...form });
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
    setForm({ name: "", contact: "", message: "" });
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
      {showPrice && (
        <>
          <div className="mb-3 flex overflow-hidden rounded-md border border-input">
            {hourlyRate !== undefined && (
              <button
                type="button"
                onClick={() => setInterval("hr")}
                className={cn(
                  "flex-1 py-2 text-center text-xs font-semibold transition-colors",
                  interval === "hr" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                {t("hourly")}
              </button>
            )}
            {monthlyRate !== undefined && (
              <button
                type="button"
                onClick={() => setInterval("mo")}
                className={cn(
                  "flex-1 py-2 text-center text-xs font-semibold transition-colors",
                  interval === "mo" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                {t("monthly")}
              </button>
            )}
          </div>

          <div className="mb-1 font-mono text-3xl font-semibold text-primary">
            Rs. {amount?.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/{interval}</span>
          </div>
        </>
      )}
      {helperText && <p className="mb-4 text-xs text-muted-foreground">{helperText}</p>}

      <Link
        href={joinHref}
        className="mt-3 flex w-full items-center justify-center rounded-md bg-cta px-5 py-2.75 text-sm font-semibold text-cta-foreground transition-all hover:-translate-y-px hover:bg-cta-hover"
      >
        {t("join")}
      </Link>
      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        disabled={!ownerType || !ownerId}
        className="mt-2 flex w-full items-center justify-center rounded-md border border-input px-5 py-2.75 text-sm font-semibold text-primary transition-all hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("message")}
      </button>

      {showForm && ownerType && ownerId && (
        <div className="mt-3 border-t border-border pt-3.5">
          {sent ? (
            <p className="text-sm font-medium text-success">{t("messageSent")}</p>
          ) : (
            <div className="flex flex-col gap-2">
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
                size="sm"
                onClick={handleSend}
                disabled={sending || !form.name.trim() || !form.contact.trim() || !form.message.trim()}
              >
                {t("sendMessage")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
