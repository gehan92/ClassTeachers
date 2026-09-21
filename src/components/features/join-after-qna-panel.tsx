"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { joinAfterQna } from "@/lib/dashboard/batches-actions";
import { QnaThread, type QnaMessageRow } from "@/components/features/qna-thread";
import { PayhereCheckout } from "@/components/features/payhere-checkout";

/**
 * The free Q&A step the platform-fee funnel inserts between an owner's
 * accept and the student actually being "in" (see 0146's header comment).
 * "Join" waives the fee on a student's first-ever paid connection
 * (is_first_platform_connection, 0147) or hands back a pending payment to
 * redirect into PayHere checkout with. Shared by the ad page's
 * JoinRequestBox and the student dashboard's Connections tab — same
 * enrollment, same action, two places a student can act on it from.
 */
export function JoinAfterQnaPanel({
  enrollmentId,
  ownerType,
  qnaThread,
  onJoined,
}: {
  enrollmentId: string;
  ownerType: "teacher" | "class";
  qnaThread?: { inquiryId: string; messages: QnaMessageRow[] };
  onJoined: () => void;
}) {
  const t = useTranslations("adPage.join");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ id: string; amount: number } | null>(null);
  const [waived, setWaived] = useState(false);

  async function handleJoin() {
    setJoining(true);
    setError(null);
    const result = await joinAfterQna(enrollmentId);
    setJoining(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.waived) {
      setWaived(true);
      onJoined();
      return;
    }
    if (result.payment) {
      setPayment({ id: result.payment.id, amount: result.payment.amount });
    }
  }

  if (waived) {
    return <p className="text-sm font-medium text-success">{t("joinedNow")}</p>;
  }

  if (payment) {
    return (
      <PayhereCheckout
        paymentId={payment.id}
        amount={payment.amount}
        unlockLabel={ownerType === "teacher" ? t("unlockTeacherConnection") : t("unlockClassJoin")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-primary">{t("qnaOpen")}</p>
      {qnaThread && <QnaThread inquiryId={qnaThread.inquiryId} role="student" initialMessages={qnaThread.messages} />}
      <Button type="button" onClick={handleJoin} disabled={joining}>
        {t("join")}
      </Button>
      {error && <span className="text-xs font-medium text-destructive">{error}</span>}
    </div>
  );
}
