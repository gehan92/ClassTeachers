"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { requestToJoinInstitute } from "@/lib/dashboard/institute-actions";

/**
 * The teacher-side counterpart to InstituteJoinButton -- a teacher or
 * campus lecturer browsing an institute's public page can ask to join it,
 * instead of only ever waiting to be invited (0091). Kept as its own
 * component rather than branching inside InstituteJoinButton since the two
 * never render for the same viewer (a signed-in account is either a student
 * or a teacher, never both) and the status wording differs just enough
 * (pendingFromInstitute has no equivalent on the student side) to make one
 * shared component more confusing than two small ones.
 */
export function InstituteTeacherJoinButton({
  classId,
  loggedIn,
  isTeacher,
  initialStatus,
  requestedBy,
}: {
  classId: string;
  loggedIn: boolean;
  isTeacher: boolean;
  initialStatus: "pending" | "accepted" | "declined" | null;
  requestedBy: "institute" | "teacher" | null;
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
        {t("joinInstituteAsTeacher")}
      </Link>
    );
  }

  if (!isTeacher) {
    return (
      <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/85">
        {t("joinNotStudent")}
      </span>
    );
  }

  if (status === "pending" && requestedBy === "institute") {
    return (
      <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/85">
        {t("joinInstitutePendingFromInstitute")}
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
    const result = await requestToJoinInstitute(classId);
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
        {t("joinInstituteAsTeacher")}
      </button>
      {error && <span className="text-xs font-medium text-white">{error}</span>}
    </div>
  );
}
