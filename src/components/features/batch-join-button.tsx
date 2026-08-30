"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { requestToJoin } from "@/lib/dashboard/batches-actions";

/**
 * "Request to join" on one batch card on the institute's public profile
 * (class-batch-card.tsx) — always batch-scoped (requestToJoin), same RPC a
 * teacher ad's JoinRequestBox uses. Separate from InstituteJoinButton
 * (institute-join-button.tsx), which is the Hero's general, no-batch-chosen
 * apply.
 */
export function BatchJoinButton({
  batchId,
  loggedIn,
  isStudent,
  initialStatus,
}: {
  batchId: string;
  loggedIn: boolean;
  isStudent: boolean;
  initialStatus: "pending" | "accepted" | "declined" | null;
}) {
  const t = useTranslations("classBatch");
  const [status, setStatus] = useState(initialStatus);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <Link href="/signup" className="text-xs font-semibold text-primary hover:underline">
        {t("join")}
      </Link>
    );
  }

  if (!isStudent) {
    return <span className="text-xs text-muted-foreground">{t("joinNotStudent")}</span>;
  }

  if (status === "pending") {
    return <span className="text-xs font-medium text-muted-foreground">{t("joinPending")}</span>;
  }
  if (status === "accepted") {
    return <span className="text-xs font-medium text-success">{t("joinAccepted")}</span>;
  }
  if (status === "declined") {
    return <span className="text-xs font-medium text-destructive">{t("joinDeclined")}</span>;
  }

  async function handleClick() {
    setSending(true);
    setError(null);
    const result = await requestToJoin(batchId);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatus("pending");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={sending}
        className="text-xs font-semibold text-primary hover:underline disabled:pointer-events-none disabled:opacity-60"
      >
        {t("join")}
      </button>
      {error && <span className="text-xs font-medium text-destructive">{error}</span>}
    </div>
  );
}
