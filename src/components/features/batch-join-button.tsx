"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { requestToJoin, joinOpenBatch } from "@/lib/dashboard/batches-actions";

/**
 * "Request to join" on one batch card on the institute's public profile
 * (class-batch-card.tsx) — always batch-scoped (requestToJoin), same RPC a
 * teacher ad's JoinRequestBox uses. Separate from InstituteJoinButton
 * (institute-join-button.tsx), which is the Hero's general, no-batch-chosen
 * apply. Open-enrollment batches (0106) skip the pending step entirely via
 * joinOpenBatch, gated on capacity/spotsLeft instead of an approval status.
 */
export function BatchJoinButton({
  batchId,
  loggedIn,
  isStudent,
  initialStatus,
  isOpenEnrollment = false,
  capacity,
  spotsTaken = 0,
}: {
  batchId: string;
  loggedIn: boolean;
  isStudent: boolean;
  initialStatus: "pending" | "accepted" | "declined" | null;
  isOpenEnrollment?: boolean;
  capacity?: number | null;
  spotsTaken?: number;
}) {
  const t = useTranslations("classBatch");
  const [status, setStatus] = useState(initialStatus);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spotsLeft = capacity != null ? Math.max(0, capacity - spotsTaken) : undefined;
  const isFull = spotsLeft === 0;

  if (status === "accepted") {
    return <span className="text-xs font-medium text-success">{t("joinAccepted")}</span>;
  }

  if (!loggedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/signup" className="text-xs font-semibold text-primary hover:underline">
          {isOpenEnrollment ? t("joinNow") : t("join")}
        </Link>
        {isOpenEnrollment && spotsLeft !== undefined && !isFull && (
          <span className="text-xs text-muted-foreground">{t("spotsLeft", { count: spotsLeft })}</span>
        )}
      </div>
    );
  }

  if (!isStudent) {
    return <span className="text-xs text-muted-foreground">{t("joinNotStudent")}</span>;
  }

  if (!isOpenEnrollment) {
    if (status === "pending") {
      return <span className="text-xs font-medium text-muted-foreground">{t("joinPending")}</span>;
    }
    if (status === "declined") {
      return <span className="text-xs font-medium text-destructive">{t("joinDeclined")}</span>;
    }
  }

  if (isOpenEnrollment && isFull) {
    return <span className="text-xs text-muted-foreground">{t("full")}</span>;
  }

  async function handleClick() {
    setSending(true);
    setError(null);
    const result = isOpenEnrollment ? await joinOpenBatch(batchId) : await requestToJoin(batchId);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatus(isOpenEnrollment ? "accepted" : "pending");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={sending}
        className="text-xs font-semibold text-primary hover:underline disabled:pointer-events-none disabled:opacity-60"
      >
        {isOpenEnrollment ? t("joinNow") : t("join")}
      </button>
      {isOpenEnrollment && spotsLeft !== undefined && !isFull && (
        <span className="text-xs text-muted-foreground">{t("spotsLeft", { count: spotsLeft })}</span>
      )}
      {error && <span className="text-xs font-medium text-destructive">{error}</span>}
    </div>
  );
}
