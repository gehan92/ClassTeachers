"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { requestToJoinClass } from "@/lib/dashboard/batches-actions";

/**
 * The Hero's general "Join this institute" CTA (class-profile-view.tsx) —
 * distinct from a per-batch "Request to join" (batch-join-button.tsx): this
 * one has no batch chosen yet (requestToJoinClass, 0103), so the institute
 * picks one later when approving. A guest just goes to /signup, same as
 * before this existed.
 */
export function InstituteJoinButton({
  classId,
  loggedIn,
  isStudent,
  initialStatus,
}: {
  classId: string;
  loggedIn: boolean;
  isStudent: boolean;
  initialStatus: "pending" | "accepted" | "declined" | null;
}) {
  const t = useTranslations("profilePage");
  const [status, setStatus] = useState(initialStatus);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <Link
        href="/signup"
        className="inline-flex items-center justify-center rounded-sm bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground transition-all hover:-translate-y-px hover:bg-cta-hover"
      >
        {t("joinInstitute")}
      </Link>
    );
  }

  if (!isStudent) {
    return (
      <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/85">
        {t("joinNotStudent")}
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/85">
        {t("joinPending")}
      </span>
    );
  }
  if (status === "accepted") {
    return (
      <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/85">
        {t("joinAccepted")}
      </span>
    );
  }
  if (status === "declined") {
    return (
      <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/85">
        {t("joinDeclined")}
      </span>
    );
  }

  async function handleClick() {
    setSending(true);
    setError(null);
    const result = await requestToJoinClass(classId);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatus("pending");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={sending}
        className="inline-flex items-center justify-center rounded-sm bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground transition-all hover:-translate-y-px hover:bg-cta-hover disabled:pointer-events-none disabled:opacity-60"
      >
        {t("joinInstitute")}
      </button>
      {error && <span className="text-xs font-medium text-white">{error}</span>}
    </div>
  );
}
