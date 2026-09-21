"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { unlockInstitute } from "@/lib/dashboard/batches-actions";
import { PayhereCheckout } from "@/components/features/payhere-checkout";

/**
 * Flow B step 1/2's institute-wide unlock CTA — a lock-themed panel (same
 * visual language as GateNote/LockPill) shown instead of the full class
 * list until this student pays the one-time institute-unlock fee. Kept as
 * its own component rather than an extension of GateNote (sign-in link
 * only, server-renderable) since this needs real client state to drive the
 * payment action and inline PayhereCheckout hand-off.
 */
export function InstituteUnlockGate({ instituteId, fee, loggedIn }: { instituteId: string; fee: number; loggedIn: boolean }) {
  const t = useTranslations("instituteUnlock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ id: string; amount: number } | null>(null);

  async function handleUnlock() {
    setLoading(true);
    setError(null);
    const result = await unlockInstitute(instituteId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.alreadyUnlocked) {
      window.location.reload();
      return;
    }
    if (result.payment) {
      setPayment({ id: result.payment.id, amount: result.payment.amount });
    }
  }

  if (payment) {
    return (
      <div className="mb-5">
        <PayhereCheckout paymentId={payment.id} amount={payment.amount} unlockLabel={t("unlockLabel")} />
      </div>
    );
  }

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-lg border border-lock/20 bg-lock/5 p-4">
      <div className="flex items-start gap-2.5">
        <Lock className="mt-0.5 size-4 shrink-0 text-lock" />
        <div>
          <p className="m-0 text-sm font-medium text-foreground">{t("heading")}</p>
          <p className="m-0 mt-1 text-sm text-foreground/80">{t("body", { fee })}</p>
        </div>
      </div>
      {error && <span className="text-xs font-medium text-destructive">{error}</span>}
      {loggedIn ? (
        <Button type="button" size="sm" onClick={handleUnlock} disabled={loading} className="self-start">
          {loading ? t("unlocking") : t("unlockButton", { fee })}
        </Button>
      ) : (
        <Link href="/login" className="self-start text-sm font-semibold text-primary underline underline-offset-2">
          {t("signInToUnlock")}
        </Link>
      )}
    </div>
  );
}
