"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { getPayhereCheckoutFields } from "@/lib/payhere/actions";

/**
 * The paid-unlock screen the spec requires before any PayHere redirect:
 * what's being unlocked (named explicitly), the exact amount, and a
 * non-refundable note — never just "Pay now". Builds and auto-submits a
 * plain HTML form to PayHere's hosted checkout; nothing sensitive (card
 * details) ever touches this app's own servers.
 */
export function PayhereCheckout({ paymentId, amount, unlockLabel }: { paymentId: string; amount: number; unlockLabel: string }) {
  const t = useTranslations("payhere");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    const result = await getPayhereCheckoutFields(paymentId, locale);
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    const form = document.createElement("form");
    form.method = "POST";
    form.action = result.checkoutUrl;
    for (const [key, value] of Object.entries(result.fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4">
      <p className="text-sm font-semibold text-foreground">{unlockLabel}</p>
      <p className="font-mono text-2xl font-semibold text-primary">Rs. {amount.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{t("nonRefundable")}</p>
      {error && <span className="text-xs font-medium text-destructive">{error}</span>}
      <Button type="button" onClick={handlePay} disabled={loading}>
        {loading ? t("redirecting") : t("payNow")}
      </Button>
    </div>
  );
}
