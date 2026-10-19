"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { submitContentReport } from "@/lib/report-actions";
import { cn } from "@/lib/utils";
import type { ContentReportReason, ContentReportTarget } from "@/types/dashboard-admin";

const REASONS: ContentReportReason[] = ["spam", "fake", "scam", "inappropriate", "other"];

/**
 * Small "Report" link for public pages (ads, teacher/institute profiles,
 * student requests). Opens a short form; signed-out visitors are asked to
 * sign in first. Reports go to Admin -> Reports.
 */
export function ReportButton({
  targetType,
  targetId,
  signedIn,
  className,
}: {
  targetType: ContentReportTarget;
  targetId: string;
  signedIn: boolean;
  className?: string;
}) {
  const t = useTranslations("report");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ContentReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setReason(null);
      setDetails("");
      setError(null);
      setSent(false);
    }
  }

  async function send() {
    if (!reason) {
      setError(t("chooseReason"));
      return;
    }
    setPending(true);
    setError(null);
    const result = await submitContentReport({ targetType, targetId, reason, details: details.trim() || undefined });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => reset(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
        )}
      >
        <Flag className="size-3.5" />
        {t(`button.${targetType}`)}
      </button>

      <Dialog open={open} onOpenChange={reset}>
        <DialogContent>
          {!signedIn ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("signInTitle")}</DialogTitle>
                <DialogDescription>{t("signInBody")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => reset(false)}>
                  {t("cancel")}
                </Button>
                <Button type="button" onClick={() => router.push("/login")}>
                  {t("signIn")}
                </Button>
              </DialogFooter>
            </>
          ) : sent ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("sentTitle")}</DialogTitle>
                <DialogDescription>{t("sentBody")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" onClick={() => reset(false)}>
                  {t("done")}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t(`title.${targetType}`)}</DialogTitle>
                <DialogDescription>{t("description")}</DialogDescription>
              </DialogHeader>
              <fieldset className="grid gap-2" disabled={pending}>
                <legend className="mb-1 text-sm font-medium text-foreground">{t("reasonLabel")}</legend>
                {REASONS.map((r) => (
                  <label
                    key={r}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      reason === r ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60",
                    )}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="mt-0.5 accent-[var(--color-primary)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{t(`reasons.${r}.label`)}</span>
                      <span className="block text-xs text-muted-foreground">{t(`reasons.${r}.hint`)}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="grid gap-1.5">
                <Label htmlFor="report-details">
                  {t("detailsLabel")} {reason !== "other" && <span className="font-normal text-muted-foreground">{t("optional")}</span>}
                </Label>
                <Textarea
                  id="report-details"
                  value={details}
                  maxLength={1000}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder={t("detailsPlaceholder")}
                  rows={3}
                />
              </div>
              {error && <p className="text-sm font-medium text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => reset(false)} disabled={pending}>
                  {t("cancel")}
                </Button>
                <Button type="button" variant="destructive" onClick={send} disabled={pending || !reason}>
                  {pending ? t("sending") : t("send")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
