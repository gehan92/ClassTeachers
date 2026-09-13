"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { generateBatchJoinCode } from "@/lib/dashboard/batches-actions";

/**
 * Shared by the institute Batches tab and the teacher Classes tab — a
 * short code the owner shares out-of-band (WhatsApp, printed handout) so a
 * student can join instantly via the student dashboard's "Have a join
 * code?" box, independent of is_open_enrollment.
 */
export function BatchJoinCode({
  batchId,
  ownerType,
  joinCode,
  onGenerated,
}: {
  batchId: string;
  ownerType: "teacher" | "class";
  joinCode: string | null;
  onGenerated: (code: string) => void;
}) {
  const t = useTranslations("batchJoinCode");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    const result = await generateBatchJoinCode(batchId, ownerType);
    setGenerating(false);
    if (result.code) onGenerated(result.code);
  }

  async function handleCopy() {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (permissions, insecure context) — the code is
      // still visible right next to this button to copy by hand.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="font-mono uppercase tracking-wide">{t("label")}</span>
      {joinCode ? (
        <>
          <span className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-sm font-semibold tracking-wider text-foreground">
            {joinCode}
          </span>
          <button type="button" className="font-medium text-primary hover:underline" onClick={handleCopy}>
            {copied ? t("copied") : t("copy")}
          </button>
          <button type="button" className="font-medium text-primary hover:underline" onClick={handleGenerate} disabled={generating}>
            {t("regenerate")}
          </button>
        </>
      ) : (
        <button type="button" className="font-medium text-primary hover:underline" onClick={handleGenerate} disabled={generating}>
          {generating ? t("generating") : t("generate")}
        </button>
      )}
    </div>
  );
}
