"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/features/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const t = useTranslations("resetPassword");
  const [step, setStep] = useState<"form" | "done">("form");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t("form.mismatchError"));
      return;
    }
    setError(null);
    setStep("done");
  }

  return (
    <AuthShell quote={t("sideQuote")}>
      {step === "form" ? (
        <>
          <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-accent-deep uppercase before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
            {t("form.eyebrow")}
          </div>
          <h1 className="text-[26px]">{t("form.title")}</h1>
          <p className="mb-6.5 text-sm text-muted-foreground">{t("form.subtitle")}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="newPass">{t("form.newPasswordLabel")}</Label>
              <Input
                id="newPass"
                name="newPass"
                type="password"
                placeholder={t("form.newPasswordPlaceholder")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirmPass">{t("form.confirmPasswordLabel")}</Label>
              <Input
                id="confirmPass"
                name="confirmPass"
                type="password"
                placeholder={t("form.confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button
              type="submit"
              className="h-auto w-full rounded-sm bg-primary px-5 py-2.75 text-sm text-primary-foreground hover:bg-primary-light"
            >
              {t("form.submit")}
            </Button>
          </form>
        </>
      ) : (
        <div className="text-center">
          <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-accent-deep uppercase before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
            {t("done.eyebrow")}
          </div>
          <h1 className="text-[26px]">{t("done.title")}</h1>
          <p className="mb-6.5 text-sm text-muted-foreground">{t("done.body")}</p>

          <Button
            nativeButton={false}
            render={<Link href="/login" />}
            className="h-auto w-full rounded-sm bg-primary px-5 py-2.75 text-center text-sm text-primary-foreground hover:bg-primary-light"
          >
            {t("done.cta")}
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
